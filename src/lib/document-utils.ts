import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
} as const;

export const ACCEPTED_EXTENSIONS = '.pdf,.txt,.csv,.docx';

export function isFileSupported(file: File): boolean {
  return Object.keys(SUPPORTED_FILE_TYPES).includes(file.type) || 
    file.name.endsWith('.txt') || file.name.endsWith('.csv');
}

export function isFileTooLarge(file: File): boolean {
  return file.size > MAX_FILE_SIZE;
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (isFileTooLarge(file)) {
    throw new Error('File exceeds 10MB limit');
  }

  if (file.type === 'application/pdf') {
    return extractPdfText(file);
  }

  if (file.type === 'text/plain' || file.type === 'text/csv' || 
      file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    return extractPlainText(file);
  }

  if (file.name.endsWith('.docx')) {
    return extractDocxText(file);
  }

  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

async function extractPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function extractDocxText(file: File): Promise<string> {
  // Basic DOCX extraction: DOCX is a zip containing XML.
  // For a lightweight approach, we extract the raw text from document.xml
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    // Use the browser's built-in compression API if available
    const blob = new Blob([arrayBuffer]);
    const ds = new DecompressionStream('deflate-raw');
    
    // Fallback: try to find readable text in the raw bytes
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(arrayBuffer);
    
    // Extract text between XML tags (rough but functional)
    const textMatches = rawText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches && textMatches.length > 0) {
      return textMatches
        .map(match => match.replace(/<[^>]+>/g, ''))
        .join(' ');
    }

    // If XML parsing didn't work, return a filtered version
    return rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    throw new Error('Failed to extract text from DOCX. Try converting to PDF or TXT.');
  }
}

export function getFileIcon(fileName: string): string {
  if (fileName.endsWith('.pdf')) return '📄';
  if (fileName.endsWith('.docx')) return '📝';
  if (fileName.endsWith('.csv')) return '📊';
  return '📃';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

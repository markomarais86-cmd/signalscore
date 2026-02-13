

# Fix: Accept PDF and Other Document Uploads in AI Customer Onboarding

## Problem
The file upload only accepts `.txt` and `.csv` files. PDFs, DOCX, and PPTX are rejected with a generic "please copy-paste" message. Users expect to upload a PDF and have it parsed automatically.

## Solution
Add client-side PDF text extraction using the `pdfjs-dist` library (Mozilla's PDF.js). This will:
1. Accept PDF files in the file input
2. Extract all text content from every page of the PDF
3. Auto-populate the textarea with the extracted text
4. Keep the existing paste-based workflow as a fallback

## Technical Changes

### 1. Install `pdfjs-dist` dependency
Add `pdfjs-dist` package for client-side PDF parsing.

### 2. Update `AICustomerOnboardingDialog.tsx`

**Expand accepted file types** (line 127):
- Change `accept=".txt,.csv"` to `accept=".txt,.csv,.pdf"`
- Update label from "Upload Text File" to "Upload Document"

**Add PDF extraction logic** in `handleFileUpload`:
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const handleFileUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.type === "application/pdf") {
    // Read PDF as ArrayBuffer, extract text from all pages
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    setDocumentText(prev => prev ? prev + "\n\n" + fullText : fullText);
    toast.success(`Extracted text from ${pdf.numPages} pages of ${file.name}`);
  } else if (file.type === "text/plain" || file.name.endsWith('.csv')) {
    // Existing text file handling
    const text = await file.text();
    setDocumentText(prev => prev ? prev + "\n\n" + text : text);
    toast.success(`Loaded ${file.name}`);
  } else {
    toast.info("Unsupported format. Please upload a PDF or text file, or paste content directly.");
  }
};
```

**Add loading state for file parsing** -- show a spinner while extracting PDF text since large PDFs can take a moment.

### Summary
| Change | Detail |
|--------|--------|
| New dependency | `pdfjs-dist` for client-side PDF text extraction |
| File accept types | `.txt,.csv` changed to `.txt,.csv,.pdf` |
| Upload handler | Added PDF parsing via `pdfjs-dist` with page-by-page text extraction |
| UX | Loading indicator during PDF extraction, success toast with page count |

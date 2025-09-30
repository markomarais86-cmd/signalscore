export const parseCSV = (csvText: string): any[] => {
  // Handle different line endings
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Parse CSV properly handling quotes and commas within fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const lines = normalizedText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] ? values[index].replace(/^"|"$/g, '').trim() : null;
      row[header] = value || null;
    });
    
    // Skip completely empty rows
    if (Object.values(row).some(v => v !== null && v !== '')) {
      rows.push(row);
    }
  }

  return rows;
};

export const ACCOUNTS_HEADERS = [
  "external_id (required)",
  "name",
  "domain", 
  "industry_raw",
  "employee_count",
  "revenue_range",
  "country"
];

export const CONTACTS_HEADERS = [
  "external_id (required)",
  "account_external_id (required)",
  "first_name",
  "last_name", 
  "email",
  "title_raw",
  "country"
];

export const generateCSVTemplate = (type: 'accounts' | 'contacts'): string => {
  const headers = type === 'accounts' ? ACCOUNTS_HEADERS : CONTACTS_HEADERS;
  
  // Add sample data rows to help users understand the format
  const sampleRows = type === 'accounts' ? [
    'ACC001,Acme Corp,acme.com,Software Development,250,$10M-$50M,United States',
    'ACC002,TechFlow Inc,techflow.io,Data Analytics,180,$5M-$10M,Canada',
    'ACC003,CloudScale,cloudscale.net,Cloud Services,450,$50M-$100M,United Kingdom'
  ] : [
    'CONT001,ACC001,Sarah,Chen,sarah@acme.com,Chief Technology Officer,United States',
    'CONT002,ACC001,Michael,Rodriguez,mike@acme.com,VP of Engineering,United States',
    'CONT003,ACC002,Emma,Thompson,emma@techflow.io,Head of Data Science,Canada'
  ];
  
  return headers.join(',') + '\n' + sampleRows.join('\n');
};

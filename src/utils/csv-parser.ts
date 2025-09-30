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
  "country",
  "phone",
  "mobile",
  "state_province"
];

export const CONTACTS_HEADERS = [
  "external_id (required)",
  "account_external_id (required)",
  "first_name",
  "last_name", 
  "email",
  "title_raw",
  "country",
  "phone",
  "mobile",
  "state_province"
];

export const LEADS_HEADERS = [
  "external_id (required)",
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile",
  "title",
  "company",
  "website",
  "industry",
  "revenue_range",
  "employee_count",
  "country",
  "state_province",
  "status"
];

export const generateCSVTemplate = (type: 'accounts' | 'contacts' | 'leads'): string => {
  let headers: string[];
  let sampleRows: string[];
  
  if (type === 'accounts') {
    headers = ACCOUNTS_HEADERS;
    sampleRows = [
      'ACC001,Acme Corp,acme.com,Software Development,250,$10M-$50M,United States,+1-555-0100,+1-555-0101,California',
      'ACC002,TechFlow Inc,techflow.io,Data Analytics,180,$5M-$10M,Canada,+1-555-0200,+1-555-0201,Ontario',
      'ACC003,CloudScale,cloudscale.net,Cloud Services,450,$50M-$100M,United Kingdom,+44-20-5555-0100,+44-77-5555-0100,London'
    ];
  } else if (type === 'contacts') {
    headers = CONTACTS_HEADERS;
    sampleRows = [
      'CONT001,ACC001,Sarah,Chen,sarah@acme.com,Chief Technology Officer,United States,+1-555-1000,+1-555-1001,California',
      'CONT002,ACC001,Michael,Rodriguez,mike@acme.com,VP of Engineering,United States,+1-555-1100,+1-555-1101,California',
      'CONT003,ACC002,Emma,Thompson,emma@techflow.io,Head of Data Science,Canada,+1-555-1200,+1-555-1201,Ontario'
    ];
  } else {
    headers = LEADS_HEADERS;
    sampleRows = [
      'LEAD001,Bob,Johnson,bob@example.com,+1-555-2000,+1-555-2001,CEO,Example Corp,example.com,Technology,$5M-$10M,200,United States,Texas,open',
      'LEAD002,Alice,Williams,alice@startup.io,+1-555-3000,+1-555-3001,Founder,Startup Inc,startup.io,Software,$1M-$5M,50,Canada,British Columbia,qualified',
      'LEAD003,David,Brown,david@techco.com,+1-555-4000,+1-555-4001,CTO,Tech Co,techco.com,SaaS,$10M-$50M,150,United States,New York,nurturing'
    ];
  }
  
  return headers.join(',') + '\n' + sampleRows.join('\n');
};

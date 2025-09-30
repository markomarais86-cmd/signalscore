export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    
    rows.push(row);
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
  return headers.join(',') + '\n';
};

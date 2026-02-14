export const SYSTEM_FIELDS = {
  accounts: [
    { value: 'external_id', label: 'Account ID', required: false },
    { value: 'name', label: 'Company Name', required: true },
    { value: 'domain', label: 'Website/Domain', required: false },
    { value: 'industry_raw', label: 'Industry', required: false },
    { value: 'employee_count', label: 'Employee Count', required: false },
    { value: 'revenue_range', label: 'Revenue Range', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
  contacts: [
    { value: 'external_id', label: 'Contact ID', required: false },
    { value: 'account_external_id', label: 'Account ID', required: false },
    { value: 'first_name', label: 'First Name', required: false },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'email', label: 'Email', required: false },
    { value: 'title_raw', label: 'Job Title', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
  leads: [
    { value: 'external_id', label: 'Lead ID', required: false },
    { value: 'first_name', label: 'First Name', required: false },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'email', label: 'Email', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'title', label: 'Title', required: false },
    { value: 'company', label: 'Company', required: false },
    { value: 'website', label: 'Website', required: false },
    { value: 'industry', label: 'Industry', required: false },
    { value: 'revenue_range', label: 'Annual Revenue', required: false },
    { value: 'employee_count', label: 'Number of Employees', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
    { value: 'status', label: 'Status', required: false },
  ],
  combined: [
    { value: 'external_id', label: 'ID', required: false },
    { value: 'first_name', label: 'First Name', required: false },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'email', label: 'Email', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'title', label: 'Title', required: false },
    { value: 'company', label: 'Company', required: false },
    { value: 'website', label: 'Website', required: false },
    { value: 'industry', label: 'Industry', required: false },
    { value: 'revenue_range', label: 'Annual Revenue', required: false },
    { value: 'employee_count', label: 'Number of Employees', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
};

type SystemFieldList = typeof SYSTEM_FIELDS.accounts;

// Smart mapping algorithm
export const autoDetectMapping = (csvColumn: string, systemFields: SystemFieldList): { field: string; confidence: number } | null => {
  const normalized = csvColumn.toLowerCase().trim();
  
  const patterns: Record<string, string[]> = {
    external_id: ['lead id', 'id', 'external_id', 'account_id', 'company_id', 'contact_id', 'lead_id', 'crm_id', 'salesforce_id'],
    account_external_id: ['account_id', 'company_id', 'account', 'company'],
    name: ['name', 'company_name', 'company', 'account_name', 'organization'],
    first_name: ['first name', 'first_name', 'firstname', 'fname', 'given_name'],
    last_name: ['last name', 'last_name', 'lastname', 'lname', 'surname', 'family_name'],
    email: ['email', 'email_address', 'mail', 'e-mail'],
    domain: ['domain', 'website', 'url', 'web', 'site'],
    website: ['website', 'domain', 'url', 'web', 'site'],
    industry_raw: ['industry', 'sector', 'vertical', 'business_type'],
    industry: ['industry', 'sector', 'vertical', 'business_type'],
    employee_count: ['no. of employees', 'number of employees', 'employee range', 'employee_count', 'employees', 'headcount', 'size', 'company_size'],
    revenue_range: ['annual revenue', 'revenue band', 'revenue', 'revenue_range', 'annual_revenue', 'arr', 'sales'],
    country: ['country', 'nation', 'location'],
    state_province: ['state/province', 'state', 'province', 'region'],
    title_raw: ['title', 'job_title', 'position', 'role', 'job_position'],
    title: ['title', 'job_title', 'position', 'role', 'job_position'],
    phone: ['phone', 'telephone', 'tel', 'phone number', 'work phone'],
    mobile: ['mobile', 'cell', 'cell phone', 'mobile number', 'cellular'],
    company: ['company', 'company_name', 'company name', 'organization', 'account_name'],
    status: ['status', 'lead_status', 'stage', 'lead status'],
  };

  let bestMatch: { field: string; confidence: number } | null = null;

  for (const field of systemFields) {
    const fieldPatterns = patterns[field.value] || [];
    
    // Exact match
    if (fieldPatterns.includes(normalized)) {
      return { field: field.value, confidence: 100 };
    }

    // Partial match
    for (const pattern of fieldPatterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        const confidence = Math.round((pattern.length / Math.max(normalized.length, pattern.length)) * 90);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: field.value, confidence };
        }
      }
    }
  }

  return bestMatch;
};

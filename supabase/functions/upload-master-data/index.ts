import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MasterDataRecord {
  domain: string;
  company_name: string | null;
  founded_year: number | null;
  phone: string | null;
  annual_revenue: number | null;
  revenue_range: string | null;
  employee_count: number | null;
  naics_code: string | null;
  industry_primary: string | null;
  industry_secondary: string | null;
  business_model: string | null;
  address: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
}

// Normalize domain: remove protocol, www, trailing slashes, lowercase
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  
  let normalized = domain.trim().toLowerCase();
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/\/.*$/, '');
  normalized = normalized.replace(/\.$/, '');
  
  return normalized || null;
}

// Convert raw revenue to standard range
function normalizeRevenueToRange(revenue: number | null): string | null {
  if (revenue === null || isNaN(revenue)) return null;
  
  if (revenue < 1000000) return '<$1M';
  if (revenue < 5000000) return '$1M-$5M';
  if (revenue < 10000000) return '$5M-$10M';
  if (revenue < 25000000) return '$10M-$25M';
  if (revenue < 50000000) return '$25M-$50M';
  if (revenue < 100000000) return '$50M-$100M';
  if (revenue < 250000000) return '$100M-$250M';
  if (revenue < 500000000) return '$250M-$500M';
  if (revenue < 1000000000) return '$500M-$1B';
  return '$1B+';
}

// Parse integer safely
function parseIntSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

// Parse float safely
function parseFloatSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Map CSV row to record based on ZoomInfo format
function mapRowToRecord(row: string[], headers: string[]): MasterDataRecord | null {
  const getValue = (possibleNames: string[]): string | null => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => 
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (index !== -1 && row[index]) {
        return row[index].trim() || null;
      }
    }
    return null;
  };

  const domain = normalizeDomain(getValue(['Website', 'Domain', 'CompanyWebsite', 'URL']));
  
  if (!domain) return null;

  const annualRevenue = parseFloatSafe(getValue(['AnnualRevenue', 'Annual Revenue', 'Revenue']));
  
  return {
    domain,
    company_name: getValue(['Company', 'CompanyName', 'Company Name', 'Name']),
    founded_year: parseIntSafe(getValue(['Founded', 'FoundedYear', 'Founded Year', 'Year Founded'])),
    phone: getValue(['Phone', 'CompanyPhone', 'Company Phone', 'HQ Phone']),
    annual_revenue: annualRevenue,
    revenue_range: normalizeRevenueToRange(annualRevenue),
    employee_count: parseIntSafe(getValue(['No. of Employees', 'Employees', 'Employee Count', 'EmployeeCount', 'NoofEmployees'])),
    naics_code: getValue(['NAICS 1', 'NAICS', 'NAICS Code', 'NAICSCode', 'NAICS1']),
    industry_primary: getValue(['Industry', 'Primary Industry', 'PrimaryIndustry']),
    industry_secondary: getValue(['Secondary Industry', 'SecondaryIndustry', 'Sub Industry', 'SubIndustry']),
    business_model: getValue(['Business Model', 'BusinessModel', 'B2B/B2C']),
    address: getValue(['HQ Address', 'Address', 'Street', 'HQAddress']),
    city: getValue(['HQ City', 'City', 'HQCity']),
    state_province: getValue(['HQ State', 'State', 'HQState', 'Province']),
    postal_code: getValue(['HQ Postal Code', 'Postal Code', 'Zip', 'ZipCode', 'HQPostalCode']),
    country: getValue(['HQ Country', 'Country', 'HQCountry']),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const contentType = req.headers.get('content-type') || '';
    
    let csvContent: string;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      csvContent = await file.text();
    } else {
      const body = await req.json();
      
      // Support fetching from URL
      if (body.csv_url) {
        console.log('Fetching CSV from URL:', body.csv_url);
        const response = await fetch(body.csv_url);
        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: `Failed to fetch CSV: ${response.status}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        csvContent = await response.text();
      } else {
        csvContent = body.csv_content;
      }
    }

    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: 'No CSV content provided. Pass csv_content or csv_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing CSV upload...');
    
    // Split into lines and parse
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: 'CSV must have headers and at least one data row' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    console.log('CSV Headers:', headers);

    const records: MasterDataRecord[] = [];
    const errors: string[] = [];
    const seenDomains = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);
        const record = mapRowToRecord(row, headers);
        
        if (record && record.domain && !seenDomains.has(record.domain)) {
          records.push(record);
          seenDomains.add(record.domain);
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    console.log(`Parsed ${records.length} unique records from ${lines.length - 1} rows`);

    // Process in batches of 1000
    const BATCH_SIZE = 1000;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('master_account_data')
        .upsert(batch, { 
          onConflict: 'domain',
          ignoreDuplicates: false 
        })
        .select('id');

      if (error) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        const count = data?.length || 0;
        inserted += count;
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Upserted ${count} records`);
      }
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('master_account_data')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        success: true,
        records_processed: records.length,
        records_upserted: inserted,
        total_in_database: totalCount,
        duplicates_skipped: lines.length - 1 - records.length,
        errors: errors.slice(0, 10),
        error_count: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

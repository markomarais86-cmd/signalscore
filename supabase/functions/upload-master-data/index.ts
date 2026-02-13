import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let d = url.trim().toLowerCase();
  d = d.replace(/^(https?:\/\/|\/\/)/i, '');
  d = d.replace(/^www\./i, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/\.$/, '');
  return d || null;
}

function toRevenueRange(val: string | number | null | undefined): string | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return null;
  if (num < 1_000_000) return '<$1M';
  if (num < 5_000_000) return '$1M-$5M';
  if (num < 10_000_000) return '$5M-$10M';
  if (num < 25_000_000) return '$10M-$25M';
  if (num < 50_000_000) return '$25M-$50M';
  if (num < 100_000_000) return '$50M-$100M';
  if (num < 250_000_000) return '$100M-$250M';
  if (num < 500_000_000) return '$250M-$500M';
  if (num < 1_000_000_000) return '$500M-$1B';
  return '$1B+';
}

function toInt(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
  return isNaN(num) ? null : num;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { rows } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No rows provided. Send { rows: [...] }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch of ${rows.length} rows`);

    const records: any[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const domain = normalizeDomain(row['Website'] || row['website'] || row['Domain'] || row['domain']);
      if (!domain) {
        skipped.push('Missing website/domain');
        continue;
      }

      records.push({
        'Company': row['Company'] || row['company'] || row['Company Name'] || null,
        'Website': row['Website'] || row['website'] || null,
        'Founded Year': row['Founded Year'] || row['founded_year'] || null,
        'HQ Phone': row['HQ Phone'] || row['Phone'] || row['phone'] || null,
        'Annual Revenue': row['Annual Revenue'] || row['annual_revenue'] || null,
        'No. of Employees': row['No. of Employees'] || row['Employees'] || row['employee_count'] || null,
        'NAICS 1': row['NAICS 1'] || row['NAICS'] || null,
        'NAICS 2': row['NAICS 2'] || null,
        'NAICS 3': row['NAICS 3'] || null,
        'NAICS 4': row['NAICS 4'] || null,
        'Industry': row['Industry'] || row['industry'] || null,
        'Secondary Industry': row['Secondary Industry'] || row['Sub Industry'] || null,
        'Business Model': row['Business Model'] || row['business_model'] || null,
        'HQ Address': row['HQ Address'] || row['Address'] || null,
        'HQ City': row['HQ City'] || row['City'] || null,
        'HQ State': row['HQ State'] || row['State'] || null,
        'HQ Postal Code': row['HQ Postal Code'] || row['Postal Code'] || null,
        'HQ Country': row['HQ Country'] || row['Country'] || null,
        'Lead Source': row['Lead Source'] || null,
        'Lead Source Details': row['Lead Source Details'] || null,
        domain_normalized: domain,
        revenue_range: toRevenueRange(row['Annual Revenue'] || row['annual_revenue']),
        employee_count_int: toInt(row['No. of Employees'] || row['Employees'] || row['employee_count']),
        founded_year_int: toInt(row['Founded Year'] || row['founded_year']),
      });
    }

    let upserted = 0;
    const errors: string[] = [];

    // Upsert in sub-batches of 1000
    const BATCH = 1000;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from('master_account_data')
        .upsert(batch, { onConflict: 'domain_normalized', ignoreDuplicates: false })
        .select('id');

      if (error) {
        console.error(`Sub-batch error:`, error.message);
        errors.push(error.message);
      } else {
        upserted += data?.length || 0;
      }
    }

    const { count: totalCount } = await supabase
      .from('master_account_data')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        success: true,
        upserted,
        skipped: skipped.length,
        total_in_database: totalCount,
        errors: errors.slice(0, 10),
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Account {
  id: string;
  industry_norm: string | null;
  industry_raw: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
}

interface FirmographicPattern {
  name: string;
  count: number;
  percentage: number;
}

interface FirmographicAnalysis {
  total_accounts: number;
  industries: FirmographicPattern[];
  sub_industries: FirmographicPattern[];
  company_sizes: { size: string; count: number; percentage: number }[];
  revenue_ranges: FirmographicPattern[];
  geographies: FirmographicPattern[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's org_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const org_id = profile.org_id;

    // Fetch all accounts for this org (remove default 1000 limit)
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, industry_norm, industry_raw, employee_count, revenue_range, country')
      .eq('org_id', org_id)
      .limit(100000);

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No accounts found. Upload account data first.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${accounts.length} accounts for org ${org_id}`);

    // Analyze industries
    const industryMap = new Map<string, number>();
    const subIndustryMap = new Map<string, number>();
    accounts.forEach(account => {
      if (account.industry_norm) {
        industryMap.set(account.industry_norm, (industryMap.get(account.industry_norm) || 0) + 1);
      }
      if (account.industry_raw && account.industry_raw !== account.industry_norm) {
        subIndustryMap.set(account.industry_raw, (subIndustryMap.get(account.industry_raw) || 0) + 1);
      }
    });

    // Analyze company sizes
    const sizeMap = new Map<string, number>();
    accounts.forEach(account => {
      if (account.employee_count) {
        const sizeCategory = categorizeSizeRange(account.employee_count);
        sizeMap.set(sizeCategory, (sizeMap.get(sizeCategory) || 0) + 1);
      }
    });

    // Analyze revenue ranges
    const revenueMap = new Map<string, number>();
    accounts.forEach(account => {
      if (account.revenue_range) {
        revenueMap.set(account.revenue_range, (revenueMap.get(account.revenue_range) || 0) + 1);
      }
    });

    // Analyze geographies
    const geoMap = new Map<string, number>();
    accounts.forEach(account => {
      if (account.country) {
        geoMap.set(account.country, (geoMap.get(account.country) || 0) + 1);
      }
    });

    const total = accounts.length;

    // Format results
    const industries = Array.from(industryMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const sub_industries = Array.from(subIndustryMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    const company_sizes = Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    const revenue_ranges = Array.from(revenueMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    const geographies = Array.from(geoMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const analysis: FirmographicAnalysis = {
      total_accounts: total,
      industries,
      sub_industries,
      company_sizes,
      revenue_ranges,
      geographies
    };

    // Log to audit
    await supabase.from('audit_logs').insert({
      org_id,
      actor: user.email,
      action: 'analyze_firmographics',
      meta: { total_accounts: total, top_industry: industries[0]?.name }
    });

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing firmographics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function categorizeSizeRange(employeeCount: number): string {
  if (employeeCount < 50) return '1-49';
  if (employeeCount < 200) return '50-199';
  if (employeeCount < 500) return '200-499';
  if (employeeCount < 1000) return '500-999';
  if (employeeCount < 5000) return '1000-4999';
  return '5000+';
}

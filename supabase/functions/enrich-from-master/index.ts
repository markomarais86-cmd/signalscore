import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Running master data enrichment for org: ${org_id}`);

    // Call the enrichment function
    const { data, error } = await supabase.rpc('enrich_accounts_from_master', {
      p_org_id: org_id
    });

    if (error) {
      console.error('Enrichment error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Enrichment result:', data);

    // Get coverage stats
    const { data: stats } = await supabase
      .from('accounts')
      .select('employee_count, revenue_range, industry_norm, naics, enriched_from')
      .eq('org_id', org_id);

    const totalAccounts = stats?.length || 0;
    const coverage = {
      employee_count: stats?.filter(a => a.employee_count !== null).length || 0,
      revenue_range: stats?.filter(a => a.revenue_range !== null).length || 0,
      industry: stats?.filter(a => a.industry_norm !== null).length || 0,
      naics: stats?.filter(a => a.naics !== null).length || 0,
      enriched_from_master: stats?.filter(a => a.enriched_from?.includes('master_data')).length || 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        ...data,
        coverage: {
          total_accounts: totalAccounts,
          ...coverage,
          percentages: {
            employee_count: totalAccounts > 0 ? Math.round((coverage.employee_count / totalAccounts) * 100) : 0,
            revenue_range: totalAccounts > 0 ? Math.round((coverage.revenue_range / totalAccounts) * 100) : 0,
            industry: totalAccounts > 0 ? Math.round((coverage.industry / totalAccounts) * 100) : 0,
            naics: totalAccounts > 0 ? Math.round((coverage.naics / totalAccounts) * 100) : 0,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

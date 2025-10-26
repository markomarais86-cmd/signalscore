import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  reportId: string;
  format?: 'json' | 'csv' | 'pdf';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { reportId, format = 'json' }: ReportRequest = await req.json();

    console.log(`Generating report ${reportId} in ${format} format`);

    // Fetch report configuration
    const { data: report, error: reportError } = await supabaseClient
      .from('custom_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError) throw reportError;

    // Get org_id from user profile
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) throw new Error('Organization not found');

    // Generate report data based on template
    let reportData: any = {};

    switch (report.template_id) {
      case 'executive_summary':
        reportData = await generateExecutiveSummary(supabaseClient, profile.org_id);
        break;
      case 'account_performance':
        reportData = await generateAccountPerformance(supabaseClient, profile.org_id);
        break;
      case 'icp_analysis':
        reportData = await generateICPAnalysis(supabaseClient, profile.org_id);
        break;
      case 'data_quality':
        reportData = await generateDataQuality(supabaseClient, profile.org_id);
        break;
      default:
        throw new Error(`Unknown template: ${report.template_id}`);
    }

    // Update last generated timestamp
    await supabaseClient
      .from('custom_reports')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', reportId);

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          id: reportId,
          name: report.name,
          template: report.template_id,
          generated_at: new Date().toISOString(),
          data: reportData,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function generateExecutiveSummary(supabase: any, orgId: string) {
  const { data: metrics } = await supabase.rpc('get_dashboard_metrics_fast', {
    p_org_id: orgId,
  });

  const { data: scores } = await supabase
    .from('scores')
    .select('overall, fit, intent, reachability')
    .eq('org_id', orgId);

  return {
    metrics,
    averageScores: {
      overall: scores?.reduce((sum, s) => sum + s.overall, 0) / (scores?.length || 1),
      fit: scores?.reduce((sum, s) => sum + s.fit, 0) / (scores?.length || 1),
      intent: scores?.reduce((sum, s) => sum + s.intent, 0) / (scores?.length || 1),
      reachability: scores?.reduce((sum, s) => sum + s.reachability, 0) / (scores?.length || 1),
    },
  };
}

async function generateAccountPerformance(supabase: any, orgId: string) {
  const { data: accounts } = await supabase
    .from('accounts')
    .select(`
      external_id,
      name,
      industry_norm,
      employee_count,
      revenue_range,
      country,
      scores (overall, fit, intent, reachability)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  return { accounts };
}

async function generateICPAnalysis(supabase: any, orgId: string) {
  const { data: icps } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('org_id', orgId);

  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('org_id', orgId)
    .gte('fit', 70);

  return { icps, highFitCount: scores?.length || 0 };
}

async function generateDataQuality(supabase: any, orgId: string) {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('org_id', orgId);

  const total = accounts?.length || 0;
  const withIndustry = accounts?.filter(a => a.industry_norm)?.length || 0;
  const withSize = accounts?.filter(a => a.employee_count)?.length || 0;
  const withRevenue = accounts?.filter(a => a.revenue_range)?.length || 0;
  const withCountry = accounts?.filter(a => a.country)?.length || 0;

  return {
    totalAccounts: total,
    completeness: {
      industry: (withIndustry / total) * 100,
      size: (withSize / total) * 100,
      revenue: (withRevenue / total) * 100,
      country: (withCountry / total) * 100,
      overall: ((withIndustry + withSize + withRevenue + withCountry) / (total * 4)) * 100,
    },
  };
}

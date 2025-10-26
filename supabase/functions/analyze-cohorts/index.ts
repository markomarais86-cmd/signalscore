import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) throw new Error('Organization not found');

    console.log(`Analyzing cohorts for org ${profile.org_id}`);

    // Get all accounts with creation dates
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('accounts')
      .select('external_id, created_at')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: true });

    if (accountsError) throw accountsError;

    // Get scores for these accounts
    const { data: scores, error: scoresError } = await supabaseClient
      .from('scores')
      .select('account_external_id, overall, fit')
      .eq('org_id', profile.org_id);

    if (scoresError) throw scoresError;

    // Get closed won deals
    const { data: deals, error: dealsError } = await supabaseClient
      .from('closed_won_deals')
      .select('account_external_id, deal_amount, closed_date')
      .eq('org_id', profile.org_id);

    if (dealsError) throw dealsError;

    // Group accounts by cohort month
    const cohorts: Record<string, any> = {};

    accounts?.forEach(account => {
      const cohortMonth = new Date(account.created_at).toISOString().slice(0, 7); // YYYY-MM
      
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = {
          cohortMonth,
          accountCount: 0,
          accountIds: [],
          totalRevenue: 0,
          conversionCount: 0,
        };
      }

      cohorts[cohortMonth].accountCount++;
      cohorts[cohortMonth].accountIds.push(account.external_id);
    });

    // Calculate metrics for each cohort
    const cohortData = Object.values(cohorts).map((cohort: any) => {
      // Calculate conversion rate
      const conversions = deals?.filter(d => 
        cohort.accountIds.includes(d.account_external_id)
      ) || [];

      const totalRevenue = conversions.reduce((sum, d) => 
        sum + (d.deal_amount || 0), 0
      );

      const avgLTV = conversions.length > 0 ? totalRevenue / conversions.length : 0;
      const conversionRate = (conversions.length / cohort.accountCount) * 100;

      // Calculate retention (accounts still active with high scores)
      const activeAccounts = scores?.filter(s => 
        cohort.accountIds.includes(s.account_external_id) && s.overall >= 60
      ) || [];

      const retentionRate = (activeAccounts.length / cohort.accountCount) * 100;

      return {
        cohortMonth: cohort.cohortMonth,
        accountCount: cohort.accountCount,
        conversionCount: conversions.length,
        conversionRate: Math.round(conversionRate * 10) / 10,
        retentionRate: Math.round(retentionRate * 10) / 10,
        avgLTV: Math.round(avgLTV),
        totalRevenue: Math.round(totalRevenue),
      };
    });

    // Sort by cohort month descending
    cohortData.sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));

    // Calculate overall metrics
    const totalAccounts = cohortData.reduce((sum, c) => sum + c.accountCount, 0);
    const totalConversions = cohortData.reduce((sum, c) => sum + c.conversionCount, 0);
    const totalRevenue = cohortData.reduce((sum, c) => sum + c.totalRevenue, 0);
    const avgRetention = cohortData.reduce((sum, c) => sum + c.retentionRate, 0) / cohortData.length;
    const avgLTV = totalConversions > 0 ? totalRevenue / totalConversions : 0;

    // Find top performing cohort
    const topCohort = cohortData.reduce((best, current) => 
      current.conversionRate > best.conversionRate ? current : best
    , cohortData[0] || { cohortMonth: 'N/A', conversionRate: 0 });

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          cohorts: cohortData.slice(0, 12), // Last 12 months
          avgLtv: Math.round(avgLTV),
          avgRetention: Math.round(avgRetention * 10) / 10,
          topCohort: topCohort.cohortMonth,
          totalCohorts: cohortData.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error analyzing cohorts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

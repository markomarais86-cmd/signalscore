import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CohortData {
  cohortMonth: string;
  accountCount: number;
  retentionRates: Record<string, number>;
  ltv: number;
  conversionRate: number;
}

interface CohortMetrics {
  cohorts: CohortData[];
  avgLtv: number;
  avgRetention: number;
  topCohort: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cohort-metrics] Fetching metrics for org: ${orgId}`);

    // Get scores for account dates
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('account_external_id, computed_at')
      .eq('org_id', orgId);

    if (scoresError) throw scoresError;

    // Get accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, external_id')
      .eq('org_id', orgId);

    if (accountsError) throw accountsError;

    // Map accounts with their first score date
    const accountsWithDates = accounts?.map(acc => {
      const firstScore = scores?.find(s => s.account_external_id === acc.external_id);
      return {
        ...acc,
        created_at: firstScore?.computed_at || new Date().toISOString()
      };
    }) || [];

    // Get closed won deals
    const { data: deals, error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('account_external_id, deal_value, close_date')
      .eq('org_id', orgId);

    if (dealsError) throw dealsError;

    // Group accounts by month
    const cohortMap = new Map<string, CohortData>();

    accountsWithDates.forEach(account => {
      const cohortMonth = new Date(account.created_at).toISOString().slice(0, 7);
      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, {
          cohortMonth,
          accountCount: 0,
          retentionRates: {},
          ltv: 0,
          conversionRate: 0,
        });
      }
      const cohort = cohortMap.get(cohortMonth)!;
      cohort.accountCount++;
    });

    // Calculate LTV and conversion for each cohort
    deals?.forEach(deal => {
      const account = accountsWithDates.find(a => a.external_id === deal.account_external_id);
      if (account) {
        const cohortMonth = new Date(account.created_at).toISOString().slice(0, 7);
        const cohort = cohortMap.get(cohortMonth);
        if (cohort) {
          cohort.ltv += Number(deal.deal_value);
        }
      }
    });

    // Calculate averages
    const cohorts = Array.from(cohortMap.values()).sort((a, b) =>
      b.cohortMonth.localeCompare(a.cohortMonth)
    );

    cohorts.forEach(cohort => {
      if (cohort.accountCount > 0) {
        cohort.ltv = cohort.ltv / cohort.accountCount;
        const accountsWithDeals = deals?.filter(d => {
          const acc = accountsWithDates.find(a => a.external_id === d.account_external_id);
          return acc && new Date(acc.created_at).toISOString().slice(0, 7) === cohort.cohortMonth;
        }).length || 0;
        cohort.conversionRate = (accountsWithDeals / cohort.accountCount) * 100;
      }
    });

    const avgLtv = cohorts.reduce((sum, c) => sum + c.ltv, 0) / (cohorts.length || 1);
    const avgRetention = cohorts.reduce((sum, c) => sum + c.conversionRate, 0) / (cohorts.length || 1);
    const topCohort = cohorts.reduce((top, c) => c.ltv > top.ltv ? c : top, cohorts[0] || { ltv: 0, cohortMonth: 'N/A' });

    const metrics: CohortMetrics = {
      cohorts,
      avgLtv,
      avgRetention,
      topCohort: topCohort.cohortMonth,
    };

    console.log(`[cohort-metrics] Returning ${cohorts.length} cohorts for org: ${orgId}`);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[cohort-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

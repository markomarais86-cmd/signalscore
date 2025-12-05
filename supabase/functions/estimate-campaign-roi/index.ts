import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      accountCount, 
      avgFitScore, 
      dataSource, 
      provider,
      orgId,
      leadCount
    } = await req.json();

    console.log('[estimate-campaign-roi] Request:', { accountCount, avgFitScore, dataSource, provider, orgId, leadCount });

    // Get historical closed-won deals with their account scores
    const { data: historicalDeals } = await supabase
      .from('closed_won_deals')
      .select('deal_value, account_external_id, sales_cycle_days')
      .eq('org_id', orgId);

    // Get scores for closed-won accounts to calculate actual conversion rates
    const closedWonAccountIds = historicalDeals?.map(d => d.account_external_id) || [];
    
    const { data: closedWonScores } = await supabase
      .from('scores')
      .select('account_external_id, overall, fit')
      .eq('org_id', orgId)
      .in('account_external_id', closedWonAccountIds);

    // Get total accounts by score band to calculate actual conversion rates
    const { data: allScores } = await supabase
      .from('scores')
      .select('account_external_id, overall')
      .eq('org_id', orgId);

    // Calculate conversion rates by score band using actual closed-won data
    const scoreBands = {
      A: { min: 70, max: 100, total: 0, closedWon: 0 },
      B: { min: 40, max: 69, total: 0, closedWon: 0 },
      C: { min: 0, max: 39, total: 0, closedWon: 0 }
    };

    // Count total accounts per band
    allScores?.forEach(score => {
      const s = score.overall || 0;
      if (s >= 70) scoreBands.A.total++;
      else if (s >= 40) scoreBands.B.total++;
      else scoreBands.C.total++;
    });

    // Create map of closed-won account IDs
    const closedWonSet = new Set(closedWonAccountIds);

    // Count closed-won per band
    closedWonScores?.forEach(score => {
      if (closedWonSet.has(score.account_external_id)) {
        const s = score.overall || 0;
        if (s >= 70) scoreBands.A.closedWon++;
        else if (s >= 40) scoreBands.B.closedWon++;
        else scoreBands.C.closedWon++;
      }
    });

    // Calculate actual conversion rates from your data
    const bandRates = {
      A: scoreBands.A.total > 0 ? scoreBands.A.closedWon / scoreBands.A.total : 0.12,
      B: scoreBands.B.total > 0 ? scoreBands.B.closedWon / scoreBands.B.total : 0.06,
      C: scoreBands.C.total > 0 ? scoreBands.C.closedWon / scoreBands.C.total : 0.02
    };

    // Use actual rates if we have enough data, otherwise use defaults
    const hasEnoughData = (historicalDeals?.length || 0) >= 10;
    let conversionRate: number;
    
    if (hasEnoughData) {
      // Weight the conversion rate based on average fit score
      if (avgFitScore >= 70) conversionRate = bandRates.A;
      else if (avgFitScore >= 40) conversionRate = bandRates.B;
      else conversionRate = bandRates.C;
    } else {
      // Fallback to industry benchmarks
      if (avgFitScore >= 80) conversionRate = 0.12;
      else if (avgFitScore >= 60) conversionRate = 0.08;
      else if (avgFitScore >= 40) conversionRate = 0.05;
      else conversionRate = 0.02;
    }

    // Calculate average deal value and sales cycle from actual data
    const avgDealValue = historicalDeals?.length 
      ? historicalDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0) / historicalDeals.length
      : 50000;

    const avgSalesCycle = historicalDeals?.length
      ? Math.round(historicalDeals.reduce((sum, d) => sum + (d.sales_cycle_days || 90), 0) / historicalDeals.length)
      : 90;

    // Calculate enrichment costs
    let enrichmentCost = 0;
    if (dataSource === 'database') {
      const costPerContact = provider === 'apollo' ? 0.50 : provider === 'zoominfo' ? 0.75 : 1.00;
      const estimatedContactsPerAccount = 3;
      enrichmentCost = accountCount * estimatedContactsPerAccount * costPerContact;
    }

    // Use actual lead count if provided
    const contactsToReach = leadCount || accountCount * 3;

    // Calculate projections using smarter rates
    const meetingRate = avgFitScore >= 70 ? 0.15 : avgFitScore >= 40 ? 0.10 : 0.05;
    const estimatedMeetings = Math.round(contactsToReach * meetingRate);
    const closeRate = hasEnoughData ? conversionRate : 0.25;
    const estimatedDeals = Math.round(estimatedMeetings * closeRate);
    const estimatedRevenue = estimatedDeals * avgDealValue;
    const roi = enrichmentCost > 0 ? ((estimatedRevenue - enrichmentCost) / enrichmentCost) * 100 : 0;
    const costPerLead = enrichmentCost > 0 ? enrichmentCost / contactsToReach : 0;

    // Calculate confidence based on data quality
    const dataPoints = (historicalDeals?.length || 0) + (allScores?.length || 0);
    let confidence: string;
    if (dataPoints > 100 && historicalDeals!.length >= 20) confidence = 'high';
    else if (dataPoints > 50 && historicalDeals!.length >= 10) confidence = 'medium';
    else confidence = 'low';

    const projection = {
      totalCost: enrichmentCost,
      costPerLead,
      estimatedMeetings,
      estimatedDeals,
      estimatedRevenue,
      roi,
      conversionRate,
      avgDealValue,
      avgSalesCycle,
      confidence,
      dataQuality: {
        closedWonDeals: historicalDeals?.length || 0,
        totalScoredAccounts: allScores?.length || 0,
        hasEnoughData,
        conversionByBand: hasEnoughData ? {
          A: `${(bandRates.A * 100).toFixed(1)}%`,
          B: `${(bandRates.B * 100).toFixed(1)}%`,
          C: `${(bandRates.C * 100).toFixed(1)}%`
        } : null
      }
    };

    console.log('[estimate-campaign-roi] Projection:', projection);

    return new Response(
      JSON.stringify(projection),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[estimate-campaign-roi] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

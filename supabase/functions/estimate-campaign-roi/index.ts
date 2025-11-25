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
      orgId 
    } = await req.json();

    console.log('[estimate-campaign-roi] Request:', { accountCount, avgFitScore, dataSource, provider, orgId });

    // Get historical conversion rates by fit score band
    const { data: historicalDeals } = await supabase
      .from('closed_won_deals')
      .select('deal_value, account_external_id')
      .eq('org_id', orgId);

    const { data: scoredAccounts } = await supabase
      .from('scores')
      .select('account_external_id, overall_score')
      .eq('org_id', orgId)
      .in('account_external_id', historicalDeals?.map(d => d.account_external_id) || []);

    // Calculate conversion rate by fit score
    let conversionRate = 0.05; // Default 5%
    if (avgFitScore >= 80) conversionRate = 0.12;
    else if (avgFitScore >= 60) conversionRate = 0.08;
    else if (avgFitScore >= 40) conversionRate = 0.05;
    else conversionRate = 0.02;

    // Calculate average deal value
    const avgDealValue = historicalDeals?.length 
      ? historicalDeals.reduce((sum, d) => sum + d.deal_value, 0) / historicalDeals.length
      : 50000; // Default $50K

    // Calculate enrichment costs
    let enrichmentCost = 0;
    if (dataSource === 'database') {
      const costPerContact = provider === 'apollo' ? 0.50 : provider === 'zoominfo' ? 0.75 : 1.00;
      const estimatedContactsPerAccount = 3;
      enrichmentCost = accountCount * estimatedContactsPerAccount * costPerContact;
    }

    // Calculate projections
    const estimatedMeetings = Math.round(accountCount * conversionRate * 0.3); // 30% meeting rate
    const estimatedDeals = Math.round(estimatedMeetings * 0.25); // 25% close rate
    const estimatedRevenue = estimatedDeals * avgDealValue;
    const roi = enrichmentCost > 0 ? ((estimatedRevenue - enrichmentCost) / enrichmentCost) * 100 : 0;
    const costPerLead = enrichmentCost / accountCount;

    const projection = {
      totalCost: enrichmentCost,
      costPerLead,
      estimatedMeetings,
      estimatedDeals,
      estimatedRevenue,
      roi,
      conversionRate,
      avgDealValue,
      confidence: scoredAccounts?.length > 20 ? 'high' : scoredAccounts?.length > 10 ? 'medium' : 'low'
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

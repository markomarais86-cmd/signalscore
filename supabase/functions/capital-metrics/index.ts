import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CapitalMetrics {
  totalInvestment: number;
  salesInvestment: number;
  marketingInvestment: number;
  pipelineValue: number;
  revenueGenerated: number;
  pipelineMultiplier: number;
  revenueMultiplier: number;
  cac: number;
  roas: number;
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

    console.log(`[capital-metrics] Fetching metrics for org: ${orgId}`);

    // Fetch the most recent capital tracking record
    const { data: tracking, error: trackingError } = await supabase
      .from('capital_tracking')
      .select('*')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (trackingError && trackingError.code !== 'PGRST116') {
      console.error('[capital-metrics] Error fetching tracking:', trackingError);
      throw trackingError;
    }

    let metrics: CapitalMetrics;

    if (tracking) {
      const totalInvestment = tracking.total_investment || 0;
      const pipelineValue = tracking.pipeline_value || 0;
      const revenueGenerated = tracking.revenue_generated || 0;

      metrics = {
        totalInvestment,
        salesInvestment: tracking.sales_investment || 0,
        marketingInvestment: tracking.marketing_investment || 0,
        pipelineValue,
        revenueGenerated,
        pipelineMultiplier: totalInvestment > 0 ? pipelineValue / totalInvestment : 0,
        revenueMultiplier: totalInvestment > 0 ? revenueGenerated / totalInvestment : 0,
        cac: tracking.cac || 0,
        roas: tracking.roas || 0,
      };
    } else {
      // Return default empty metrics
      metrics = {
        totalInvestment: 0,
        salesInvestment: 0,
        marketingInvestment: 0,
        pipelineValue: 0,
        revenueGenerated: 0,
        pipelineMultiplier: 0,
        revenueMultiplier: 0,
        cac: 0,
        roas: 0,
      };
    }

    console.log(`[capital-metrics] Returning metrics for org: ${orgId}`);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[capital-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

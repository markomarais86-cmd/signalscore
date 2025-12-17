import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PipelineStage {
  stage: string;
  count: number;
  conversionRate: number;
  avgDuration: number;
}

interface PipelineMetrics {
  stages: PipelineStage[];
  totalLeads: number;
  overallConversion: number;
  avgCycleTime: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[pipeline-metrics] Computing metrics for org: ${orgId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pipeline stages data
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('stage, duration_hours, entered_at')
      .eq('org_id', orgId);

    if (stagesError) {
      console.error('[pipeline-metrics] Error fetching stages:', stagesError);
      throw new Error(stagesError.message);
    }

    // Define stage order for conversion calculations
    const stageOrder = ['dial', 'connect', 'meeting', 'opportunity', 'closed_won'];
    
    // Compute stage counts and durations
    const stageCounts: Record<string, number> = {};
    const stageDurations: Record<string, number[]> = {};

    (stages || []).forEach((s) => {
      stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
      if (s.duration_hours) {
        if (!stageDurations[s.stage]) stageDurations[s.stage] = [];
        stageDurations[s.stage].push(s.duration_hours);
      }
    });

    // Build stage metrics with conversion rates
    const stageMetrics: PipelineStage[] = stageOrder.map((stage, idx) => {
      const count = stageCounts[stage] || 0;
      const prevCount = idx > 0 ? (stageCounts[stageOrder[idx - 1]] || 0) : count;
      const conversionRate = prevCount > 0 ? (count / prevCount) * 100 : 0;
      const durations = stageDurations[stage] || [];
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      return {
        stage,
        count,
        conversionRate: idx === 0 ? 100 : conversionRate,
        avgDuration,
      };
    });

    // Calculate aggregate metrics
    const totalLeads = stageCounts['dial'] || 0;
    const closedWon = stageCounts['closed_won'] || 0;
    const overallConversion = totalLeads > 0 ? (closedWon / totalLeads) * 100 : 0;

    // Calculate average cycle time across all stages
    const allDurations = Object.values(stageDurations).flat();
    const avgCycleTime = allDurations.length > 0
      ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
      : 0;

    const metrics: PipelineMetrics = {
      stages: stageMetrics,
      totalLeads,
      overallConversion,
      avgCycleTime,
    };

    console.log(`[pipeline-metrics] Computed metrics: ${totalLeads} leads, ${closedWon} closed, ${overallConversion.toFixed(1)}% conversion`);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[pipeline-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

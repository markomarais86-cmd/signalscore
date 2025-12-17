import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

interface TrendMetrics {
  scoreHistory: TrendPoint[];
  fitScoreHistory: TrendPoint[];
  intentScoreHistory: TrendPoint[];
  reachabilityHistory: TrendPoint[];
  dataQualityHistory: TrendPoint[];
  icpMatchHistory: TrendPoint[];
  pipelineVelocity: TrendPoint[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orgId, days = 90 } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trend-metrics] Fetching ${days}-day trends for org: ${orgId}`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch score history
    const { data: scoreHistory, error: scoreError } = await supabase
      .from('score_history')
      .select('computed_at, overall_score, fit_score, intent_score, reachability_score')
      .eq('org_id', orgId)
      .gte('computed_at', startDate.toISOString())
      .order('computed_at', { ascending: true });

    if (scoreError) throw scoreError;

    // Fetch data quality history
    const { data: dataQuality, error: qualityError } = await supabase
      .from('data_quality_history')
      .select('created_at, overall_completeness, high_fit_accounts, total_accounts')
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (qualityError) throw qualityError;

    // Fetch pipeline stages for velocity
    const { data: pipelineStages, error: pipelineError } = await supabase
      .from('pipeline_stages')
      .select('entered_at, stage_name')
      .eq('org_id', orgId)
      .gte('entered_at', startDate.toISOString())
      .order('entered_at', { ascending: true });

    if (pipelineError) throw pipelineError;

    // Process score history into daily aggregates
    const scoreByDay = new Map<string, { overall: number[], fit: number[], intent: number[], reach: number[] }>();
    
    scoreHistory?.forEach(record => {
      const day = record.computed_at.slice(0, 10);
      if (!scoreByDay.has(day)) {
        scoreByDay.set(day, { overall: [], fit: [], intent: [], reach: [] });
      }
      const dayData = scoreByDay.get(day)!;
      if (record.overall_score != null) dayData.overall.push(record.overall_score);
      if (record.fit_score != null) dayData.fit.push(record.fit_score);
      if (record.intent_score != null) dayData.intent.push(record.intent_score);
      if (record.reachability_score != null) dayData.reach.push(record.reachability_score);
    });

    const scoreHistoryPoints: TrendPoint[] = [];
    const fitScoreHistory: TrendPoint[] = [];
    const intentScoreHistory: TrendPoint[] = [];
    const reachabilityHistory: TrendPoint[] = [];

    scoreByDay.forEach((data, day) => {
      if (data.overall.length > 0) {
        scoreHistoryPoints.push({ date: day, value: data.overall.reduce((a, b) => a + b, 0) / data.overall.length });
      }
      if (data.fit.length > 0) {
        fitScoreHistory.push({ date: day, value: data.fit.reduce((a, b) => a + b, 0) / data.fit.length });
      }
      if (data.intent.length > 0) {
        intentScoreHistory.push({ date: day, value: data.intent.reduce((a, b) => a + b, 0) / data.intent.length });
      }
      if (data.reach.length > 0) {
        reachabilityHistory.push({ date: day, value: data.reach.reduce((a, b) => a + b, 0) / data.reach.length });
      }
    });

    // Process data quality history
    const dataQualityHistory: TrendPoint[] = dataQuality?.map(record => ({
      date: record.created_at.slice(0, 10),
      value: record.overall_completeness || 0,
    })) || [];

    const icpMatchHistory: TrendPoint[] = dataQuality?.map(record => ({
      date: record.created_at.slice(0, 10),
      value: record.total_accounts > 0 ? (record.high_fit_accounts / record.total_accounts) * 100 : 0,
    })) || [];

    // Process pipeline velocity (entries per day)
    const velocityByDay = new Map<string, number>();
    pipelineStages?.forEach(stage => {
      const day = stage.entered_at.slice(0, 10);
      velocityByDay.set(day, (velocityByDay.get(day) || 0) + 1);
    });

    const pipelineVelocity: TrendPoint[] = Array.from(velocityByDay.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const metrics: TrendMetrics = {
      scoreHistory: scoreHistoryPoints,
      fitScoreHistory,
      intentScoreHistory,
      reachabilityHistory,
      dataQualityHistory,
      icpMatchHistory,
      pipelineVelocity,
    };

    console.log(`[trend-metrics] Returning trends for org: ${orgId}`);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[trend-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

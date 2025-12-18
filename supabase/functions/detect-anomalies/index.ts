import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnomalyRule {
  id: string;
  org_id: string;
  name: string;
  metric_name: string;
  comparison: string;
  threshold: number;
  lookback_days: number;
  severity: string;
}

interface MetricData {
  current: number;
  previous: number;
  change_percent: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DetectAnomalies] Starting anomaly detection for org: ${org_id}`);

    // Fetch active anomaly rules for this org
    const { data: rules, error: rulesError } = await supabase
      .from("anomaly_rules")
      .select("*")
      .eq("org_id", org_id)
      .eq("is_active", true);

    if (rulesError) {
      throw new Error(`Failed to fetch rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active rules", anomalies_detected: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute current metrics
    const metrics = await computeMetrics(supabase, org_id);
    const detectedAnomalies: any[] = [];

    for (const rule of rules as AnomalyRule[]) {
      const metricData = metrics[rule.metric_name];
      if (!metricData) continue;

      const isAnomaly = checkAnomaly(rule, metricData);
      
      if (isAnomaly) {
        console.log(`[DetectAnomalies] Anomaly detected: ${rule.name}`);
        
        // Generate AI explanation
        const explanation = await generateExplanation(supabase, rule, metricData);
        
        // Insert detected anomaly
        const { data: anomaly, error: insertError } = await supabase
          .from("detected_anomalies")
          .insert({
            org_id,
            rule_id: rule.id,
            metric_name: rule.metric_name,
            metric_value: metricData.current,
            expected_value: metricData.previous,
            deviation_percent: metricData.change_percent,
            severity: rule.severity,
            explanation: explanation.explanation,
            ai_recommendation: explanation.recommendation,
          })
          .select()
          .single();

        if (!insertError && anomaly) {
          detectedAnomalies.push(anomaly);
          
          // Trigger alert if critical
          if (rule.severity === "critical") {
            await triggerAlert(supabase, org_id, rule, anomaly);
          }
        }
      }
    }

    console.log(`[DetectAnomalies] Detection complete. Found ${detectedAnomalies.length} anomalies`);

    return new Response(
      JSON.stringify({
        success: true,
        anomalies_detected: detectedAnomalies.length,
        anomalies: detectedAnomalies,
        metrics_checked: Object.keys(metrics).length,
        rules_evaluated: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DetectAnomalies] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function computeMetrics(supabase: any, org_id: string): Promise<Record<string, MetricData>> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get current period deals
  const { data: currentDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .gte("created_at", oneWeekAgo.toISOString());

  // Get previous period deals
  const { data: previousDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .gte("created_at", twoWeeksAgo.toISOString())
    .lt("created_at", oneWeekAgo.toISOString());

  // Calculate metrics
  const currentWins = currentDeals?.filter((d: any) => d.status === "won").length || 0;
  const currentTotal = currentDeals?.length || 1;
  const previousWins = previousDeals?.filter((d: any) => d.status === "won").length || 0;
  const previousTotal = previousDeals?.length || 1;

  const currentWinRate = (currentWins / currentTotal) * 100;
  const previousWinRate = (previousWins / previousTotal) * 100;

  const currentPipelineValue = currentDeals?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
  const previousPipelineValue = previousDeals?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 1;

  // Get average cycle length from closed deals
  const { data: closedDeals } = await supabase
    .from("deals")
    .select("created_at, closed_date")
    .eq("org_id", org_id)
    .not("closed_date", "is", null)
    .gte("closed_date", oneWeekAgo.toISOString());

  const currentCycleLength = calculateAvgCycleLength(closedDeals || []);
  
  const { data: previousClosedDeals } = await supabase
    .from("deals")
    .select("created_at, closed_date")
    .eq("org_id", org_id)
    .not("closed_date", "is", null)
    .gte("closed_date", twoWeeksAgo.toISOString())
    .lt("closed_date", oneWeekAgo.toISOString());

  const previousCycleLength = calculateAvgCycleLength(previousClosedDeals || []) || 30;

  // Get conversion rate from pipeline stages
  const { data: stageHistory } = await supabase
    .from("deal_stage_history")
    .select("*")
    .eq("org_id", org_id)
    .gte("entered_at", oneWeekAgo.toISOString());

  const conversions = stageHistory?.length || 0;
  
  const { data: previousStageHistory } = await supabase
    .from("deal_stage_history")
    .select("*")
    .eq("org_id", org_id)
    .gte("entered_at", twoWeeksAgo.toISOString())
    .lt("entered_at", oneWeekAgo.toISOString());

  const previousConversions = previousStageHistory?.length || 1;

  return {
    win_rate: {
      current: currentWinRate,
      previous: previousWinRate,
      change_percent: previousWinRate > 0 ? ((currentWinRate - previousWinRate) / previousWinRate) * 100 : 0,
    },
    pipeline_value: {
      current: currentPipelineValue,
      previous: previousPipelineValue,
      change_percent: ((currentPipelineValue - previousPipelineValue) / previousPipelineValue) * 100,
    },
    avg_cycle_length: {
      current: currentCycleLength,
      previous: previousCycleLength,
      change_percent: ((currentCycleLength - previousCycleLength) / previousCycleLength) * 100,
    },
    conversion_rate: {
      current: conversions,
      previous: previousConversions,
      change_percent: ((conversions - previousConversions) / previousConversions) * 100,
    },
    sales_velocity: {
      current: currentPipelineValue / (currentCycleLength || 30),
      previous: previousPipelineValue / (previousCycleLength || 30),
      change_percent: 0, // Will be calculated
    },
  };
}

function calculateAvgCycleLength(deals: any[]): number {
  if (deals.length === 0) return 0;
  
  const cycleLengths = deals.map((d) => {
    const created = new Date(d.created_at);
    const closed = new Date(d.closed_date);
    return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  });
  
  return cycleLengths.reduce((sum, len) => sum + len, 0) / cycleLengths.length;
}

function checkAnomaly(rule: AnomalyRule, data: MetricData): boolean {
  const changePercent = Math.abs(data.change_percent);
  
  switch (rule.comparison) {
    case "decrease_by":
      return data.change_percent < 0 && changePercent >= rule.threshold;
    case "increase_by":
      return data.change_percent > 0 && changePercent >= rule.threshold;
    case "below":
      return data.current < rule.threshold;
    case "above":
      return data.current > rule.threshold;
    default:
      return false;
  }
}

async function generateExplanation(
  supabase: any,
  rule: AnomalyRule,
  data: MetricData
): Promise<{ explanation: string; recommendation: string }> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!openaiApiKey) {
    return {
      explanation: `${rule.metric_name} changed by ${data.change_percent.toFixed(1)}% (from ${data.previous.toFixed(1)} to ${data.current.toFixed(1)})`,
      recommendation: "Review recent pipeline changes and team activity to identify root causes.",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a sales operations analyst. Provide concise explanations for pipeline anomalies and actionable recommendations.",
          },
          {
            role: "user",
            content: `Anomaly detected: ${rule.name}
Metric: ${rule.metric_name}
Previous value: ${data.previous.toFixed(2)}
Current value: ${data.current.toFixed(2)}
Change: ${data.change_percent.toFixed(1)}%
Threshold: ${rule.comparison} ${rule.threshold}%

Provide a brief explanation of potential causes and one specific recommendation. Format as JSON: {"explanation": "...", "recommendation": "..."}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(content);
      } catch {
        return { explanation: content, recommendation: "Review pipeline data for root causes." };
      }
    }
  } catch (error) {
    console.error("[DetectAnomalies] AI explanation error:", error);
  }

  return {
    explanation: `${rule.metric_name} changed by ${data.change_percent.toFixed(1)}%`,
    recommendation: "Review recent pipeline changes.",
  };
}

async function triggerAlert(supabase: any, org_id: string, rule: AnomalyRule, anomaly: any): Promise<void> {
  try {
    // Check if there's an alert configured for anomalies
    const { data: alerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("org_id", org_id)
      .eq("alert_type", "anomaly_detected")
      .eq("is_active", true);

    if (alerts && alerts.length > 0) {
      // Log to alert history
      await supabase.from("alert_history").insert({
        org_id,
        alert_id: alerts[0].id,
        trigger_value: anomaly.metric_value,
        threshold_value: rule.threshold,
        context_data: { anomaly_id: anomaly.id, rule_name: rule.name },
        notification_sent: true,
        notification_channels: ["in_app"],
      });
    }
  } catch (error) {
    console.error("[DetectAnomalies] Failed to trigger alert:", error);
  }
}

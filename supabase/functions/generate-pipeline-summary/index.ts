import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { org_id, summary_type = "daily" } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GeneratePipelineSummary] Generating ${summary_type} summary for org: ${org_id}`);

    // Gather pipeline data
    const pipelineData = await gatherPipelineData(supabase, org_id);
    
    // Generate AI summary
    const summary = await generateAISummary(pipelineData, summary_type);

    // Store the summary
    const { data: storedSummary, error: storeError } = await supabase
      .from("pipeline_summaries")
      .insert({
        org_id,
        summary_type,
        summary_text: summary.summary_text,
        key_insights: summary.key_insights,
        risks: summary.risks,
        opportunities: summary.opportunities,
        recommended_actions: summary.recommended_actions,
        metrics_snapshot: pipelineData.metrics,
        ai_model: "gpt-4o-mini",
      })
      .select()
      .single();

    if (storeError) {
      console.error("[GeneratePipelineSummary] Failed to store summary:", storeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: storedSummary || summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GeneratePipelineSummary] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function gatherPipelineData(supabase: any, org_id: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get deals data
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("status", "open");

  const { data: recentWins } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("status", "won")
    .gte("closed_date", weekAgo.toISOString());

  const { data: recentLosses } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("status", "lost")
    .gte("closed_date", weekAgo.toISOString());

  // Get activities
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("org_id", org_id)
    .gte("activity_date", weekAgo.toISOString());

  // Get recent anomalies
  const { data: anomalies } = await supabase
    .from("detected_anomalies")
    .select("*")
    .eq("org_id", org_id)
    .eq("acknowledged", false)
    .gte("created_at", weekAgo.toISOString());

  // Get NBA actions
  const { data: pendingActions } = await supabase
    .from("next_best_actions")
    .select("*")
    .eq("org_id", org_id)
    .eq("status", "pending");

  // Calculate metrics
  const totalPipelineValue = deals?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
  const avgDealSize = deals?.length > 0 ? totalPipelineValue / deals.length : 0;
  const winRate = recentWins && recentLosses 
    ? (recentWins.length / (recentWins.length + recentLosses.length)) * 100 
    : 0;

  // Group deals by stage
  const dealsByStage: Record<string, any[]> = {};
  deals?.forEach((d: any) => {
    if (!dealsByStage[d.stage]) dealsByStage[d.stage] = [];
    dealsByStage[d.stage].push(d);
  });

  // Find at-risk deals (no activity in 14 days)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const atRiskDeals = deals?.filter((d: any) => {
    const lastActivity = activities?.find((a: any) => a.deal_id === d.id);
    if (!lastActivity) return true;
    return new Date(lastActivity.activity_date) < twoWeeksAgo;
  }) || [];

  return {
    deals: deals || [],
    recentWins: recentWins || [],
    recentLosses: recentLosses || [],
    activities: activities || [],
    anomalies: anomalies || [],
    pendingActions: pendingActions || [],
    atRiskDeals,
    dealsByStage,
    metrics: {
      total_pipeline_value: totalPipelineValue,
      deal_count: deals?.length || 0,
      avg_deal_size: avgDealSize,
      win_rate: winRate,
      recent_wins: recentWins?.length || 0,
      recent_losses: recentLosses?.length || 0,
      activities_this_week: activities?.length || 0,
      unacknowledged_anomalies: anomalies?.length || 0,
      pending_actions: pendingActions?.length || 0,
      at_risk_deals: atRiskDeals.length,
    },
  };
}

async function generateAISummary(pipelineData: any, summaryType: string) {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  const defaultSummary = {
    summary_text: generateDefaultSummary(pipelineData),
    key_insights: extractDefaultInsights(pipelineData),
    risks: extractDefaultRisks(pipelineData),
    opportunities: extractDefaultOpportunities(pipelineData),
    recommended_actions: generateDefaultActions(pipelineData),
  };

  if (!openaiApiKey) {
    return defaultSummary;
  }

  try {
    const prompt = `You are a sales operations analyst. Generate a ${summaryType} pipeline health summary.

PIPELINE DATA:
- Total Pipeline Value: $${pipelineData.metrics.total_pipeline_value.toLocaleString()}
- Open Deals: ${pipelineData.metrics.deal_count}
- Average Deal Size: $${pipelineData.metrics.avg_deal_size.toLocaleString()}
- Win Rate (last 7 days): ${pipelineData.metrics.win_rate.toFixed(1)}%
- Recent Wins: ${pipelineData.metrics.recent_wins}
- Recent Losses: ${pipelineData.metrics.recent_losses}
- Activities This Week: ${pipelineData.metrics.activities_this_week}
- At-Risk Deals (no activity 14+ days): ${pipelineData.metrics.at_risk_deals}
- Pending NBA Actions: ${pipelineData.metrics.pending_actions}
- Unacknowledged Anomalies: ${pipelineData.metrics.unacknowledged_anomalies}

DEALS BY STAGE:
${Object.entries(pipelineData.dealsByStage).map(([stage, deals]: [string, any]) => 
  `- ${stage}: ${deals.length} deals ($${deals.reduce((s: number, d: any) => s + (d.amount || 0), 0).toLocaleString()})`
).join("\n")}

Generate a JSON response with:
{
  "summary_text": "2-3 paragraph executive summary of pipeline health",
  "key_insights": ["insight1", "insight2", "insight3"],
  "risks": [{"title": "...", "severity": "high|medium|low", "description": "..."}],
  "opportunities": [{"title": "...", "potential_value": number, "description": "..."}],
  "recommended_actions": [{"action": "...", "priority": 1-5, "expected_impact": "..."}]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a sales operations analyst. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        return {
          summary_text: parsed.summary_text || defaultSummary.summary_text,
          key_insights: parsed.key_insights || defaultSummary.key_insights,
          risks: parsed.risks || defaultSummary.risks,
          opportunities: parsed.opportunities || defaultSummary.opportunities,
          recommended_actions: parsed.recommended_actions || defaultSummary.recommended_actions,
        };
      } catch {
        return defaultSummary;
      }
    }
  } catch (error) {
    console.error("[GeneratePipelineSummary] AI error:", error);
  }

  return defaultSummary;
}

function generateDefaultSummary(data: any): string {
  const m = data.metrics;
  return `Your pipeline currently holds ${m.deal_count} open deals worth $${m.total_pipeline_value.toLocaleString()} in total value. ` +
    `Over the past week, you closed ${m.recent_wins} deals while losing ${m.recent_losses}, ` +
    `resulting in a ${m.win_rate.toFixed(1)}% win rate. ` +
    `${m.at_risk_deals > 0 ? `There are ${m.at_risk_deals} at-risk deals that haven't seen activity in over 14 days. ` : ""}` +
    `${m.unacknowledged_anomalies > 0 ? `${m.unacknowledged_anomalies} pipeline anomalies require your attention.` : ""}`;
}

function extractDefaultInsights(data: any): string[] {
  const insights: string[] = [];
  const m = data.metrics;
  
  if (m.win_rate > 30) insights.push(`Strong win rate of ${m.win_rate.toFixed(1)}% this week`);
  if (m.activities_this_week > 50) insights.push(`High activity level with ${m.activities_this_week} touchpoints`);
  if (m.avg_deal_size > 10000) insights.push(`Healthy average deal size of $${m.avg_deal_size.toLocaleString()}`);
  if (insights.length === 0) insights.push("Pipeline metrics are within normal ranges");
  
  return insights;
}

function extractDefaultRisks(data: any): any[] {
  const risks: any[] = [];
  const m = data.metrics;
  
  if (m.at_risk_deals > 0) {
    risks.push({
      title: "Stalled Deals",
      severity: m.at_risk_deals > 5 ? "high" : "medium",
      description: `${m.at_risk_deals} deals have no activity in 14+ days`,
    });
  }
  
  if (m.unacknowledged_anomalies > 0) {
    risks.push({
      title: "Unaddressed Anomalies",
      severity: "medium",
      description: `${m.unacknowledged_anomalies} pipeline anomalies need review`,
    });
  }
  
  if (m.win_rate < 20) {
    risks.push({
      title: "Low Win Rate",
      severity: "high",
      description: `Current win rate of ${m.win_rate.toFixed(1)}% is below target`,
    });
  }
  
  return risks;
}

function extractDefaultOpportunities(data: any): any[] {
  const opportunities: any[] = [];
  
  if (data.pendingActions.length > 0) {
    const highPriorityActions = data.pendingActions.filter((a: any) => a.priority <= 2);
    if (highPriorityActions.length > 0) {
      opportunities.push({
        title: "High-Priority Actions",
        potential_value: 0,
        description: `${highPriorityActions.length} high-priority next best actions are ready to execute`,
      });
    }
  }
  
  // Find deals close to closing
  const closingDeals = data.deals.filter((d: any) => 
    ["negotiation", "proposal", "closing"].includes(d.stage?.toLowerCase())
  );
  
  if (closingDeals.length > 0) {
    const closingValue = closingDeals.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    opportunities.push({
      title: "Near-Close Pipeline",
      potential_value: closingValue,
      description: `${closingDeals.length} deals in late stages worth $${closingValue.toLocaleString()}`,
    });
  }
  
  return opportunities;
}

function generateDefaultActions(data: any): any[] {
  const actions: any[] = [];
  const m = data.metrics;
  
  if (m.at_risk_deals > 0) {
    actions.push({
      action: "Review and re-engage stalled deals",
      priority: 1,
      expected_impact: "Prevent deal slippage and potential losses",
    });
  }
  
  if (m.pending_actions > 0) {
    actions.push({
      action: "Execute pending next best actions",
      priority: 2,
      expected_impact: "Accelerate pipeline velocity",
    });
  }
  
  if (m.unacknowledged_anomalies > 0) {
    actions.push({
      action: "Acknowledge and address pipeline anomalies",
      priority: 2,
      expected_impact: "Early intervention on potential issues",
    });
  }
  
  actions.push({
    action: "Schedule pipeline review with team",
    priority: 3,
    expected_impact: "Align team on priorities and blockers",
  });
  
  return actions;
}

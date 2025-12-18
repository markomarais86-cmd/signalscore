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

    const { org_id, user_id } = await req.json();

    if (!org_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateCoachingInsights] Generating insights for user: ${user_id}`);

    // Get rep's recent performance
    const { data: recentPerformance } = await supabase
      .from("rep_performance")
      .select("*")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .order("period_end", { ascending: false })
      .limit(3);

    // Get rep's call insights
    const { data: callInsights } = await supabase
      .from("call_insights")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get team performance for comparison
    const { data: teamPerformance } = await supabase
      .from("rep_performance")
      .select("*")
      .eq("org_id", org_id)
      .order("period_end", { ascending: false })
      .limit(50);

    // Get existing recommendations
    const { data: existingRecs } = await supabase
      .from("coaching_recommendations")
      .select("*")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .limit(10);

    // Generate AI insights
    const insights = await generateAIInsights(recentPerformance, callInsights, teamPerformance, existingRecs);

    // Store new recommendations
    if (insights.new_recommendations && insights.new_recommendations.length > 0) {
      await supabase.from("coaching_recommendations").insert(
        insights.new_recommendations.map((rec: any) => ({
          org_id,
          user_id,
          ...rec,
        }))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        insights,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GenerateCoachingInsights] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAIInsights(
  recentPerformance: any[],
  callInsights: any[],
  teamPerformance: any[],
  existingRecs: any[]
): Promise<any> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  // Calculate basic insights without AI
  const defaultInsights = generateDefaultInsights(recentPerformance, callInsights, teamPerformance);

  if (!openaiApiKey) {
    return defaultInsights;
  }

  // Get AI-enhanced insights
  const currentMetrics = recentPerformance?.[0] || {};
  const previousMetrics = recentPerformance?.[1] || {};

  // Calculate team averages
  const teamAverages: Record<string, number> = {};
  if (teamPerformance && teamPerformance.length > 0) {
    const latestPeriodEnd = teamPerformance[0]?.period_end;
    const latestTeamData = teamPerformance.filter(p => p.period_end === latestPeriodEnd);
    
    if (latestTeamData.length > 0) {
      teamAverages.win_rate = latestTeamData.reduce((s, p) => s + (p.win_rate || 0), 0) / latestTeamData.length;
      teamAverages.calls_made = latestTeamData.reduce((s, p) => s + (p.calls_made || 0), 0) / latestTeamData.length;
      teamAverages.meetings_booked = latestTeamData.reduce((s, p) => s + (p.meetings_booked || 0), 0) / latestTeamData.length;
      teamAverages.deals_won = latestTeamData.reduce((s, p) => s + (p.deals_won || 0), 0) / latestTeamData.length;
    }
  }

  // Summarize call patterns
  const callPatterns = {
    positive_sentiment: callInsights?.filter(c => c.sentiment === "positive").length || 0,
    negative_sentiment: callInsights?.filter(c => c.sentiment === "negative").length || 0,
    objections_detected: callInsights?.filter(c => c.objections?.length > 0).length || 0,
    action_items_generated: callInsights?.reduce((s, c) => s + (c.action_items?.length || 0), 0) || 0,
  };

  const prompt = `As a sales coach, analyze this sales rep's performance and provide coaching insights.

CURRENT PERIOD METRICS:
- Win Rate: ${currentMetrics.win_rate?.toFixed(1) || "N/A"}%
- Calls Made: ${currentMetrics.calls_made || 0}
- Meetings Booked: ${currentMetrics.meetings_booked || 0}
- Deals Won: ${currentMetrics.deals_won || 0}
- Revenue Closed: $${currentMetrics.revenue_closed?.toLocaleString() || 0}

PREVIOUS PERIOD METRICS:
- Win Rate: ${previousMetrics.win_rate?.toFixed(1) || "N/A"}%
- Deals Won: ${previousMetrics.deals_won || 0}

TEAM AVERAGES:
- Win Rate: ${teamAverages.win_rate?.toFixed(1) || "N/A"}%
- Calls: ${teamAverages.calls_made?.toFixed(0) || "N/A"}
- Meetings: ${teamAverages.meetings_booked?.toFixed(0) || "N/A"}

CALL PATTERNS (Last 20 calls):
- Positive Sentiment: ${callPatterns.positive_sentiment}
- Negative Sentiment: ${callPatterns.negative_sentiment}
- Calls with Objections: ${callPatterns.objections_detected}
- Action Items Generated: ${callPatterns.action_items_generated}

EXISTING RECOMMENDATIONS (${existingRecs?.length || 0} pending)

Generate coaching insights as JSON:
{
  "summary": "1-2 sentence performance summary",
  "strengths": ["strength1", "strength2"],
  "improvement_areas": ["area1", "area2"],
  "trend": "improving|stable|declining",
  "new_recommendations": [
    {
      "topic": "...",
      "recommendation": "specific actionable advice",
      "priority": 1-5,
      "category": "discovery|closing|activity|objection_handling"
    }
  ],
  "suggested_focus": "What to focus on this week"
}`;

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
          { role: "system", content: "You are an experienced sales coach. Provide specific, actionable coaching advice. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(content);
      } catch {
        return defaultInsights;
      }
    }
  } catch (error) {
    console.error("[GenerateCoachingInsights] AI error:", error);
  }

  return defaultInsights;
}

function generateDefaultInsights(
  recentPerformance: any[],
  callInsights: any[],
  teamPerformance: any[]
): any {
  const current = recentPerformance?.[0] || {};
  const previous = recentPerformance?.[1] || {};

  const strengths: string[] = [];
  const improvements: string[] = [];
  const recommendations: any[] = [];

  // Analyze performance
  if (current.win_rate > 30) {
    strengths.push("Strong win rate");
  } else if (current.win_rate < 20) {
    improvements.push("Win rate needs improvement");
    recommendations.push({
      topic: "Improve Win Rate",
      recommendation: "Focus on better qualification and understanding customer needs before proposing solutions.",
      priority: 1,
      category: "closing",
    });
  }

  if (current.calls_made > 50) {
    strengths.push("High activity level");
  } else if (current.calls_made < 20) {
    improvements.push("Increase prospecting activity");
    recommendations.push({
      topic: "Increase Activity",
      recommendation: "Block 2 hours daily for dedicated prospecting calls.",
      priority: 2,
      category: "activity",
    });
  }

  // Determine trend
  let trend = "stable";
  if (previous.win_rate && current.win_rate) {
    if (current.win_rate > previous.win_rate * 1.1) trend = "improving";
    if (current.win_rate < previous.win_rate * 0.9) trend = "declining";
  }

  return {
    summary: `Performance is ${trend}. Focus on ${improvements.length > 0 ? improvements[0] : "maintaining current momentum"}.`,
    strengths: strengths.length > 0 ? strengths : ["Consistent effort"],
    improvement_areas: improvements.length > 0 ? improvements : ["Continue current approach"],
    trend,
    new_recommendations: recommendations,
    suggested_focus: recommendations.length > 0 ? recommendations[0].recommendation : "Maintain current performance levels",
  };
}

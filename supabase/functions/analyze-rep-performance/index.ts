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

    const { org_id, user_id, period_days = 30 } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AnalyzeRepPerformance] Analyzing performance for org: ${org_id}`);

    const now = new Date();
    const periodStart = new Date(now.getTime() - period_days * 24 * 60 * 60 * 1000);
    const periodEnd = now;

    // Get all reps if no specific user_id
    let userIds: string[] = [];
    if (user_id) {
      userIds = [user_id];
    } else {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("org_id", org_id);
      userIds = profiles?.map((p: any) => p.id) || [];
    }

    const performanceRecords: any[] = [];

    for (const repId of userIds) {
      const metrics = await calculateRepMetrics(supabase, org_id, repId, periodStart, periodEnd);
      
      // Store performance record
      const { data: record, error: insertError } = await supabase
        .from("rep_performance")
        .insert({
          org_id,
          user_id: repId,
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          ...metrics,
          computed_at: now.toISOString(),
        })
        .select()
        .single();

      if (!insertError && record) {
        performanceRecords.push(record);
      }
    }

    // Generate coaching recommendations
    const recommendations = await generateCoachingRecommendations(supabase, org_id, performanceRecords);

    return new Response(
      JSON.stringify({
        success: true,
        performance_records: performanceRecords.length,
        coaching_recommendations: recommendations.length,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
          days: period_days,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AnalyzeRepPerformance] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function calculateRepMetrics(
  supabase: any,
  org_id: string,
  user_id: string,
  periodStart: Date,
  periodEnd: Date
): Promise<any> {
  // Get activities
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("org_id", org_id)
    .eq("owner_id", user_id)
    .gte("activity_date", periodStart.toISOString())
    .lte("activity_date", periodEnd.toISOString());

  const calls = activities?.filter((a: any) => a.activity_type === "call") || [];
  const emails = activities?.filter((a: any) => a.activity_type === "email") || [];
  const meetings = activities?.filter((a: any) => a.activity_type === "meeting") || [];

  // Get deals
  const { data: wonDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("owner_id", user_id)
    .eq("status", "won")
    .gte("closed_date", periodStart.toISOString())
    .lte("closed_date", periodEnd.toISOString());

  const { data: lostDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("owner_id", user_id)
    .eq("status", "lost")
    .gte("closed_date", periodStart.toISOString())
    .lte("closed_date", periodEnd.toISOString());

  const { data: openDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", org_id)
    .eq("owner_id", user_id)
    .eq("status", "open");

  // Calculate metrics
  const dealsWon = wonDeals?.length || 0;
  const dealsLost = lostDeals?.length || 0;
  const totalClosed = dealsWon + dealsLost;
  const winRate = totalClosed > 0 ? (dealsWon / totalClosed) * 100 : 0;

  const revenueWon = wonDeals?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
  const pipelineGenerated = openDeals?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
  const avgDealSize = dealsWon > 0 ? revenueWon / dealsWon : 0;

  // Calculate average sales cycle
  const cycleLengths = wonDeals?.map((d: any) => {
    const created = new Date(d.created_at);
    const closed = new Date(d.closed_date);
    return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  }) || [];
  const avgSalesCycle = cycleLengths.length > 0
    ? cycleLengths.reduce((a: number, b: number) => a + b, 0) / cycleLengths.length
    : 0;

  // Get call analytics if available
  const { data: callInsights } = await supabase
    .from("call_insights")
    .select("sentiment_score")
    .eq("org_id", org_id)
    .in("call_id", 
      calls.map((c: any) => c.id).filter(Boolean).slice(0, 100)
    );

  const avgTalkRatio = 0.5; // Placeholder - would need call recording analysis
  const objectionHandlingScore = callInsights?.length > 0
    ? callInsights.reduce((sum: number, i: any) => sum + (i.sentiment_score || 0.5), 0) / callInsights.length * 100
    : null;

  return {
    calls_made: calls.length,
    emails_sent: emails.length,
    meetings_booked: meetings.length,
    deals_won: dealsWon,
    deals_lost: dealsLost,
    pipeline_generated: pipelineGenerated,
    revenue_closed: revenueWon,
    avg_deal_size: avgDealSize,
    avg_sales_cycle_days: avgSalesCycle,
    win_rate: winRate,
    avg_talk_ratio: avgTalkRatio,
    objection_handling_score: objectionHandlingScore,
    discovery_score: null, // Would need call analysis
    closing_score: null, // Would need call analysis
  };
}

async function generateCoachingRecommendations(
  supabase: any,
  org_id: string,
  performanceRecords: any[]
): Promise<any[]> {
  const recommendations: any[] = [];

  // Calculate team averages
  const teamMetrics = {
    avg_win_rate: 0,
    avg_calls: 0,
    avg_meetings: 0,
    avg_deal_size: 0,
  };

  if (performanceRecords.length > 0) {
    teamMetrics.avg_win_rate = performanceRecords.reduce((s, p) => s + (p.win_rate || 0), 0) / performanceRecords.length;
    teamMetrics.avg_calls = performanceRecords.reduce((s, p) => s + (p.calls_made || 0), 0) / performanceRecords.length;
    teamMetrics.avg_meetings = performanceRecords.reduce((s, p) => s + (p.meetings_booked || 0), 0) / performanceRecords.length;
    teamMetrics.avg_deal_size = performanceRecords.reduce((s, p) => s + (p.avg_deal_size || 0), 0) / performanceRecords.length;
  }

  // Find top performers for best practice sharing
  const topPerformers = [...performanceRecords]
    .sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0))
    .slice(0, 2)
    .map(p => p.user_id);

  for (const record of performanceRecords) {
    // Low win rate
    if (record.win_rate < teamMetrics.avg_win_rate * 0.7 && record.deals_won + record.deals_lost >= 3) {
      recommendations.push({
        org_id,
        user_id: record.user_id,
        topic: "Win Rate Improvement",
        recommendation: `Your win rate of ${record.win_rate.toFixed(1)}% is below the team average of ${teamMetrics.avg_win_rate.toFixed(1)}%. Focus on qualification criteria and consider shadowing top performers.`,
        priority: 1,
        category: "closing",
        best_practice_source: topPerformers[0],
        evidence: { current_win_rate: record.win_rate, team_average: teamMetrics.avg_win_rate },
      });
    }

    // Low activity
    if (record.calls_made < teamMetrics.avg_calls * 0.5) {
      recommendations.push({
        org_id,
        user_id: record.user_id,
        topic: "Activity Level",
        recommendation: `Your call volume (${record.calls_made}) is significantly below the team average (${Math.round(teamMetrics.avg_calls)}). Consider blocking dedicated prospecting time.`,
        priority: 2,
        category: "activity",
        evidence: { current_calls: record.calls_made, team_average: teamMetrics.avg_calls },
      });
    }

    // Low meeting conversion
    const meetingRate = record.calls_made > 0 ? (record.meetings_booked / record.calls_made) * 100 : 0;
    const avgMeetingRate = teamMetrics.avg_calls > 0 ? (teamMetrics.avg_meetings / teamMetrics.avg_calls) * 100 : 0;
    if (meetingRate < avgMeetingRate * 0.6 && record.calls_made >= 10) {
      recommendations.push({
        org_id,
        user_id: record.user_id,
        topic: "Call to Meeting Conversion",
        recommendation: `Your call-to-meeting rate of ${meetingRate.toFixed(1)}% could be improved. Review your opening techniques and value proposition delivery.`,
        priority: 2,
        category: "discovery",
        best_practice_source: topPerformers[0],
        evidence: { current_rate: meetingRate, team_average: avgMeetingRate },
      });
    }

    // Excellent performance - recognition
    if (record.win_rate > teamMetrics.avg_win_rate * 1.3 && record.deals_won >= 3) {
      recommendations.push({
        org_id,
        user_id: record.user_id,
        topic: "Top Performer Recognition",
        recommendation: `Excellent work! Your win rate of ${record.win_rate.toFixed(1)}% is well above team average. Consider sharing your best practices with the team.`,
        priority: 4,
        category: "recognition",
        evidence: { current_win_rate: record.win_rate, team_average: teamMetrics.avg_win_rate },
      });
    }
  }

  // Insert recommendations
  if (recommendations.length > 0) {
    const { error } = await supabase
      .from("coaching_recommendations")
      .insert(recommendations);

    if (error) {
      console.error("[AnalyzeRepPerformance] Failed to insert recommendations:", error);
    }
  }

  return recommendations;
}

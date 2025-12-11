import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProactiveInsight {
  id: string;
  type: 'critical' | 'opportunity' | 'info' | 'agent_activity';
  title: string;
  description: string;
  metric?: number;
  actions: {
    label: string;
    action: string;
    params?: Record<string, any>;
  }[];
  dismissible: boolean;
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
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Proactive Insights] Generating insights for org: ${org_id}`);

    const insights: ProactiveInsight[] = [];

    // 1. High-scoring accounts without contacts
    const { data: highScoreNoContacts, error: hsncError } = await supabase
      .from("scores")
      .select(`
        account_external_id,
        overall,
        accounts!inner(name, external_id)
      `)
      .eq("org_id", org_id)
      .gte("overall", 80)
      .limit(500);

    if (!hsncError && highScoreNoContacts) {
      const accountIds = highScoreNoContacts.map(s => s.account_external_id);
      
      // Check which accounts have contacts
      const { data: accountsWithContacts } = await supabase
        .from("Leads")
        .select("account_external_id")
        .eq("org_id", org_id)
        .in("account_external_id", accountIds);
      
      const accountsWithContactsSet = new Set(accountsWithContacts?.map(l => l.account_external_id) || []);
      const accountsWithoutContacts = accountIds.filter(id => !accountsWithContactsSet.has(id));
      
      if (accountsWithoutContacts.length > 0) {
        insights.push({
          id: "high_score_no_contacts",
          type: "opportunity",
          title: `${accountsWithoutContacts.length} high-scoring accounts need contacts`,
          description: "These accounts scored 80+ but don't have any contacts yet. Find decision makers to start outreach.",
          metric: accountsWithoutContacts.length,
          actions: [
            { label: "Find Contacts", action: "enrich_contacts", params: { account_ids: accountsWithoutContacts.slice(0, 50) } },
            { label: "View Accounts", action: "search_accounts", params: { min_score: 80 } },
          ],
          dismissible: true,
        });
      }
    }

    // 2. Stale qualified leads (not worked in 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: staleLeads, count: staleCount } = await supabase
      .from("Leads")
      .select("id", { count: "exact" })
      .eq("org_id", org_id)
      .eq("icp_qualified", true)
      .lt("updated_at", sevenDaysAgo.toISOString())
      .limit(1);

    if (staleCount && staleCount > 0) {
      insights.push({
        id: "stale_qualified_leads",
        type: "critical",
        title: `${staleCount.toLocaleString()} qualified leads haven't been worked`,
        description: "These ICP-qualified leads haven't been updated in 7+ days. Consider prioritizing outreach.",
        metric: staleCount,
        actions: [
          { label: "View Leads", action: "search_contacts", params: { icp_qualified_only: true } },
          { label: "Run Follow-Up Agent", action: "run_agent", params: { agent_type: "follow_up" } },
        ],
        dismissible: true,
      });
    }

    // 3. Recently funded companies
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentlyFunded, count: fundedCount } = await supabase
      .from("accounts")
      .select("id, name, last_funding_round", { count: "exact" })
      .eq("org_id", org_id)
      .gte("last_funding_date", thirtyDaysAgo.toISOString().split('T')[0])
      .limit(5);

    if (fundedCount && fundedCount > 0) {
      insights.push({
        id: "recently_funded",
        type: "opportunity",
        title: `${fundedCount} accounts received funding recently`,
        description: "Companies that just raised funding are more likely to invest in new solutions. Prioritize outreach!",
        metric: fundedCount,
        actions: [
          { label: "View Funded", action: "search_recently_funded", params: { days: 30 } },
          { label: "Start Campaign", action: "prepare_campaign", params: { recently_funded_days: 30 } },
        ],
        dismissible: true,
      });
    }

    // 4. Accounts needing enrichment
    const { count: needsEnrichment } = await supabase
      .from("accounts")
      .select("id", { count: "exact" })
      .eq("org_id", org_id)
      .is("enriched_at", null)
      .or("industry_norm.is.null,employee_count.is.null");

    if (needsEnrichment && needsEnrichment > 50) {
      insights.push({
        id: "needs_enrichment",
        type: "info",
        title: `${needsEnrichment.toLocaleString()} accounts need data enrichment`,
        description: "Enriching missing data improves scoring accuracy and campaign targeting.",
        metric: needsEnrichment,
        actions: [
          { label: "Free AI Enrich", action: "enrich_ai_free", params: { batch_size: 100 } },
          { label: "Smart Enrich", action: "enrich_accounts", params: {} },
        ],
        dismissible: true,
      });
    }

    // 5. Get agent activity from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: agentRuns } = await supabase
      .from("ai_agent_runs")
      .select(`
        id,
        records_processed,
        records_affected,
        status,
        started_at,
        ai_agents(name, agent_type)
      `)
      .gte("started_at", today.toISOString())
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(10);

    const agentActivity = (agentRuns || []).map(run => ({
      agent_name: (run.ai_agents as any)?.name || "Unknown Agent",
      action: `processed ${run.records_processed || 0} records`,
      count: run.records_affected || 0,
      timestamp: run.started_at,
    }));

    // Add agent activity insight if there was activity
    if (agentActivity.length > 0) {
      const totalProcessed = agentActivity.reduce((sum, a) => sum + a.count, 0);
      insights.push({
        id: "agent_activity_summary",
        type: "agent_activity",
        title: `Agents processed ${totalProcessed} records today`,
        description: `${agentActivity.length} agent runs completed. Check agent status for details.`,
        metric: totalProcessed,
        actions: [
          { label: "View Status", action: "agent_status" },
          { label: "View Feedback", action: "agent_feedback_summary" },
        ],
        dismissible: false,
      });
    }

    // 6. Pipeline stats
    const { data: pipelineData } = await supabase
      .from("Leads")
      .select("pipeline_stage")
      .eq("org_id", org_id)
      .not("pipeline_stage", "is", null);

    const pipelineStats = {
      qualified: 0,
      follow_up: 0,
      meeting_ready: 0,
    };

    if (pipelineData) {
      for (const lead of pipelineData) {
        if (lead.pipeline_stage === 'qualified') pipelineStats.qualified++;
        else if (lead.pipeline_stage === 'follow_up') pipelineStats.follow_up++;
        else if (lead.pipeline_stage === 'meeting_ready') pipelineStats.meeting_ready++;
      }
    }

    // Add meeting-ready insight if there are any
    if (pipelineStats.meeting_ready > 0) {
      insights.unshift({
        id: "meeting_ready_leads",
        type: "critical",
        title: `${pipelineStats.meeting_ready} leads are meeting-ready!`,
        description: "These leads have been qualified and followed up. Schedule meetings now.",
        metric: pipelineStats.meeting_ready,
        actions: [
          { label: "View Leads", action: "search_contacts", params: { pipeline_stage: "meeting_ready" } },
          { label: "Export for Outreach", action: "export_list", params: { type: "contacts", filters: { pipeline_stage: "meeting_ready" } } },
        ],
        dismissible: false,
      });
    }

    // Sort insights by priority
    const priorityOrder = { critical: 0, opportunity: 1, agent_activity: 2, info: 3 };
    insights.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

    console.log(`[Proactive Insights] Generated ${insights.length} insights, ${agentActivity.length} agent activities`);

    return new Response(JSON.stringify({
      insights,
      agent_activity: agentActivity,
      pipeline_stats: pipelineStats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Proactive Insights] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

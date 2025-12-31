import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  handleCors, 
  parseJsonBody,
  validateRequired,
  ErrorCodes 
} from "../_shared/response-helpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProactiveInsight {
  id: string;
  type: 'critical' | 'opportunity' | 'info' | 'agent_activity' | 'warning' | 'engagement';
  title: string;
  description: string;
  metric?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  category?: 'action_required' | 'opportunity' | 'warning' | 'info';
  actions: {
    label: string;
    action: string;
    params?: Record<string, any>;
  }[];
  dismissible: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await parseJsonBody<{ org_id: string }>(req);
    const validation = validateRequired(body, ['org_id']);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing required fields: ${validation.missing.join(', ')}`,
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const { org_id } = body!;
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
          { label: "View Leads", action: "search_contacts", params: { icp_qualified_only: true, stale_days: 7 } },
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
        priority: needsEnrichment > 1000 ? 'high' : 'medium',
        category: needsEnrichment > 1000 ? 'action_required' : 'info',
        actions: [
          { label: "Enrich 500", action: "enrich_ai_free", params: { batch_size: 500 } },
          { label: "Enrich All", action: "enrich_ai_free", params: { batch_size: 2000, enrich_all: true } },
          { label: "Smart Enrich", action: "enrich_accounts", params: {} },
        ],
        dismissible: true,
      });
    }

    // 5a. Multi-threading gap: High-fit accounts with only 1 contact
    const { data: highFitScores } = await supabase
      .from("scores")
      .select("account_external_id")
      .eq("org_id", org_id)
      .gte("overall", 70);
    
    if (highFitScores && highFitScores.length > 0) {
      const highFitAccountIds = highFitScores.map(s => s.account_external_id);
      
      // Count contacts per high-fit account
      const { data: contactCounts } = await supabase
        .from("Leads")
        .select("account_external_id")
        .eq("org_id", org_id)
        .in("account_external_id", highFitAccountIds);
      
      const accountContactMap: Record<string, number> = {};
      contactCounts?.forEach(c => {
        accountContactMap[c.account_external_id] = (accountContactMap[c.account_external_id] || 0) + 1;
      });
      
      const singleContactAccounts = highFitAccountIds.filter(id => accountContactMap[id] === 1).length;
      const noContactAccounts = highFitAccountIds.filter(id => !accountContactMap[id]).length;
      
      if (singleContactAccounts > 20) {
        insights.push({
          id: "multi_threading_gap",
          type: "warning",
          title: `${singleContactAccounts} high-fit accounts have only 1 contact`,
          description: "Multi-threading is critical for enterprise deals. Reduce deal risk by adding more decision-makers.",
          metric: singleContactAccounts,
          priority: singleContactAccounts > 100 ? 'critical' : 'high',
          category: 'action_required',
          actions: [
            { label: "Find More Contacts", action: "enrich_contacts", params: { single_thread_only: true } },
            { label: "View Accounts", action: "search_accounts", params: { single_contact_only: true } },
          ],
          dismissible: true,
        });
      }
      
      if (noContactAccounts > 10) {
        insights.push({
          id: "high_fit_no_contacts",
          type: "critical",
          title: `${noContactAccounts} high-fit accounts have no contacts`,
          description: "Your best-fit accounts can't be reached. Priority for contact discovery.",
          metric: noContactAccounts,
          priority: 'critical',
          category: 'action_required',
          actions: [
            { label: "Find Contacts", action: "enrich_contacts", params: { no_contacts_only: true } },
          ],
          dismissible: true,
        });
      }
    }

    // 5b. Score velocity: Accounts with significant score changes
    const { data: recentScores } = await supabase
      .from("scores")
      .select("account_external_id, overall, calculated_at, accounts(name)")
      .eq("org_id", org_id)
      .order("calculated_at", { ascending: false })
      .limit(1000);
    
    // Count score improvements (simplified - would need historical comparison in production)
    const highScoreCount = recentScores?.filter(s => s.overall >= 80).length || 0;
    
    if (highScoreCount > 50 && !insights.find(i => i.id.includes('high_score'))) {
      insights.push({
        id: "high_score_opportunity",
        type: "opportunity",
        title: `${highScoreCount} accounts score 80+`,
        description: "These are your best-fit accounts. Prioritize outreach to maximize conversion.",
        metric: highScoreCount,
        priority: 'high',
        category: 'opportunity',
        actions: [
          { label: "View Top Accounts", action: "search_accounts", params: { min_score: 80 } },
          { label: "Build Campaign", action: "prepare_campaign", params: { min_score: 80 } },
        ],
        dismissible: true,
      });
    }

    // 5c. Campaign readiness insight
    const { count: campaignReadyCount } = await supabase
      .from("Leads")
      .select("id", { count: "exact" })
      .eq("org_id", org_id)
      .eq("icp_qualified", true)
      .not("email", "is", null);
    
    if (campaignReadyCount && campaignReadyCount > 100) {
      insights.push({
        id: "campaign_ready",
        type: "opportunity",
        title: `${campaignReadyCount.toLocaleString()} qualified leads ready for campaigns`,
        description: "These ICP-qualified leads have valid emails and are ready for outreach.",
        metric: campaignReadyCount,
        priority: 'medium',
        category: 'opportunity',
        actions: [
          { label: "Build Campaign", action: "prepare_campaign", params: { qualified_only: true } },
          { label: "Export List", action: "export_list", params: { type: "qualified_leads" } },
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
      run_id: run.id,
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

    // Sort insights by priority (type-based, then priority field)
    const typeOrder: Record<string, number> = { critical: 0, warning: 1, opportunity: 2, engagement: 3, agent_activity: 4, info: 5 };
    const priorityLevelOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    
    insights.sort((a, b) => {
      const typeA = typeOrder[a.type] ?? 5;
      const typeB = typeOrder[b.type] ?? 5;
      if (typeA !== typeB) return typeA - typeB;
      
      const priorityA = priorityLevelOrder[a.priority || 'medium'] ?? 2;
      const priorityB = priorityLevelOrder[b.priority || 'medium'] ?? 2;
      return priorityA - priorityB;
    });

    console.log(`[Proactive Insights] Generated ${insights.length} insights, ${agentActivity.length} agent activities`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: insights.slice(0, 15), // Max 15 insights
        agent_activity: agentActivity,
        pipeline_stats: pipelineStats,
        total_insights: insights.length,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error("[Proactive Insights] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

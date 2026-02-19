import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PipelineResult {
  stage: string;
  agent: string;
  processed: number;
  affected: number;
  duration_ms: number;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { org_id, stages, dry_run = false } = await req.json();
    
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Pipeline Controller] Starting pipeline for org: ${org_id}, stages: ${stages || 'all'}, dry_run: ${dry_run}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const results: PipelineResult[] = [];
    const stagesToRun = stages || ['lead_qualification', 'data_enrichment', 'follow_up', 'meeting_scheduler'];

    // Helper to invoke agent functions
    async function invokeAgent(agentType: string, body: Record<string, any>): Promise<{ processed: number; affected: number; error?: string }> {
      const functionMap: Record<string, string> = {
        'lead_qualification': 'agent-lead-qualification',
        'data_enrichment': 'agent-data-enrichment',
        'follow_up': 'agent-follow-up',
        'meeting_scheduler': 'agent-meeting-scheduler',
      };

      const functionName = functionMap[agentType];
      if (!functionName) {
        return { processed: 0, affected: 0, error: `Unknown agent type: ${agentType}` };
      }

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { processed: 0, affected: 0, error: errorText };
        }

        const data = await response.json();
        return {
          processed: data.processed || data.records_processed || 0,
          affected: data.affected || data.records_affected || 0,
        };
      } catch (error) {
        return { processed: 0, affected: 0, error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    // Log feedback for agent decisions
    async function logFeedback(agentId: string | null, decisionType: string, leadId: string | null, accountId: string | null, reasoning: string, confidence: number) {
      try {
        await supabase.from("ai_agent_feedback").insert({
          org_id,
          agent_id: agentId,
          lead_id: leadId,
          account_id: accountId,
          decision_type: decisionType,
          ai_reasoning: reasoning,
          confidence_score: confidence,
          outcome: 'pending',
        });
      } catch (e) {
        console.error("[Pipeline Controller] Failed to log feedback:", e);
      }
    }

    // Stage 1: Lead Qualification
    if (stagesToRun.includes('lead_qualification')) {
      console.log("[Pipeline Controller] Running Lead Qualification...");
      const stageStart = Date.now();

      if (dry_run) {
        const { count } = await supabase
          .from("Leads")
          .select("id", { count: "exact" })
          .eq("org_id", org_id)
          .eq("status", "open");

        results.push({
          stage: 'lead_qualification',
          agent: 'Lead Qualification Agent',
          processed: 0,
          affected: count || 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: `Would process ${count || 0} open leads`,
        });
      } else {
        const result = await invokeAgent('lead_qualification', { org_id, batch_size: 100 });
        
        // Update pipeline stage for qualified leads
        if (result.affected > 0) {
          await supabase
            .from("Leads")
            .update({ 
              pipeline_stage: 'qualified',
              pipeline_triggered_by: 'lead_qualification',
              pipeline_updated_at: new Date().toISOString(),
            })
            .eq("org_id", org_id)
            .eq("status", "qualified")
            .eq("pipeline_stage", "new");
        }

        results.push({
          stage: 'lead_qualification',
          agent: 'Lead Qualification Agent',
          processed: result.processed,
          affected: result.affected,
          duration_ms: Date.now() - stageStart,
          status: result.error ? 'failed' : 'success',
          message: result.error || `Qualified ${result.affected} leads`,
        });
      }
    }

    // Stage 2: Data Enrichment (for high-value accounts)
    if (stagesToRun.includes('data_enrichment')) {
      console.log("[Pipeline Controller] Running Data Enrichment...");
      const stageStart = Date.now();

      // Get high-scoring accounts that need enrichment
      const { data: needsEnrichment, count } = await supabase
        .from("scores")
        .select("account_external_id", { count: "exact" })
        .eq("org_id", org_id)
        .gte("overall", 70)
        .limit(50);

      if (dry_run) {
        results.push({
          stage: 'data_enrichment',
          agent: 'Data Enrichment Agent',
          processed: 0,
          affected: count || 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: `Would enrich ${count || 0} high-scoring accounts`,
        });
      } else if (needsEnrichment && needsEnrichment.length > 0) {
        const result = await invokeAgent('data_enrichment', { 
          org_id, 
          account_ids: needsEnrichment.map(a => a.account_external_id),
          priority: 'high_score',
        });

        results.push({
          stage: 'data_enrichment',
          agent: 'Data Enrichment Agent',
          processed: result.processed,
          affected: result.affected,
          duration_ms: Date.now() - stageStart,
          status: result.error ? 'failed' : 'success',
          message: result.error || `Enriched ${result.affected} accounts`,
        });
      } else {
        results.push({
          stage: 'data_enrichment',
          agent: 'Data Enrichment Agent',
          processed: 0,
          affected: 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: 'No high-scoring accounts need enrichment',
        });
      }
    }

    // Stage 3: Follow-Up Agent
    if (stagesToRun.includes('follow_up')) {
      console.log("[Pipeline Controller] Running Follow-Up Agent...");
      const stageStart = Date.now();

      // Get qualified leads for follow-up
      const { count: qualifiedCount } = await supabase
        .from("Leads")
        .select("id", { count: "exact" })
        .eq("org_id", org_id)
        .eq("pipeline_stage", "qualified");

      if (dry_run) {
        results.push({
          stage: 'follow_up',
          agent: 'Follow-Up Agent',
          processed: 0,
          affected: qualifiedCount || 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: `Would process ${qualifiedCount || 0} qualified leads`,
        });
      } else if (qualifiedCount && qualifiedCount > 0) {
        const result = await invokeAgent('follow_up', { org_id, batch_size: 100 });

        // Update pipeline stage for followed-up leads
        if (result.affected > 0) {
          await supabase
            .from("Leads")
            .update({ 
              pipeline_stage: 'follow_up',
              pipeline_triggered_by: 'follow_up_agent',
              pipeline_updated_at: new Date().toISOString(),
            })
            .eq("org_id", org_id)
            .eq("pipeline_stage", "qualified")
            .limit(result.affected);
        }

        results.push({
          stage: 'follow_up',
          agent: 'Follow-Up Agent',
          processed: result.processed,
          affected: result.affected,
          duration_ms: Date.now() - stageStart,
          status: result.error ? 'failed' : 'success',
          message: result.error || `Marked ${result.affected} leads for follow-up`,
        });
      } else {
        results.push({
          stage: 'follow_up',
          agent: 'Follow-Up Agent',
          processed: 0,
          affected: 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: 'No qualified leads to follow up',
        });
      }
    }

    // Stage 4: Meeting Scheduler
    if (stagesToRun.includes('meeting_scheduler')) {
      console.log("[Pipeline Controller] Running Meeting Scheduler...");
      const stageStart = Date.now();

      // Get leads that have been followed up multiple times
      const { data: followedUpLeads, count: fuCount } = await supabase
        .from("Leads")
        .select("id", { count: "exact" })
        .eq("org_id", org_id)
        .eq("pipeline_stage", "follow_up");

      if (dry_run) {
        results.push({
          stage: 'meeting_scheduler',
          agent: 'Meeting Scheduler Agent',
          processed: 0,
          affected: fuCount || 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: `Would evaluate ${fuCount || 0} followed-up leads for meetings`,
        });
      } else if (fuCount && fuCount > 0) {
        const result = await invokeAgent('meeting_scheduler', { org_id, batch_size: 50 });

        // Update pipeline stage for meeting-ready leads
        if (result.affected > 0) {
          await supabase
            .from("Leads")
            .update({ 
              pipeline_stage: 'meeting_ready',
              pipeline_triggered_by: 'meeting_scheduler',
              pipeline_updated_at: new Date().toISOString(),
            })
            .eq("org_id", org_id)
            .eq("pipeline_stage", "follow_up")
            .limit(result.affected);

          // Log feedback for meeting-ready decisions
          await logFeedback(
            null, 
            'meeting_scheduled',
            null,
            null,
            `Pipeline controller marked ${result.affected} leads as meeting-ready`,
            0.8
          );
        }

        results.push({
          stage: 'meeting_scheduler',
          agent: 'Meeting Scheduler Agent',
          processed: result.processed,
          affected: result.affected,
          duration_ms: Date.now() - stageStart,
          status: result.error ? 'failed' : 'success',
          message: result.error || `${result.affected} leads marked as meeting-ready`,
        });
      } else {
        results.push({
          stage: 'meeting_scheduler',
          agent: 'Meeting Scheduler Agent',
          processed: 0,
          affected: 0,
          duration_ms: Date.now() - stageStart,
          status: 'skipped',
          message: 'No followed-up leads ready for meetings',
        });
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalAffected = results.reduce((sum, r) => sum + r.affected, 0);
    const totalDuration = Date.now() - startTime;

    console.log(`[Pipeline Controller] Complete. Processed: ${totalProcessed}, Affected: ${totalAffected}, Duration: ${totalDuration}ms`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      stages: results,
      summary: {
        total_processed: totalProcessed,
        total_affected: totalAffected,
        duration_ms: totalDuration,
        stages_run: results.length,
        stages_successful: results.filter(r => r.status === 'success').length,
        stages_failed: results.filter(r => r.status === 'failed').length,
        stages_skipped: results.filter(r => r.status === 'skipped').length,
      },
      message: dry_run 
        ? `Dry run complete. Would process ${totalAffected} records across ${results.length} stages.`
        : `Pipeline complete! Processed ${totalProcessed} records, affected ${totalAffected} across ${results.length} stages.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Pipeline Controller] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

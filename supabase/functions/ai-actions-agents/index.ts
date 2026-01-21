import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAction(
  supabase: any, org_id: string, user_id: string | undefined, action_name: string,
  parameters: Record<string, any>, result: any, status: 'success' | 'failed',
  error_message?: string, execution_time_ms?: number
) {
  try {
    await supabase.from("ai_action_logs").insert({
      org_id, user_id, action_name, action_parameters: parameters,
      action_result: result, status, error_message, execution_time_ms,
    });
  } catch (e) {
    console.error("[AI-Actions-Agents] Failed to log action:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, parameters, org_id, user_id } = await req.json();
    console.log(`[AI-Actions-Agents] Executing action: ${action}`, parameters);

    switch (action) {
      case "list_agents": {
        const { data: agents, error } = await supabase
          .from("ai_agents")
          .select("id, name, agent_type, status, enabled, schedule, last_run_at, next_run_at")
          .eq("org_id", org_id)
          .order("name");

        if (error) throw new Error(error.message);

        const message = (agents || []).length === 0
          ? "No AI agents configured."
          : `**${(agents || []).length} AI Agent${(agents || []).length > 1 ? 's' : ''}:**\n\n${(agents || []).map((a: any) =>
            `• **${a.name}** (${a.agent_type}) - ${a.enabled ? '✅ Enabled' : '❌ Disabled'}, Status: ${a.status}`
          ).join('\n')}`;

        const result = { agents, count: (agents || []).length, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "pause_agents": {
        const { agent_ids, agent_type } = parameters;

        let query = supabase.from("ai_agents").update({ enabled: false, updated_at: new Date().toISOString() }).eq("org_id", org_id);

        if (agent_ids && agent_ids.length > 0) {
          query = query.in("id", agent_ids);
        } else if (agent_type) {
          query = query.eq("agent_type", agent_type);
        }

        const { data: updated, error } = await query.select();
        if (error) throw new Error(error.message);

        const count = (updated || []).length;
        const result = { paused_count: count, agents: updated, message: `Paused ${count} agent${count !== 1 ? 's' : ''}.` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resume_agents": {
        const { agent_ids, agent_type } = parameters;

        let query = supabase.from("ai_agents").update({ enabled: true, updated_at: new Date().toISOString() }).eq("org_id", org_id);

        if (agent_ids && agent_ids.length > 0) {
          query = query.in("id", agent_ids);
        } else if (agent_type) {
          query = query.eq("agent_type", agent_type);
        }

        const { data: updated, error } = await query.select();
        if (error) throw new Error(error.message);

        const count = (updated || []).length;
        const result = { resumed_count: count, agents: updated, message: `Resumed ${count} agent${count !== 1 ? 's' : ''}.` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_agent_status": {
        const { agent_id } = parameters;
        if (!agent_id) {
          return new Response(JSON.stringify({ success: false, error: "agent_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: agent, error: agentError } = await supabase
          .from("ai_agents").select("*").eq("id", agent_id).eq("org_id", org_id).single();
        if (agentError) throw new Error(agentError.message);

        const { data: runs } = await supabase
          .from("ai_agent_runs").select("id, status, started_at, completed_at, records_processed, records_affected")
          .eq("agent_id", agent_id).order("started_at", { ascending: false }).limit(5);

        const message = `**${agent.name}** (${agent.agent_type})\n• Status: ${agent.status}\n• Enabled: ${agent.enabled ? 'Yes' : 'No'}\n• Last run: ${agent.last_run_at || 'Never'}\n• Schedule: ${agent.schedule}\n\n**Recent runs:**\n${(runs || []).map((r: any) => 
          `• ${r.status} - ${r.records_processed || 0} processed, ${r.records_affected || 0} affected`
        ).join('\n') || 'No runs yet'}`;

        const result = { agent, recent_runs: runs, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "run_agent": {
        const { agent_id } = parameters;
        if (!agent_id) {
          return new Response(JSON.stringify({ success: false, error: "agent_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: agent, error: agentError } = await supabase
          .from("ai_agents").select("*").eq("id", agent_id).eq("org_id", org_id).single();
        if (agentError || !agent) {
          return new Response(JSON.stringify({ success: false, error: "Agent not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: run, error: runError } = await supabase
          .from("ai_agent_runs")
          .insert({ agent_id, status: "pending", started_at: new Date().toISOString() })
          .select().single();

        if (runError) throw new Error(runError.message);

        await supabase.from("ai_agents").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", agent_id);

        const result = { run_id: run.id, agent_name: agent.name, message: `Started ${agent.name} agent. Run ID: ${run.id}` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_agent": {
        const { name, agent_type, schedule = "manual", description, parameters: agentParams } = parameters;
        if (!name || !agent_type) {
          return new Response(JSON.stringify({ success: false, error: "name and agent_type are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: agent, error } = await supabase
          .from("ai_agents")
          .insert({ org_id, name, agent_type, schedule, description, parameters: agentParams || {}, enabled: true, status: "idle" })
          .select().single();

        if (error) throw new Error(error.message);

        const result = { agent, message: `Created agent "${name}" (${agent_type}).` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown agent action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions-Agents] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

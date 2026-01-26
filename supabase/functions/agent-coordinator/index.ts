import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelegatePayload {
  requesting_agent: string;
  required_capabilities: string[];
  payload: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "critical";
  timeout_seconds?: number;
  parent_task_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, org_id, ...payload } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: "Organization ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "delegate": {
        const { 
          requesting_agent, 
          required_capabilities, 
          payload: taskPayload, 
          priority = "normal",
          timeout_seconds = 300,
          parent_task_id 
        } = payload as DelegatePayload;

        // Find capable agent
        const { data: registryResponse } = await supabase.functions.invoke("agent-registry", {
          body: {
            action: "find_capable",
            org_id,
            capability: required_capabilities[0],
          },
        });

        const assignedAgent = registryResponse?.agent?.agent_name || null;

        // Create task in queue
        const { data: task, error } = await supabase
          .from("ai_task_queue")
          .insert({
            org_id,
            parent_task_id,
            requesting_agent,
            assigned_agent: assignedAgent,
            required_capabilities,
            priority,
            status: assignedAgent ? "pending" : "pending",
            payload: taskPayload,
            timeout_seconds,
            expires_at: new Date(Date.now() + timeout_seconds * 1000).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`[agent-coordinator] Created task ${task.id} for ${requesting_agent} -> ${assignedAgent || "unassigned"}`);

        // If we have an assigned agent, try to execute immediately
        if (assignedAgent) {
          // Update task status to running
          await supabase
            .from("ai_task_queue")
            .update({ 
              status: "running",
              started_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          try {
            // Invoke the assigned agent's function
            const agentFunctionName = `agent-${assignedAgent.replace(/_/g, "-")}`;
            const { data: result, error: invokeError } = await supabase.functions.invoke(agentFunctionName, {
              body: {
                org_id,
                task_id: task.id,
                ...taskPayload,
              },
            });

            if (invokeError) throw invokeError;

            // Update task with result
            await supabase
              .from("ai_task_queue")
              .update({
                status: "completed",
                result,
                completed_at: new Date().toISOString(),
              })
              .eq("id", task.id);

            return new Response(
              JSON.stringify({ 
                success: true, 
                task_id: task.id,
                status: "completed",
                result,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } catch (execError) {
            // Update task with error
            await supabase
              .from("ai_task_queue")
              .update({
                status: "failed",
                error_message: execError.message,
                completed_at: new Date().toISOString(),
              })
              .eq("id", task.id);

            return new Response(
              JSON.stringify({ 
                success: false, 
                task_id: task.id,
                status: "failed",
                error: execError.message,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            task_id: task.id,
            status: "pending",
            message: "Task queued for processing",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "claim": {
        const { agent_name, capabilities } = payload;

        // Find pending tasks matching agent capabilities
        const { data: tasks, error } = await supabase
          .from("ai_task_queue")
          .select("*")
          .eq("org_id", org_id)
          .eq("status", "pending")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1);

        if (error) throw error;

        if (!tasks || tasks.length === 0) {
          return new Response(
            JSON.stringify({ success: true, task: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Try to claim the task atomically
        const task = tasks[0];
        const { data: claimed, error: claimError } = await supabase
          .from("ai_task_queue")
          .update({
            assigned_agent: agent_name,
            status: "claimed",
            claimed_at: new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("status", "pending")
          .select()
          .single();

        if (claimError || !claimed) {
          // Task was already claimed by another agent
          return new Response(
            JSON.stringify({ success: false, message: "Task already claimed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, task: claimed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "complete": {
        const { task_id, result, error: taskError } = payload;

        const updateData: Record<string, unknown> = {
          completed_at: new Date().toISOString(),
        };

        if (taskError) {
          updateData.status = "failed";
          updateData.error_message = taskError;
        } else {
          updateData.status = "completed";
          updateData.result = result;
        }

        const { data, error } = await supabase
          .from("ai_task_queue")
          .update(updateData)
          .eq("id", task_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, task: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        const { task_id } = payload;

        const { data, error } = await supabase
          .from("ai_task_queue")
          .select("*")
          .eq("id", task_id)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, task: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_pending": {
        const { data, error } = await supabase
          .from("ai_task_queue")
          .select("*")
          .eq("org_id", org_id)
          .in("status", ["pending", "claimed", "running"])
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, tasks: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cleanup_expired": {
        const { data, error } = await supabase
          .from("ai_task_queue")
          .update({
            status: "timeout",
            error_message: "Task expired before completion",
            completed_at: new Date().toISOString(),
          })
          .lt("expires_at", new Date().toISOString())
          .in("status", ["pending", "claimed", "running"])
          .select();

        if (error) throw error;

        console.log(`[agent-coordinator] Cleaned up ${data?.length || 0} expired tasks`);

        return new Response(
          JSON.stringify({ success: true, expired_count: data?.length || 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[agent-coordinator] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

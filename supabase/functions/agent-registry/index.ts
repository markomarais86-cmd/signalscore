import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface RegisterPayload {
  agent_name: string;
  agent_type: string;
  capabilities: AgentCapability[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface DiscoverPayload {
  capability?: string;
  agent_type?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...payload } = await req.json();

    // Get org_id from auth header or payload
    let orgId = payload.org_id;
    
    if (!orgId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("org_id")
            .eq("user_id", user.id)
            .single();
          orgId = profile?.org_id;
        }
      }
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Organization ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "register": {
        const { agent_name, agent_type, capabilities, input_schema, output_schema, metadata } = payload as RegisterPayload;
        
        const { data, error } = await supabase
          .from("ai_agent_registry")
          .upsert({
            org_id: orgId,
            agent_name,
            agent_type,
            capabilities,
            input_schema: input_schema || {},
            output_schema: output_schema || {},
            metadata: metadata || {},
            status: "active",
            last_heartbeat: new Date().toISOString(),
          }, {
            onConflict: "org_id,agent_name",
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`[agent-registry] Registered agent: ${agent_name}`);
        return new Response(
          JSON.stringify({ success: true, agent: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deregister": {
        const { agent_name } = payload;
        
        const { error } = await supabase
          .from("ai_agent_registry")
          .update({ status: "inactive" })
          .eq("org_id", orgId)
          .eq("agent_name", agent_name);

        if (error) throw error;

        console.log(`[agent-registry] Deregistered agent: ${agent_name}`);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "heartbeat": {
        const { agent_name, health_score, avg_latency_ms, metrics } = payload;
        
        const updateData: Record<string, unknown> = {
          last_heartbeat: new Date().toISOString(),
          status: "active",
        };

        if (health_score !== undefined) updateData.health_score = health_score;
        if (avg_latency_ms !== undefined) updateData.avg_latency_ms = avg_latency_ms;
        if (metrics) {
          const { data: current } = await supabase
            .from("ai_agent_registry")
            .select("metadata, total_invocations, success_rate")
            .eq("org_id", orgId)
            .eq("agent_name", agent_name)
            .single();

          if (current) {
            updateData.metadata = { ...current.metadata, ...metrics };
            if (metrics.invocation_count) {
              updateData.total_invocations = (current.total_invocations || 0) + metrics.invocation_count;
            }
            if (metrics.success_count !== undefined && metrics.invocation_count) {
              const totalSuccesses = ((current.success_rate || 1) * (current.total_invocations || 0)) + metrics.success_count;
              const totalInvocations = (current.total_invocations || 0) + metrics.invocation_count;
              updateData.success_rate = totalInvocations > 0 ? totalSuccesses / totalInvocations : 1;
            }
          }
        }

        const { data, error } = await supabase
          .from("ai_agent_registry")
          .update(updateData)
          .eq("org_id", orgId)
          .eq("agent_name", agent_name)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, agent: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "discover": {
        const { capability, agent_type, status } = payload as DiscoverPayload;
        
        let query = supabase
          .from("ai_agent_registry")
          .select("*")
          .eq("org_id", orgId);

        if (status) {
          query = query.eq("status", status);
        } else {
          query = query.eq("status", "active");
        }

        if (agent_type) {
          query = query.eq("agent_type", agent_type);
        }

        const { data, error } = await query;
        if (error) throw error;

        let agents = data || [];

        // Filter by capability if specified
        if (capability) {
          agents = agents.filter(agent => {
            const caps = agent.capabilities as AgentCapability[];
            return caps.some(c => c.name === capability || c.name.includes(capability));
          });
        }

        return new Response(
          JSON.stringify({ success: true, agents }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "find_capable": {
        const { capability, prefer_healthy = true } = payload;
        
        const { data, error } = await supabase
          .from("ai_agent_registry")
          .select("*")
          .eq("org_id", orgId)
          .eq("status", "active");

        if (error) throw error;

        let capable = (data || []).filter(agent => {
          const caps = agent.capabilities as AgentCapability[];
          return caps.some(c => c.name === capability || c.name.includes(capability));
        });

        // Sort by health score if preferred
        if (prefer_healthy && capable.length > 1) {
          capable.sort((a, b) => (b.health_score || 0) - (a.health_score || 0));
        }

        const best = capable[0] || null;

        return new Response(
          JSON.stringify({ 
            success: true, 
            agent: best,
            alternatives: capable.slice(1),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const { data, error } = await supabase
          .from("ai_agent_registry")
          .select("*")
          .eq("org_id", orgId)
          .order("agent_name");

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, agents: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_health": {
        const { agent_name, health_score, error: agentError } = payload;
        
        const updateData: Record<string, unknown> = {
          health_score,
          status: health_score < 0.3 ? "degraded" : "active",
        };

        if (agentError) {
          updateData.last_error = agentError;
        }

        const { data, error } = await supabase
          .from("ai_agent_registry")
          .update(updateData)
          .eq("org_id", orgId)
          .eq("agent_name", agent_name)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, agent: data }),
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
    console.error("[agent-registry] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

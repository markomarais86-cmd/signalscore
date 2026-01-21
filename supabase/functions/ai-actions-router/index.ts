import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Action to function mapping
const ACTION_ROUTES: Record<string, string> = {
  // Search actions -> ai-actions-search
  search_accounts: "ai-actions-search",
  search_contacts: "ai-actions-search",
  find_similar_accounts: "ai-actions-search",
  find_decision_makers: "ai-actions-search",
  search_by_tech_stack: "ai-actions-search",
  search_recently_funded: "ai-actions-search",
  
  // Analytics actions -> ai-actions-analytics
  get_insights: "ai-actions-analytics",
  analyze_pipeline: "ai-actions-analytics",
  analyze_territory: "ai-actions-analytics",
  get_scoring_insights: "ai-actions-analytics",
  analyze_persona_coverage: "ai-actions-analytics",
  compare_segments: "ai-actions-analytics",
  
  // ICP actions -> ai-actions-icp
  create_icp: "ai-actions-icp",
  trigger_scoring: "ai-actions-icp",
  list_icps: "ai-actions-icp",
  update_icp: "ai-actions-icp",
  delete_icp: "ai-actions-icp",
  
  // Agent actions -> ai-actions-agents
  list_agents: "ai-actions-agents",
  pause_agents: "ai-actions-agents",
  resume_agents: "ai-actions-agents",
  get_agent_status: "ai-actions-agents",
  run_agent: "ai-actions-agents",
  create_agent: "ai-actions-agents",
};

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

    const body = await req.json();
    const { action, parameters, org_id, user_id } = body;
    
    console.log(`[AI-Actions-Router] Routing action: ${action}`);

    // Determine target function
    const targetFunction = ACTION_ROUTES[action];
    
    if (!targetFunction) {
      console.log(`[AI-Actions-Router] Unknown action: ${action}, available actions: ${Object.keys(ACTION_ROUTES).join(', ')}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Unknown action: ${action}. Available actions: ${Object.keys(ACTION_ROUTES).join(', ')}` 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AI-Actions-Router] Forwarding to ${targetFunction}`);

    // Forward to the appropriate sub-function
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: { action, parameters, org_id, user_id },
      headers: { Authorization: authHeader },
    });

    if (error) {
      console.error(`[AI-Actions-Router] Error from ${targetFunction}:`, error);
      return new Response(JSON.stringify({ success: false, error: error.message || "Sub-function error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AI-Actions-Router] Completed in ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[AI-Actions-Router] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Router error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

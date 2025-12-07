import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequest {
  action: string;
  parameters: Record<string, any>;
  org_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, parameters, org_id }: ActionRequest = await req.json();
    console.log(`[AI-Actions] Executing action: ${action}`, parameters);

    switch (action) {
      case "create_icp": {
        const { name, description, industries, company_sizes, revenue_ranges, geographies, persona_titles } = parameters;

        // Validate required fields
        if (!name) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "ICP name is required" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create ICP profile
        const { data: icp, error: icpError } = await supabase
          .from("icp_profiles")
          .insert({
            org_id,
            name,
            description: description || `AI-generated ICP: ${name}`,
            industries: industries || [],
            company_sizes: company_sizes || [],
            revenue_ranges: revenue_ranges || [],
            geographies: geographies || [],
            persona_job_titles: persona_titles || [],
            status: "active",
          })
          .select()
          .single();

        if (icpError) {
          console.error("[AI-Actions] ICP creation error:", icpError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: icpError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log the action
        await supabase.from("audit_logs").insert({
          org_id,
          actor: "ai-assistant",
          action: "icp_created_via_chat",
          meta: { icp_id: icp.id, icp_name: name },
        });

        return new Response(JSON.stringify({ 
          success: true, 
          action: "create_icp",
          result: {
            icp_id: icp.id,
            name: icp.name,
            message: `Successfully created ICP "${name}". Navigate to ICP Manager to view and refine it.`
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "trigger_scoring": {
        const { icp_id } = parameters;

        // Get org's active ICP if not specified
        let targetIcpId = icp_id;
        if (!targetIcpId) {
          const { data: activeIcp } = await supabase
            .from("icp_profiles")
            .select("id")
            .eq("org_id", org_id)
            .eq("status", "active")
            .limit(1)
            .single();
          
          targetIcpId = activeIcp?.id;
        }

        if (!targetIcpId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "No active ICP found. Please create an ICP first." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create a bulk scoring job
        const { data: job, error: jobError } = await supabase
          .from("bulk_scoring_jobs")
          .insert({
            org_id,
            icp_id: targetIcpId,
            status: "pending",
            total_accounts: 0,
          })
          .select()
          .single();

        if (jobError) {
          console.error("[AI-Actions] Scoring job creation error:", jobError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: jobError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          action: "trigger_scoring",
          result: {
            job_id: job.id,
            message: "Bulk scoring job created. Check the Accounts page to monitor progress."
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_insights": {
        // Get summary stats for the org
        const [accountsResult, scoresResult, icpResult, leadsResult] = await Promise.all([
          supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", org_id),
          supabase.from("scores").select("overall").eq("org_id", org_id),
          supabase.from("icp_profiles").select("id, name, status").eq("org_id", org_id),
          supabase.from("Leads").select("id", { count: "exact", head: true }).eq("org_id", org_id),
        ]);

        const scores = scoresResult.data || [];
        const highFit = scores.filter(s => s.overall >= 70).length;
        const medFit = scores.filter(s => s.overall >= 40 && s.overall < 70).length;
        const lowFit = scores.filter(s => s.overall < 40).length;

        return new Response(JSON.stringify({ 
          success: true, 
          action: "get_insights",
          result: {
            total_accounts: accountsResult.count || 0,
            total_leads: leadsResult.count || 0,
            scored_accounts: scores.length,
            high_fit: highFit,
            medium_fit: medFit,
            low_fit: lowFit,
            icps: icpResult.data || [],
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_accounts": {
        const { industry, country, min_score, limit = 10 } = parameters;

        let query = supabase
          .from("accounts")
          .select(`
            external_id,
            name,
            industry_norm,
            country,
            employee_count,
            scores!inner(overall, fit)
          `)
          .eq("org_id", org_id)
          .limit(limit);

        if (industry) {
          query = query.ilike("industry_norm", `%${industry}%`);
        }
        if (country) {
          query = query.ilike("country", `%${country}%`);
        }
        if (min_score) {
          query = query.gte("scores.overall", min_score);
        }

        const { data: accounts, error } = await query;

        if (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          action: "search_accounts",
          result: {
            accounts: accounts || [],
            count: accounts?.length || 0,
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_jobs": {
        // Clean up stuck enrichment jobs
        const { data, error } = await supabase.rpc("cleanup_stuck_enrichment_jobs");

        if (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          action: "cleanup_jobs",
          result: {
            cleaned_up: data || 0,
            message: `Cleaned up ${data || 0} stuck jobs.`
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions] Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

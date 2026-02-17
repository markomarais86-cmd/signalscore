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
    console.error("[AI-Actions-ICP] Failed to log action:", e);
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
    console.log(`[AI-Actions-ICP] Executing action: ${action}`, parameters);

    switch (action) {
      case "create_icp": {
        const {
          name, description, industries, company_sizes, revenue_ranges, geographies, persona_titles,
          sub_industries, tech_stack, pain_points, buying_signals, buying_triggers,
          competitive_landscape, decision_process, budget_indicators, vertical_filters, weights,
          persona_seniority_levels, persona_departments, persona_decision_roles,
          intent_signals, seasonal_patterns, company_stages, growth_stage, funding_status,
          excluded_industries, excluded_companies, regions, cities, timezones,
          category, use_case, tags, is_primary, scoring_config, disqualifiers,
          tam_estimate, template_source, version_notes,
        } = parameters;
        if (!name) {
          return new Response(JSON.stringify({ success: false, error: "ICP name is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const parseCompanySizes = (sizes: any[]): number[] => {
          if (!sizes || sizes.length === 0) return [];
          return sizes.map((size: any) => {
            if (typeof size === 'number') return size;
            const str = String(size).toLowerCase().replace(/[,\s]/g, '');
            if (str.includes('+') || str === 'enterprise') return parseInt(str.replace(/\D/g, ''), 10) || 1000;
            if (str.includes('-')) {
              const parts = str.split('-').map((p: string) => parseInt(p.replace(/\D/g, ''), 10));
              return parts[1] || parts[0] || 100;
            }
            if (str === 'startup') return 50;
            if (str === 'smb') return 200;
            if (str === 'mid-market') return 500;
            return parseInt(str.replace(/\D/g, ''), 10) || 100;
          }).filter((n: number) => !isNaN(n) && n > 0);
        };

        const insertData: Record<string, any> = {
          org_id, name, description: description || `AI-generated ICP: ${name}`,
          industries: industries || [], company_sizes: parseCompanySizes(company_sizes),
          revenue_ranges: revenue_ranges || [], geographies: geographies || [],
          persona_job_titles: persona_titles || [], status: "active",
        };

        // Add all optional fields if provided
        if (sub_industries) insertData.sub_industries = sub_industries;
        if (tech_stack) insertData.tech_stack = tech_stack;
        if (pain_points) insertData.pain_points = pain_points;
        if (buying_signals) insertData.buying_signals = buying_signals;
        if (buying_triggers) insertData.buying_triggers = buying_triggers;
        if (competitive_landscape) insertData.competitive_landscape = competitive_landscape;
        if (decision_process) insertData.decision_process = decision_process;
        if (budget_indicators) insertData.budget_indicators = budget_indicators;
        if (vertical_filters) insertData.vertical_filters = vertical_filters;
        if (weights) insertData.weights = weights;
        if (persona_seniority_levels) insertData.persona_seniority_levels = persona_seniority_levels;
        if (persona_departments) insertData.persona_departments = persona_departments;
        if (persona_decision_roles) insertData.persona_decision_roles = persona_decision_roles;
        if (intent_signals) insertData.intent_signals = intent_signals;
        if (seasonal_patterns) insertData.seasonal_patterns = seasonal_patterns;
        if (company_stages) insertData.company_stages = company_stages;
        if (growth_stage) insertData.growth_stage = growth_stage;
        if (funding_status) insertData.funding_status = funding_status;
        if (excluded_industries) insertData.excluded_industries = excluded_industries;
        if (excluded_companies) insertData.excluded_companies = excluded_companies;
        if (regions) insertData.regions = regions;
        if (cities) insertData.cities = cities;
        if (timezones) insertData.timezones = timezones;
        if (category) insertData.category = category;
        if (use_case) insertData.use_case = use_case;
        if (tags) insertData.tags = tags;
        if (is_primary !== undefined) insertData.is_primary = is_primary;
        if (scoring_config) insertData.scoring_config = scoring_config;
        if (disqualifiers) insertData.disqualifiers = disqualifiers;
        if (tam_estimate) insertData.tam_estimate = tam_estimate;
        if (template_source) insertData.template_source = template_source;
        if (version_notes) insertData.version_notes = version_notes;

        const { data: icp, error } = await supabase
          .from("icp_profiles")
          .insert(insertData)
          .select().single();

        if (error) throw new Error(error.message);

        await supabase.from("audit_logs").insert({
          org_id, actor: "ai-assistant", action: "icp_created_via_chat", meta: { icp_id: icp.id, icp_name: name },
        });

        const result = { icp_id: icp.id, name: icp.name, message: `Successfully created ICP "${name}".` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "trigger_scoring": {
        const { icp_id } = parameters;
        let targetIcpId = icp_id;

        if (!targetIcpId) {
          const { data: activeIcp } = await supabase
            .from("icp_profiles").select("id").eq("org_id", org_id).eq("status", "active").limit(1).single();
          targetIcpId = activeIcp?.id;
        }

        if (!targetIcpId) {
          return new Response(JSON.stringify({ success: false, error: "No active ICP found. Create one first." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: job, error } = await supabase
          .from("bulk_scoring_jobs")
          .insert({ org_id, icp_id: targetIcpId, status: "pending", total_accounts: 0 })
          .select().single();

        if (error) throw new Error(error.message);

        const result = { job_id: job.id, message: "Bulk scoring job created. Check Accounts page for progress." };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_icps": {
        const { data: icps, error } = await supabase
          .from("icp_profiles").select("id, name, status, industries, geographies, created_at").eq("org_id", org_id).order("created_at", { ascending: false });

        if (error) throw new Error(error.message);

        const message = (icps || []).length === 0
          ? "No ICPs found. Create one to start scoring accounts."
          : `**${(icps || []).length} ICP${(icps || []).length > 1 ? 's' : ''}:**\n\n${(icps || []).map((i: any) =>
            `• **${i.name}** (${i.status}) - ${(i.industries || []).slice(0, 2).join(', ') || 'Any industry'}`
          ).join('\n')}`;

        const result = { icps, count: (icps || []).length, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_icp": {
        const { icp_id, updates } = parameters;
        if (!icp_id || !updates) {
          return new Response(JSON.stringify({ success: false, error: "icp_id and updates are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: icp, error } = await supabase
          .from("icp_profiles").update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", icp_id).eq("org_id", org_id).select().single();

        if (error) throw new Error(error.message);

        const result = { icp, message: `Updated ICP "${icp.name}".` };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_icp": {
        const { icp_id } = parameters;
        if (!icp_id) {
          return new Response(JSON.stringify({ success: false, error: "icp_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("icp_profiles").delete().eq("id", icp_id).eq("org_id", org_id);

        if (error) throw new Error(error.message);

        const result = { message: "ICP deleted successfully." };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown ICP action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions-ICP] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanningRule {
  id: string;
  rule_name: string;
  trigger_condition: {
    metric: string;
    operator: "gt" | "lt" | "eq" | "gte" | "lte";
    threshold: number;
    lookback_days?: number;
  };
  action_workflow: string;
  parameters_template: Record<string, unknown>;
  confidence_threshold: number;
  auto_execute: boolean;
  requires_approval: boolean;
}

interface ProactiveSuggestion {
  rule_id: string;
  rule_name: string;
  workflow: string;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  auto_execute: boolean;
  requires_approval: boolean;
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
      case "analyze": {
        // Get active planning rules
        const { data: rules, error: rulesError } = await supabase
          .from("ai_planning_rules")
          .select("*")
          .eq("org_id", org_id)
          .eq("is_active", true);

        if (rulesError) throw rulesError;

        const suggestions: ProactiveSuggestion[] = [];

        // Evaluate each rule
        for (const rule of rules || []) {
          const typedRule = rule as PlanningRule;
          const { metric, operator, threshold, lookback_days = 7 } = typedRule.trigger_condition;
          
          // Get current metric value based on rule type
          const metricValue = await evaluateMetric(supabase, org_id, metric, lookback_days);
          
          if (metricValue === null) continue;

          // Check if condition is met
          const conditionMet = evaluateCondition(metricValue, operator, threshold);
          
          if (conditionMet) {
            const confidence = calculateConfidence(metricValue, operator, threshold);
            
            suggestions.push({
              rule_id: typedRule.id,
              rule_name: typedRule.rule_name,
              workflow: typedRule.action_workflow,
              parameters: typedRule.parameters_template,
              confidence,
              reasoning: generateReasoning(metric, metricValue, operator, threshold),
              auto_execute: typedRule.auto_execute && confidence >= typedRule.confidence_threshold,
              requires_approval: typedRule.requires_approval,
            });
          }
        }

        // Sort by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);

        // Auto-execute high-confidence suggestions
        const executed: ProactiveSuggestion[] = [];
        for (const suggestion of suggestions) {
          if (suggestion.auto_execute && !suggestion.requires_approval) {
            try {
              await supabase.functions.invoke("ai-orchestrator", {
                body: {
                  org_id,
                  workflow: suggestion.workflow,
                  parameters: suggestion.parameters,
                  triggered_by: "agent-planner",
                  rule_id: suggestion.rule_id,
                },
              });
              
              // Update rule trigger count
              await supabase
                .from("ai_planning_rules")
                .update({
                  last_triggered_at: new Date().toISOString(),
                  trigger_count: supabase.sql`trigger_count + 1`,
                })
                .eq("id", suggestion.rule_id);

              executed.push(suggestion);
            } catch (execError) {
              console.error(`[agent-planner] Failed to execute ${suggestion.workflow}:`, execError);
            }
          }
        }

        // Store pending suggestions for user review
        const pendingSuggestions = suggestions.filter(s => s.requires_approval && !executed.includes(s));
        
        for (const suggestion of pendingSuggestions) {
          await supabase
            .from("ai_decision_feedback")
            .insert({
              org_id,
              agent_name: "agent-planner",
              decision_type: "proactive_workflow",
              entity_type: "planning_rule",
              entity_id: suggestion.rule_id,
              ai_recommendation: {
                workflow: suggestion.workflow,
                parameters: suggestion.parameters,
                reasoning: suggestion.reasoning,
              },
              confidence: suggestion.confidence,
              user_decision: "pending",
            });
        }

        console.log(`[agent-planner] Analyzed ${rules?.length || 0} rules, ${suggestions.length} suggestions, ${executed.length} auto-executed`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            suggestions,
            executed: executed.length,
            pending_approval: pendingSuggestions.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_rule": {
        const { rule_name, description, trigger_condition, action_workflow, parameters_template, confidence_threshold, auto_execute, requires_approval } = payload;

        const { data, error } = await supabase
          .from("ai_planning_rules")
          .insert({
            org_id,
            rule_name,
            description,
            trigger_condition,
            action_workflow,
            parameters_template: parameters_template || {},
            confidence_threshold: confidence_threshold || 0.8,
            auto_execute: auto_execute || false,
            requires_approval: requires_approval !== false,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, rule: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_rules": {
        const { data, error } = await supabase
          .from("ai_planning_rules")
          .select("*")
          .eq("org_id", org_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, rules: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "toggle_rule": {
        const { rule_id, is_active } = payload;

        const { data, error } = await supabase
          .from("ai_planning_rules")
          .update({ is_active })
          .eq("id", rule_id)
          .eq("org_id", org_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, rule: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_rule": {
        const { rule_id } = payload;

        const { error } = await supabase
          .from("ai_planning_rules")
          .delete()
          .eq("id", rule_id)
          .eq("org_id", org_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "seed_default_rules": {
        // Create default planning rules for new orgs
        const defaultRules = [
          {
            rule_name: "Low Enrichment Coverage",
            description: "Triggers data enrichment when accounts with missing data exceed threshold",
            trigger_condition: { metric: "accounts_missing_phone", operator: "gt", threshold: 100 },
            action_workflow: "data_enrichment",
            parameters_template: { batch_size: 50, priority: "high" },
            confidence_threshold: 0.8,
            auto_execute: false,
            requires_approval: true,
          },
          {
            rule_name: "Score Drift Detection",
            description: "Triggers ICP optimization when average score drops significantly",
            trigger_condition: { metric: "avg_score_change_pct", operator: "lt", threshold: -10, lookback_days: 7 },
            action_workflow: "optimize_icp",
            parameters_template: {},
            confidence_threshold: 0.9,
            auto_execute: false,
            requires_approval: true,
          },
          {
            rule_name: "Stale Leads Alert",
            description: "Suggests follow-up when qualified leads are untouched",
            trigger_condition: { metric: "qualified_leads_no_activity", operator: "gt", threshold: 50, lookback_days: 7 },
            action_workflow: "generate_follow_ups",
            parameters_template: {},
            confidence_threshold: 0.7,
            auto_execute: false,
            requires_approval: true,
          },
        ];

        for (const rule of defaultRules) {
          await supabase
            .from("ai_planning_rules")
            .upsert({
              org_id,
              ...rule,
            }, {
              onConflict: "org_id,rule_name",
              ignoreDuplicates: true,
            });
        }

        return new Response(
          JSON.stringify({ success: true, message: "Default rules seeded" }),
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
    console.error("[agent-planner] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function evaluateMetric(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  metric: string,
  lookbackDays: number
): Promise<number | null> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  switch (metric) {
    case "accounts_missing_phone": {
      const { count } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("phone", null);
      return count || 0;
    }
    case "accounts_missing_industry": {
      const { count } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("industry_norm", null);
      return count || 0;
    }
    case "leads_not_enriched": {
      const { count } = await supabase
        .from("Leads")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("enriched_at", null);
      return count || 0;
    }
    case "qualified_leads_no_activity": {
      const { data } = await supabase
        .from("Leads")
        .select("id")
        .eq("org_id", orgId)
        .eq("lead_status", "qualified")
        .lt("updated_at", since);
      return data?.length || 0;
    }
    case "agent_failure_rate": {
      const { data } = await supabase
        .from("ai_agent_runs")
        .select("status")
        .gte("started_at", since);
      
      if (!data || data.length === 0) return 0;
      const failures = data.filter(r => r.status === "failed").length;
      return (failures / data.length) * 100;
    }
    default:
      console.warn(`[agent-planner] Unknown metric: ${metric}`);
      return null;
  }
}

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt": return value > threshold;
    case "lt": return value < threshold;
    case "eq": return value === threshold;
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    default: return false;
  }
}

function calculateConfidence(value: number, operator: string, threshold: number): number {
  // Calculate confidence based on how far past the threshold we are
  const diff = Math.abs(value - threshold);
  const ratio = diff / Math.max(threshold, 1);
  return Math.min(0.5 + (ratio * 0.5), 1.0);
}

function generateReasoning(metric: string, value: number, operator: string, threshold: number): string {
  const opText = {
    gt: "exceeds",
    lt: "is below",
    eq: "equals",
    gte: "is at or above",
    lte: "is at or below",
  }[operator] || "meets";

  const metricNames: Record<string, string> = {
    accounts_missing_phone: "accounts without phone numbers",
    accounts_missing_industry: "accounts without industry data",
    leads_not_enriched: "leads not yet enriched",
    qualified_leads_no_activity: "qualified leads with no recent activity",
    agent_failure_rate: "agent failure rate",
  };

  const metricName = metricNames[metric] || metric;
  
  return `Current ${metricName} (${Math.round(value)}) ${opText} threshold (${threshold}). Automated action recommended.`;
}

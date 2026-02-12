import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RoutingConditions {
  geography?: string[];
  company_size_min?: number;
  company_size_max?: number;
  min_qualification_score?: number;
  industries?: string[];
}

interface AutoTask {
  type: string;
  title: string;
  due_offset_minutes: number;
  description?: string;
}

interface LeadData {
  id: string;
  org_id: string;
  email?: string;
  name?: string;
  company?: string;
  country?: string;
  employee_count?: number;
  industry?: string;
  qualification_score?: number;
  otp_status?: string;
}

type Tier = "P1" | "P2" | "P3";

interface TierConfig {
  tier: Tier;
  sla_minutes: number;
  channels: string[];
}

/**
 * Compute lead tier based on qualification score and OTP status.
 * P1: Score >= 80 + OTP passed → 5 min SLA
 * P2: Score 60-79 or missing OTP → 2 hour SLA
 * P3: Score < 60 → 24 hour SLA (nurture only)
 */
function computeTier(score: number | null | undefined, otpStatus: string | undefined): TierConfig {
  const s = score ?? 0;
  const otpPassed = otpStatus === "passed";

  if (s >= 80 && otpPassed) {
    return { tier: "P1", sla_minutes: 5, channels: ["call", "email", "linkedin"] };
  }
  if (s >= 60) {
    return { tier: "P2", sla_minutes: 120, channels: ["email", "linkedin"] };
  }
  return { tier: "P3", sla_minutes: 1440, channels: ["email"] };
}

function evaluateConditions(conditions: RoutingConditions, lead: LeadData): boolean {
  if (conditions.geography?.length) {
    const country = lead.country?.toUpperCase();
    if (!country || !conditions.geography.map(g => g.toUpperCase()).includes(country)) return false;
  }
  if (conditions.company_size_min != null && (lead.employee_count == null || lead.employee_count < conditions.company_size_min)) return false;
  if (conditions.company_size_max != null && (lead.employee_count == null || lead.employee_count > conditions.company_size_max)) return false;
  if (conditions.min_qualification_score != null && (lead.qualification_score == null || lead.qualification_score < conditions.min_qualification_score)) return false;
  if (conditions.industries?.length) {
    const industry = lead.industry?.toLowerCase();
    if (!industry || !conditions.industries.map(i => i.toLowerCase()).includes(industry)) return false;
  }
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, org_id, lead_data } = await req.json();

    if (!lead_id || !org_id) {
      return new Response(
        JSON.stringify({ error: "lead_id and org_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build lead data
    const lead: LeadData = { id: lead_id, org_id, ...lead_data };

    // Compute tier
    const tierConfig = computeTier(lead.qualification_score, lead.otp_status);
    console.log(`Lead ${lead_id}: score=${lead.qualification_score}, otp=${lead.otp_status} → ${tierConfig.tier} (SLA ${tierConfig.sla_minutes}m)`);

    // Fetch active routing rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from("lead_routing_rules")
      .select("*")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (rulesError) {
      console.error("Error fetching routing rules:", rulesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch routing rules" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Evaluate rules in priority order
    let matchedRule = null;
    if (rules?.length) {
      for (const rule of rules) {
        if (evaluateConditions(rule.conditions as RoutingConditions, lead)) {
          matchedRule = rule;
          break;
        }
      }
    }

    const now = new Date();
    // Use tier-based SLA (overrides rule SLA if tier provides shorter one)
    const effectiveSlaMinutes = matchedRule
      ? Math.min(matchedRule.sla_minutes, tierConfig.sla_minutes)
      : tierConfig.sla_minutes;
    const slaDeadline = new Date(now.getTime() + effectiveSlaMinutes * 60 * 1000);

    // Update marketing_leads with routing + tier info
    const updatePayload: Record<string, any> = {
      lp_tier: tierConfig.tier,
      sla_deadline: slaDeadline.toISOString(),
      sla_breached: false,
      routed_at: now.toISOString(),
    };

    if (matchedRule) {
      updatePayload.assigned_to = matchedRule.assigned_to;
      updatePayload.routing_rule_id = matchedRule.id;
      console.log(`Lead ${lead_id} matched rule: ${matchedRule.name} (priority ${matchedRule.priority})`);
    }

    const { error: updateError } = await supabase
      .from("marketing_leads")
      .update(updatePayload)
      .eq("id", lead_id);

    if (updateError) {
      console.error("Error updating lead with routing:", updateError);
    }

    // Create auto-tasks (filter by tier channels)
    if (matchedRule) {
      const autoTasks = (matchedRule.auto_tasks || []) as AutoTask[];
      const filteredTasks = autoTasks.filter(t => tierConfig.channels.includes(t.type) || !["call", "email", "linkedin"].includes(t.type));

      const tasksToInsert = filteredTasks.map((task) => ({
        org_id,
        lead_id: lead_id.toString(),
        lead_type: "marketing_lead",
        assigned_to: matchedRule.assigned_to,
        task_type: task.type,
        title: `[${tierConfig.tier}] ${task.title}`,
        description: task.description || null,
        due_at: new Date(now.getTime() + task.due_offset_minutes * 60 * 1000).toISOString(),
        status: "pending",
        routing_rule_id: matchedRule.id,
      }));

      if (tasksToInsert.length > 0) {
        const { error: tasksError } = await supabase.from("lead_tasks").insert(tasksToInsert);
        if (tasksError) console.error("Error creating tasks:", tasksError);
        else console.log(`Created ${tasksToInsert.length} tasks for ${tierConfig.tier} lead ${lead_id}`);
      }
    }

    // Fire alert to assigned rep
    try {
      const alertPayload = {
        org_id,
        alert_type: "lead_routed",
        message: `[${tierConfig.tier}] New lead: ${lead.name || lead.email || lead_id}${matchedRule ? ` via "${matchedRule.name}"` : ""}. SLA: ${effectiveSlaMinutes} minutes.`,
        metadata: {
          lead_id,
          tier: tierConfig.tier,
          rule_name: matchedRule?.name,
          assigned_to: matchedRule?.assigned_to,
          sla_deadline: slaDeadline.toISOString(),
          channels: tierConfig.channels,
        },
      };

      await fetch(`${supabaseUrl}/functions/v1/send-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(alertPayload),
      });
    } catch (alertErr) {
      console.error("Alert send failed (non-fatal):", alertErr);
    }

    // Push conversion event for qualified leads (P1/P2 only)
    if (tierConfig.tier !== "P3") {
      try {
        await fetch(`${supabaseUrl}/functions/v1/push-conversion-event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_name: "QualifiedLead",
            lead_id: lead_id,
            email: lead.email,
            org_id: org_id,
          }),
        });
        console.log(`QualifiedLead conversion event pushed for ${tierConfig.tier} lead ${lead_id}`);
      } catch (convErr) {
        console.error("Conversion push failed (non-fatal):", convErr);
      }
    }

    return new Response(
      JSON.stringify({
        routed: !!matchedRule,
        tier: tierConfig.tier,
        sla_minutes: effectiveSlaMinutes,
        rule_name: matchedRule?.name || null,
        assigned_to: matchedRule?.assigned_to || null,
        sla_deadline: slaDeadline.toISOString(),
        channels: tierConfig.channels,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in route-lead:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

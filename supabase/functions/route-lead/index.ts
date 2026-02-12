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
}

function evaluateConditions(conditions: RoutingConditions, lead: LeadData): boolean {
  if (conditions.geography?.length) {
    const country = lead.country?.toUpperCase();
    if (!country || !conditions.geography.map(g => g.toUpperCase()).includes(country)) {
      return false;
    }
  }

  if (conditions.company_size_min != null && (lead.employee_count == null || lead.employee_count < conditions.company_size_min)) {
    return false;
  }

  if (conditions.company_size_max != null && (lead.employee_count == null || lead.employee_count > conditions.company_size_max)) {
    return false;
  }

  if (conditions.min_qualification_score != null && (lead.qualification_score == null || lead.qualification_score < conditions.min_qualification_score)) {
    return false;
  }

  if (conditions.industries?.length) {
    const industry = lead.industry?.toLowerCase();
    if (!industry || !conditions.industries.map(i => i.toLowerCase()).includes(industry)) {
      return false;
    }
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

    if (!rules || rules.length === 0) {
      console.log("No active routing rules found for org:", org_id);
      return new Response(
        JSON.stringify({ routed: false, reason: "no_rules" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build lead data for evaluation
    const lead: LeadData = {
      id: lead_id,
      org_id,
      ...lead_data,
    };

    // Evaluate rules in priority order
    let matchedRule = null;
    for (const rule of rules) {
      const conditions = rule.conditions as RoutingConditions;
      if (evaluateConditions(conditions, lead)) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      console.log("No routing rule matched for lead:", lead_id);
      return new Response(
        JSON.stringify({ routed: false, reason: "no_match" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Lead ${lead_id} matched rule: ${matchedRule.name} (priority ${matchedRule.priority})`);

    const now = new Date();
    const slaDeadline = new Date(now.getTime() + matchedRule.sla_minutes * 60 * 1000);

    // Update marketing_leads with routing info
    const { error: updateError } = await supabase
      .from("marketing_leads")
      .update({
        assigned_to: matchedRule.assigned_to,
        routed_at: now.toISOString(),
        routing_rule_id: matchedRule.id,
        sla_deadline: slaDeadline.toISOString(),
        sla_breached: false,
      })
      .eq("id", lead_id);

    if (updateError) {
      console.error("Error updating lead with routing:", updateError);
    }

    // Create auto-tasks
    const autoTasks = (matchedRule.auto_tasks || []) as AutoTask[];
    const tasksToInsert = autoTasks.map((task) => ({
      org_id,
      lead_id: lead_id.toString(),
      lead_type: "marketing_lead",
      assigned_to: matchedRule.assigned_to,
      task_type: task.type,
      title: task.title,
      description: task.description || null,
      due_at: new Date(now.getTime() + task.due_offset_minutes * 60 * 1000).toISOString(),
      status: "pending",
      routing_rule_id: matchedRule.id,
    }));

    if (tasksToInsert.length > 0) {
      const { error: tasksError } = await supabase
        .from("lead_tasks")
        .insert(tasksToInsert);

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
      } else {
        console.log(`Created ${tasksToInsert.length} tasks for lead ${lead_id}`);
      }
    }

    // Fire alert to assigned rep via send-alert
    try {
      const alertPayload = {
        org_id,
        alert_type: "lead_routed",
        message: `New lead assigned: ${lead.name || lead.email || lead_id} via rule "${matchedRule.name}". SLA: ${matchedRule.sla_minutes} minutes.`,
        metadata: {
          lead_id,
          rule_name: matchedRule.name,
          assigned_to: matchedRule.assigned_to,
          sla_deadline: slaDeadline.toISOString(),
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

    return new Response(
      JSON.stringify({
        routed: true,
        rule_name: matchedRule.name,
        assigned_to: matchedRule.assigned_to,
        sla_deadline: slaDeadline.toISOString(),
        tasks_created: tasksToInsert.length,
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

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

interface RepProfile {
  user_id: string;
  working_hours_start: string | null;
  working_hours_end: string | null;
  timezone: string | null;
  max_leads_per_day: number | null;
}

interface RepAvailability {
  repId: string;
  overflowed: boolean;
  overflow_reason: "capacity" | "working_hours" | null;
  original_rep: string | null;
}

function computeTier(score: number | null | undefined, otpStatus: string | undefined): TierConfig {
  const s = score ?? 0;
  const otpPassed = otpStatus === "passed";
  if (s >= 80 && otpPassed) return { tier: "P1", sla_minutes: 5, channels: ["call", "email", "linkedin"] };
  if (s >= 60) return { tier: "P2", sla_minutes: 120, channels: ["email", "linkedin"] };
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

function isWithinWorkingHours(rep: RepProfile, now: Date): boolean {
  const start = rep.working_hours_start;
  const end = rep.working_hours_end;
  if (!start || !end) return true; // No hours configured = always available

  const tz = rep.timezone || "UTC";
  let currentHour: number, currentMinute: number;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false });
    const parts = fmt.formatToParts(now);
    currentHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
    currentMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  } catch {
    console.warn(`Invalid timezone "${tz}" for rep ${rep.user_id}, assuming available`);
    return true;
  }

  const currentMins = currentHour * 60 + currentMinute;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight shift (e.g. 22:00 - 06:00)
  return currentMins >= startMins || currentMins < endMins;
}

async function findAvailableRep(
  supabase: ReturnType<typeof createClient>,
  org_id: string,
  preferredRepId: string,
  now: Date
): Promise<RepAvailability> {
  // Fetch all reps
  const { data: reps, error: repsErr } = await supabase
    .from("user_profiles")
    .select("user_id, working_hours_start, working_hours_end, timezone, max_leads_per_day")
    .eq("org_id", org_id);

  if (repsErr || !reps?.length) {
    console.warn("Could not fetch reps, using preferred rep:", repsErr?.message);
    return { repId: preferredRepId, overflowed: false, overflow_reason: null, original_rep: null };
  }

  // Count today's leads per rep
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayLeads } = await supabase
    .from("marketing_leads")
    .select("assigned_to")
    .eq("org_id", org_id)
    .gte("routed_at", todayStart.toISOString())
    .not("assigned_to", "is", null);

  const leadCounts: Record<string, number> = {};
  for (const row of todayLeads || []) {
    leadCounts[row.assigned_to] = (leadCounts[row.assigned_to] || 0) + 1;
  }

  const checkAvailability = (rep: RepProfile): { available: boolean; reason: "capacity" | "working_hours" | null } => {
    if (!isWithinWorkingHours(rep, now)) return { available: false, reason: "working_hours" };
    const max = rep.max_leads_per_day;
    if (max != null && (leadCounts[rep.user_id] || 0) >= max) return { available: false, reason: "capacity" };
    return { available: true, reason: null };
  };

  // Check preferred rep
  const preferred = reps.find(r => r.user_id === preferredRepId);
  if (preferred) {
    const result = checkAvailability(preferred);
    if (result.available) {
      return { repId: preferredRepId, overflowed: false, overflow_reason: null, original_rep: null };
    }

    // Try overflow: sort others by fewest leads today
    const others = reps
      .filter(r => r.user_id !== preferredRepId)
      .sort((a, b) => (leadCounts[a.user_id] || 0) - (leadCounts[b.user_id] || 0));

    for (const rep of others) {
      if (checkAvailability(rep).available) {
        console.log(`Overflow: ${preferredRepId} → ${rep.user_id} (reason: ${result.reason})`);
        return { repId: rep.user_id, overflowed: true, overflow_reason: result.reason, original_rep: preferredRepId };
      }
    }

    // No one available, fall back to preferred
    console.warn(`No available reps in org ${org_id}, falling back to preferred rep ${preferredRepId}`);
    return { repId: preferredRepId, overflowed: false, overflow_reason: null, original_rep: null };
  }

  // Preferred rep not found in profiles, use as-is
  return { repId: preferredRepId, overflowed: false, overflow_reason: null, original_rep: null };
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

    const lead: LeadData = { id: lead_id, org_id, ...lead_data };
    const tierConfig = computeTier(lead.qualification_score, lead.otp_status);
    const now = new Date();

    console.log(`Lead ${lead_id}: score=${lead.qualification_score}, otp=${lead.otp_status} → ${tierConfig.tier} (SLA ${tierConfig.sla_minutes}m)`);

    // Fetch active routing rules
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

    // Evaluate rules
    let matchedRule = null;
    if (rules?.length) {
      for (const rule of rules) {
        if (evaluateConditions(rule.conditions as RoutingConditions, lead)) {
          matchedRule = rule;
          break;
        }
      }
    }

    const effectiveSlaMinutes = matchedRule
      ? Math.min(matchedRule.sla_minutes, tierConfig.sla_minutes)
      : tierConfig.sla_minutes;
    const slaDeadline = new Date(now.getTime() + effectiveSlaMinutes * 60 * 1000);

    // Determine assigned rep with capacity/hours check
    let availability: RepAvailability = { repId: "", overflowed: false, overflow_reason: null, original_rep: null };
    let assignedTo: string | null = null;

    if (matchedRule?.assigned_to) {
      availability = await findAvailableRep(supabase, org_id, matchedRule.assigned_to, now);
      assignedTo = availability.repId;
      if (availability.overflowed) {
        console.log(`Lead ${lead_id} overflowed from ${availability.original_rep} to ${assignedTo} (${availability.overflow_reason})`);
      } else {
        console.log(`Lead ${lead_id} matched rule: ${matchedRule.name} → rep ${assignedTo}`);
      }
    }

    // Update lead
    const updatePayload: Record<string, any> = {
      lp_tier: tierConfig.tier,
      sla_deadline: slaDeadline.toISOString(),
      sla_breached: false,
      routed_at: now.toISOString(),
    };

    if (assignedTo) {
      updatePayload.assigned_to = assignedTo;
    }
    if (matchedRule) {
      updatePayload.routing_rule_id = matchedRule.id;
    }

    const { error: updateError } = await supabase
      .from("marketing_leads")
      .update(updatePayload)
      .eq("id", lead_id);

    if (updateError) console.error("Error updating lead:", updateError);

    // Create auto-tasks
    if (matchedRule && assignedTo) {
      const autoTasks = (matchedRule.auto_tasks || []) as AutoTask[];
      const filteredTasks = autoTasks.filter(t => tierConfig.channels.includes(t.type) || !["call", "email", "linkedin"].includes(t.type));

      const tasksToInsert = filteredTasks.map((task) => ({
        org_id,
        lead_id: lead_id.toString(),
        lead_type: "marketing_lead",
        assigned_to: assignedTo,
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

    // Fire alert
    try {
      const alertPayload = {
        org_id,
        alert_type: "lead_routed",
        message: `[${tierConfig.tier}] New lead: ${lead.name || lead.email || lead_id}${matchedRule ? ` via "${matchedRule.name}"` : ""}${availability.overflowed ? ` (overflow from ${availability.original_rep})` : ""}. SLA: ${effectiveSlaMinutes} minutes.`,
        metadata: {
          lead_id,
          tier: tierConfig.tier,
          rule_name: matchedRule?.name,
          assigned_to: assignedTo,
          sla_deadline: slaDeadline.toISOString(),
          channels: tierConfig.channels,
          overflow: availability.overflowed,
          overflow_reason: availability.overflow_reason,
        },
      };

      await fetch(`${supabaseUrl}/functions/v1/send-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify(alertPayload),
      });
    } catch (alertErr) {
      console.error("Alert send failed (non-fatal):", alertErr);
    }

    // Push conversion event for P1/P2
    if (tierConfig.tier !== "P3") {
      try {
        await fetch(`${supabaseUrl}/functions/v1/push-conversion-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ event_name: "QualifiedLead", lead_id, email: lead.email, org_id }),
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
        assigned_to: assignedTo || null,
        sla_deadline: slaDeadline.toISOString(),
        channels: tierConfig.channels,
        overflow: availability.overflowed,
        overflow_reason: availability.overflow_reason,
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

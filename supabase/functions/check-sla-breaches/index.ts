import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find leads past SLA deadline that haven't been marked breached
    const { data: breachedLeads, error } = await supabase
      .from("marketing_leads")
      .select("id, email, name, org_id, assigned_to, sla_deadline, routing_rule_id")
      .eq("sla_breached", false)
      .not("sla_deadline", "is", null)
      .lt("sla_deadline", now);

    if (error) {
      console.error("Error finding breached leads:", error);
      return new Response(
        JSON.stringify({ error: "Failed to query breached leads" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!breachedLeads || breachedLeads.length === 0) {
      return new Response(
        JSON.stringify({ breaches: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${breachedLeads.length} SLA breaches`);

    // Mark leads as breached
    const breachedIds = breachedLeads.map((l) => l.id);
    const { error: updateError } = await supabase
      .from("marketing_leads")
      .update({ sla_breached: true })
      .in("id", breachedIds);

    if (updateError) {
      console.error("Error marking leads as breached:", updateError);
    }

    // Mark any pending tasks for these leads as overdue
    for (const lead of breachedLeads) {
      await supabase
        .from("lead_tasks")
        .update({ status: "overdue" })
        .eq("lead_id", lead.id.toString())
        .eq("status", "pending")
        .lt("due_at", now);
    }

    // Group breaches by org for alert batching
    const byOrg: Record<string, typeof breachedLeads> = {};
    for (const lead of breachedLeads) {
      if (!byOrg[lead.org_id]) byOrg[lead.org_id] = [];
      byOrg[lead.org_id].push(lead);
    }

    // Send escalation alerts per org
    for (const [orgId, leads] of Object.entries(byOrg)) {
      try {
        const leadNames = leads.map((l) => l.name || l.email || l.id).join(", ");
        await fetch(`${supabaseUrl}/functions/v1/send-alert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            org_id: orgId,
            alert_type: "sla_breach",
            message: `⚠️ SLA Breach: ${leads.length} lead(s) have exceeded their response SLA: ${leadNames}`,
            metadata: { breached_lead_ids: leads.map((l) => l.id) },
          }),
        });
      } catch (alertErr) {
        console.error("SLA alert failed for org", orgId, alertErr);
      }
    }

    return new Response(
      JSON.stringify({ breaches: breachedLeads.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-sla-breaches:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

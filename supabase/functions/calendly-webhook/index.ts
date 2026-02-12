import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    const eventType = payload.event; // "invitee.created" or "invitee.canceled"
    const invitee = payload.payload?.invitee || payload.payload;

    console.log(`Calendly webhook: ${eventType}`, JSON.stringify(invitee));

    if (eventType !== "invitee.created") {
      return new Response(JSON.stringify({ received: true, action: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const email = invitee?.email?.toLowerCase();
    const name = invitee?.name;
    const scheduledAt = invitee?.scheduled_event?.start_time || payload.payload?.scheduled_event?.start_time;
    const eventName = invitee?.scheduled_event?.name || payload.payload?.scheduled_event?.name || "Meeting";

    if (!email) {
      console.warn("Calendly webhook: no email in payload");
      return new Response(JSON.stringify({ received: true, error: "no email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Match to existing marketing lead
    const { data: lead } = await supabase
      .from("marketing_leads")
      .select("id, org_id, name, email, status")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let orgId: string | null = null;

    if (lead) {
      orgId = lead.org_id;
      console.log(`Matched Calendly booking to lead ${lead.id} (${lead.email})`);

      // Update lead status to demo_scheduled
      await supabase
        .from("marketing_leads")
        .update({ status: "demo_scheduled" })
        .eq("id", lead.id);

      // Create a task for the assigned rep
      const { data: tasks } = await supabase
        .from("lead_tasks")
        .select("assigned_to")
        .eq("lead_id", lead.id.toString())
        .eq("lead_type", "marketing_lead")
        .limit(1)
        .single();

      if (tasks?.assigned_to) {
        await supabase.from("lead_tasks").insert({
          org_id: lead.org_id,
          lead_id: lead.id.toString(),
          lead_type: "marketing_lead",
          assigned_to: tasks.assigned_to,
          task_type: "meeting_prep",
          title: `Prepare for ${eventName} with ${name || email}`,
          description: `Meeting scheduled via Calendly for ${scheduledAt || "TBD"}. Review lead profile and prepare talking points.`,
          due_at: scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
        });
      }

      // Push conversion event
      try {
        await fetch(`${supabaseUrl}/functions/v1/push-conversion-event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            event_name: "Schedule",
            lead_id: lead.id,
            email,
            org_id: lead.org_id,
          }),
        });
      } catch (convErr) {
        console.error("Conversion push failed (non-fatal):", convErr);
      }
    } else {
      console.log(`No matching lead for Calendly booking: ${email}`);
    }

    // Log funnel event
    await supabase.from("funnel_events").insert({
      org_id: orgId,
      event_type: "calendly_booking",
      event_status: "success",
      event_source: "calendly",
      lead_id: lead?.id || null,
      metadata: {
        email,
        name,
        event_name: eventName,
        scheduled_at: scheduledAt,
        matched_lead: !!lead,
      },
    });

    return new Response(
      JSON.stringify({ received: true, matched_lead: !!lead, lead_id: lead?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Calendly webhook error:", error);

    // Log failure
    await supabase.from("funnel_events").insert({
      event_type: "calendly_booking",
      event_status: "failure",
      event_source: "calendly",
      error_message: error.message,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

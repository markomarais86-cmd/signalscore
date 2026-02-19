import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;
const MAX_RUNTIME_MS = 45_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { org_id, batch_size, triggered_by } = await req.json();

    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = batch_size || BATCH_SIZE;
    console.log(`[bulk-verify-contacts] Starting for org ${org_id}, batch: ${limit}, trigger: ${triggered_by || 'manual'}`);

    // Resolve parent org (leads live under parent)
    const { data: orgData } = await supabase
      .from("organizations")
      .select("parent_org_id")
      .eq("id", org_id)
      .single();
    const dataOrgId = orgData?.parent_org_id || org_id;

    // Fetch qualified leads with unverified emails
    const { data: leads, error: leadsError } = await supabase
      .from("Leads")
      .select("id, email, phone, org_id")
      .eq("org_id", dataOrgId)
      .eq("status", "qualified")
      .is("email_verified", null)
      .not("email", "is", null)
      .limit(limit);

    if (leadsError) {
      console.error("[bulk-verify-contacts] Error fetching leads:", leadsError);
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      console.log("[bulk-verify-contacts] No unverified qualified leads found");
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        verified: 0,
        message: "No unverified qualified leads to process",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[bulk-verify-contacts] Found ${leads.length} leads to verify`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let processed = 0;
    let emailsVerified = 0;
    let phonesVerified = 0;
    let errors = 0;

    for (const lead of leads) {
      // Check timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[bulk-verify-contacts] ⏰ Timeout after ${processed} contacts`);
        break;
      }

      // Verify email
      if (lead.email) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/verify-contact`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contact_id: lead.id,
              verification_type: "email",
              org_id: lead.org_id,
            }),
          });

          if (response.ok) {
            emailsVerified++;
          } else {
            console.warn(`[bulk-verify-contacts] Email verify failed for lead ${lead.id}:`, await response.text());
            errors++;
          }
        } catch (e) {
          console.error(`[bulk-verify-contacts] Email verify error for lead ${lead.id}:`, e);
          errors++;
        }
      }

      // Verify phone if available
      if (lead.phone) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/verify-contact`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contact_id: lead.id,
              verification_type: "phone",
              org_id: lead.org_id,
            }),
          });

          if (response.ok) {
            phonesVerified++;
          } else {
            errors++;
          }
        } catch (e) {
          errors++;
        }
      }

      processed++;

      // Small delay to avoid rate limiting (100ms between contacts)
      if (processed < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[bulk-verify-contacts] Done: ${processed} processed, ${emailsVerified} emails, ${phonesVerified} phones verified, ${errors} errors, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      emails_verified: emailsVerified,
      phones_verified: phonesVerified,
      errors,
      duration_ms: duration,
      timed_out: Date.now() - startTime > MAX_RUNTIME_MS,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[bulk-verify-contacts] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

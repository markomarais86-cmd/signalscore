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

  try {
    const { phone, lead_id } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "phone is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const apiKey = Deno.env.get("NUMVERIFY_API_KEY");
    if (!apiKey) {
      console.error("NUMVERIFY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Phone validation service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call NumVerify API
    const cleanPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    const numverifyUrl = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${encodeURIComponent(cleanPhone)}&format=1`;
    
    const nvResponse = await fetch(numverifyUrl);
    const nvData = await nvResponse.json();

    console.log(`NumVerify result for ${cleanPhone}:`, JSON.stringify(nvData));

    const result = {
      valid: nvData.valid === true,
      number: nvData.international_format || cleanPhone,
      country_code: nvData.country_code || null,
      country_name: nvData.country_name || null,
      carrier: nvData.carrier || null,
      line_type: nvData.line_type || null, // mobile, landline, voip, etc.
      location: nvData.location || null,
    };

    // Persist to DB if lead_id provided
    if (lead_id && result.valid) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from("marketing_leads")
        .update({
          phone: result.number,
          phone_valid: true,
          phone_carrier: result.carrier,
          phone_line_type: result.line_type,
          otp_status: "passed", // Validated phone = passed for tier routing
        })
        .eq("id", lead_id);

      if (updateError) {
        console.error("Failed to update lead phone:", updateError);
      }

      // Log funnel event
      const { data: lead } = await supabase
        .from("marketing_leads")
        .select("org_id")
        .eq("id", lead_id)
        .single();

      if (lead?.org_id) {
        await supabase.from("funnel_events").insert({
          org_id: lead.org_id,
          event_type: "phone_verification",
          event_status: "success",
          event_source: "numverify",
          lead_id,
          metadata: { line_type: result.line_type, carrier: result.carrier, country: result.country_code },
        });
      }
    }

    // Log failure event
    if (lead_id && !result.valid) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: lead } = await supabase
        .from("marketing_leads")
        .select("org_id")
        .eq("id", lead_id)
        .single();

      if (lead?.org_id) {
        await supabase.from("funnel_events").insert({
          org_id: lead.org_id,
          event_type: "phone_verification",
          event_status: "failure",
          event_source: "numverify",
          lead_id,
          error_message: "Phone number validation failed",
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in validate-phone:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

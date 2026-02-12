import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConversionEvent {
  event_name: string; // e.g. "Lead", "Purchase", "CompleteRegistration"
  lead_id?: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  click_ids?: Record<string, string>; // gclid, fbclid, li_fat_id
  utm_source?: string;
  utm_campaign?: string;
  org_id?: string;
  platforms?: string[]; // ['ga4', 'meta', 'linkedin'] — defaults to all
}

async function pushGA4(event: ConversionEvent): Promise<{ success: boolean; error?: string }> {
  const measurementId = Deno.env.get("GA4_MEASUREMENT_ID");
  const apiSecret = Deno.env.get("GA4_API_SECRET");
  if (!measurementId || !apiSecret) return { success: false, error: "GA4 credentials not configured" };

  try {
    const payload = {
      client_id: event.click_ids?.gclid || event.email || crypto.randomUUID(),
      events: [{
        name: event.event_name.toLowerCase().replace(/\s+/g, "_"),
        params: {
          value: event.value || 0,
          currency: event.currency || "USD",
          lead_id: event.lead_id,
          utm_source: event.utm_source,
          utm_campaign: event.utm_campaign,
        },
      }],
    };

    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      { method: "POST", body: JSON.stringify(payload) }
    );

    return { success: res.ok, error: res.ok ? undefined : `GA4 HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function pushMetaCAPI(event: ConversionEvent): Promise<{ success: boolean; error?: string }> {
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const accessToken = Deno.env.get("META_CAPI_TOKEN");
  if (!pixelId || !accessToken) return { success: false, error: "Meta CAPI credentials not configured" };

  try {
    const eventData: any = {
      event_name: event.event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: {},
    };

    if (event.email) {
      // Hash email for Meta CAPI (SHA-256)
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(event.email.toLowerCase().trim()));
      eventData.user_data.em = [Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")];
    }
    if (event.phone) {
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(event.phone.replace(/\D/g, "")));
      eventData.user_data.ph = [Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")];
    }
    if (event.click_ids?.fbclid) {
      eventData.user_data.fbc = `fb.1.${Date.now()}.${event.click_ids.fbclid}`;
    }
    if (event.value) {
      eventData.custom_data = { value: event.value, currency: event.currency || "USD" };
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [eventData] }),
      }
    );

    const body = await res.json();
    return { success: res.ok, error: res.ok ? undefined : JSON.stringify(body.error) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function pushLinkedInCAPI(event: ConversionEvent): Promise<{ success: boolean; error?: string }> {
  const accessToken = Deno.env.get("LINKEDIN_CAPI_TOKEN");
  const adAccountId = Deno.env.get("LINKEDIN_AD_ACCOUNT_ID");
  if (!accessToken || !adAccountId) return { success: false, error: "LinkedIn CAPI credentials not configured" };

  try {
    const conversionData: any = {
      conversion: `urn:lla:llaPartnerConversion:${adAccountId}`,
      conversionHappenedAt: Date.now(),
      eventId: crypto.randomUUID(),
    };

    if (event.email) {
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(event.email.toLowerCase().trim()));
      conversionData.user = {
        userIds: [{ idType: "SHA256_EMAIL", idValue: Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("") }],
      };
    }
    if (event.click_ids?.li_fat_id) {
      conversionData.user = conversionData.user || {};
      conversionData.user.userIds = conversionData.user.userIds || [];
      conversionData.user.userIds.push({ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: event.click_ids.li_fat_id });
    }

    const res = await fetch("https://api.linkedin.com/rest/conversionEvents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202401",
      },
      body: JSON.stringify({ elements: [conversionData] }),
    });

    return { success: res.ok || res.status === 201, error: res.ok ? undefined : `LinkedIn HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event: ConversionEvent = await req.json();

    if (!event.event_name) {
      return new Response(
        JSON.stringify({ error: "event_name is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const platforms = event.platforms || ["ga4", "meta", "linkedin"];
    const results: Record<string, { success: boolean; error?: string }> = {};

    // Push to all platforms in parallel
    const pushes: Promise<void>[] = [];

    if (platforms.includes("ga4")) {
      pushes.push(pushGA4(event).then(r => { results.ga4 = r; }));
    }
    if (platforms.includes("meta")) {
      pushes.push(pushMetaCAPI(event).then(r => { results.meta = r; }));
    }
    if (platforms.includes("linkedin")) {
      pushes.push(pushLinkedInCAPI(event).then(r => { results.linkedin = r; }));
    }

    await Promise.all(pushes);

    // Log funnel events
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const funnelEvents = Object.entries(results).map(([platform, result]) => ({
      org_id: event.org_id || null,
      event_type: "conversion_push",
      event_status: result.success ? "success" : "failure",
      event_source: platform === "meta" ? "meta_capi" : platform === "linkedin" ? "linkedin_capi" : "ga4",
      lead_id: event.lead_id || null,
      metadata: { event_name: event.event_name, value: event.value, utm_campaign: event.utm_campaign },
      error_message: result.error || null,
    }));

    if (funnelEvents.length > 0) {
      await supabase.from("funnel_events").insert(funnelEvents);
    }

    console.log(`Conversion "${event.event_name}" pushed:`, results);

    return new Response(
      JSON.stringify({ results, any_success: Object.values(results).some(r => r.success) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in push-conversion-event:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

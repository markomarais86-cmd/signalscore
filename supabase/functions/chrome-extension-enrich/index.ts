import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LinkedInCompanyData {
  name: string;
  domain?: string;
  employee_count?: number;
  industry?: string;
  country?: string;
  city?: string;
  linkedin_url?: string;
  description?: string;
}

interface LinkedInPersonData {
  first_name: string;
  last_name: string;
  title?: string;
  company_name?: string;
  linkedin_url?: string;
  location?: string;
  location_city?: string;
  location_region?: string;
}

interface RequestBody {
  type: "company" | "person";
  data: LinkedInCompanyData | LinkedInPersonData;
  api_key: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RequestBody = await req.json();
    const { type, data, api_key } = body;

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate API key and get org_id
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("org_id, is_active")
      .eq("key_prefix", api_key.substring(0, 8))
      .single();

    if (apiKeyError || !apiKeyData?.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = apiKeyData.org_id;

    if (type === "company") {
      const companyData = data as LinkedInCompanyData;
      
      // Generate external_id from domain or name
      const externalId = `linkedin_${companyData.domain?.replace(/[^a-z0-9]/gi, "_") || companyData.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}`;

      // Try to enrich with Firecrawl if domain is available
      let enrichedData = { ...companyData };
      
      if (companyData.domain) {
        try {
          const firecrawlResponse = await fetch(
            `${supabaseUrl}/functions/v1/enrich-with-firecrawl`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ domain: companyData.domain }),
            }
          );

          if (firecrawlResponse.ok) {
            const firecrawlData = await firecrawlResponse.json();
            if (firecrawlData.company) {
              // Merge Firecrawl data with LinkedIn data (LinkedIn takes precedence for existing fields)
              enrichedData = {
                ...firecrawlData.company,
                ...companyData,
                // Prefer Firecrawl's employee count if more precise
                employee_count: companyData.employee_count || firecrawlData.company.employee_count,
              };
            }
          }
        } catch (e) {
          console.log("Firecrawl enrichment failed, using LinkedIn data only:", e);
        }
      }

      // Save to accounts table
      const { data: savedAccount, error: saveError } = await supabase
        .from("accounts")
        .upsert({
          external_id: externalId,
          org_id: orgId,
          name: enrichedData.name,
          domain: enrichedData.domain,
          employee_count: enrichedData.employee_count,
          industry_raw: enrichedData.industry,
          country: enrichedData.country,
          city: enrichedData.city,
          linkedin_url: enrichedData.linkedin_url,
          enriched_at: new Date().toISOString(),
          enriched_from: "chrome_extension_linkedin",
          data_source: "linkedin",
        }, {
          onConflict: "external_id,org_id",
        })
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
        return new Response(
          JSON.stringify({ error: "Failed to save company", details: saveError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update API key last_used_at
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_prefix", api_key.substring(0, 8));

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Company saved successfully",
          account: savedAccount 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (type === "person") {
      const personData = data as LinkedInPersonData;
      
      // Parse location into city and region if provided as single string
      let locationCity = personData.location_city;
      let locationRegion = personData.location_region;
      
      if (personData.location && !locationCity) {
        const locationParts = personData.location.split(",").map(p => p.trim());
        if (locationParts.length >= 2) {
          locationCity = locationParts[0];
          locationRegion = locationParts.slice(1).join(", ");
        } else if (locationParts.length === 1) {
          locationCity = locationParts[0];
        }
      }

      // Save person data to Leads table with correct column names
      const { data: savedLead, error: saveError } = await supabase
        .from("Leads")
        .insert({
          org_id: orgId,
          first_name: personData.first_name,
          last_name: personData.last_name,
          name: `${personData.first_name} ${personData.last_name}`.trim(),
          title: personData.title,
          company: personData.company_name,
          linkedin_url: personData.linkedin_url,
          location_city: locationCity,
          location_region: locationRegion,
          data_source: "linkedin_chrome_extension",
        })
        .select()
        .single();

      if (saveError) {
        console.error("Save error:", saveError);
        return new Response(
          JSON.stringify({ error: "Failed to save person", details: saveError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update API key last_used_at
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_prefix", api_key.substring(0, 8));

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Person saved successfully",
          lead: savedLead 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid type. Use 'company' or 'person'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chrome extension enrich error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

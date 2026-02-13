import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { document_text, company_name, website_url, org_id } = await req.json();

    if (!document_text || !company_name) {
      return new Response(
        JSON.stringify({ error: "document_text and company_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call AI with tool calling to extract structured ICP data
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert B2B sales strategist. Extract the Ideal Customer Profile (ICP) from the provided document. Be thorough and extract every detail. For company_sizes, use employee count numbers (e.g., [50, 200, 1000, 5000]). For revenue_ranges use strings like "$10M-$50M". Extract ALL personas, job titles, industries, geographies, and buying triggers mentioned.`,
          },
          {
            role: "user",
            content: `Extract the complete ICP profile from this document for ${company_name}${website_url ? ` (${website_url})` : ""}:\n\n${document_text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_icp_profile",
              description: "Extract all ICP fields from the document into a structured profile",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Brief description of the ICP" },
                  industries: { type: "array", items: { type: "string" }, description: "Target industries" },
                  sub_industries: { type: "array", items: { type: "string" }, description: "Sub-industries or verticals" },
                  excluded_industries: { type: "array", items: { type: "string" }, description: "Industries to exclude" },
                  company_sizes: { type: "array", items: { type: "number" }, description: "Employee count thresholds e.g. [50, 200, 1000]" },
                  revenue_ranges: { type: "array", items: { type: "string" }, description: "Revenue ranges e.g. ['$10M-$50M']" },
                  geographies: { type: "array", items: { type: "string" }, description: "Target geographies/countries" },
                  regions: { type: "array", items: { type: "string" }, description: "Target regions e.g. North America, EMEA" },
                  persona_job_titles: { type: "array", items: { type: "string" }, description: "Target job titles" },
                  persona_seniority_levels: { type: "array", items: { type: "string" }, description: "Seniority levels e.g. VP, Director, C-Suite" },
                  persona_departments: { type: "array", items: { type: "string" }, description: "Target departments" },
                  persona_decision_roles: { type: "array", items: { type: "string" }, description: "Decision roles e.g. Decision Maker, Influencer, Champion" },
                  buying_triggers: { type: "array", items: { type: "string" }, description: "Events that trigger buying" },
                  buying_signals: { type: "array", items: { type: "string" }, description: "Signals indicating buying intent" },
                  pain_points: { type: "array", items: { type: "string" }, description: "Key pain points the product solves" },
                  company_stages: { type: "array", items: { type: "string" }, description: "Company stages e.g. Growth, Enterprise" },
                  growth_stage: { type: "array", items: { type: "string" }, description: "Growth stages e.g. Series B, IPO" },
                  tech_stack: { type: "array", items: { type: "string" }, description: "Relevant tech stack" },
                  budget_indicators: { type: "array", items: { type: "string" }, description: "Budget indicators" },
                  competitive_landscape: { type: "array", items: { type: "string" }, description: "Competitors mentioned" },
                  use_case: { type: "string", description: "Primary use case" },
                },
                required: ["description", "industries", "geographies", "persona_job_titles"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_icp_profile" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI did not return structured ICP data");
    }

    const icpData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted ICP data:", JSON.stringify(icpData).slice(0, 500));

    // Create or use existing org
    let effectiveOrgId = org_id;
    if (!effectiveOrgId) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("name", company_name)
        .maybeSingle();

      if (existingOrg) {
        effectiveOrgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({ name: company_name })
          .select("id")
          .single();
        if (orgError) throw orgError;
        effectiveOrgId = newOrg.id;
      }
    }

    // Insert ICP profile
    const { data: icpProfile, error: icpError } = await supabase
      .from("icp_profiles")
      .insert({
        org_id: effectiveOrgId,
        name: `${company_name} - Primary ICP`,
        is_primary: true,
        status: "active",
        description: icpData.description || null,
        industries: icpData.industries || null,
        sub_industries: icpData.sub_industries || null,
        excluded_industries: icpData.excluded_industries || null,
        company_sizes: icpData.company_sizes || null,
        revenue_ranges: icpData.revenue_ranges || null,
        geographies: icpData.geographies || null,
        regions: icpData.regions || null,
        persona_job_titles: icpData.persona_job_titles || null,
        persona_seniority_levels: icpData.persona_seniority_levels || null,
        persona_departments: icpData.persona_departments || null,
        persona_decision_roles: icpData.persona_decision_roles || null,
        buying_triggers: icpData.buying_triggers || null,
        buying_signals: icpData.buying_signals || null,
        pain_points: icpData.pain_points || null,
        company_stages: icpData.company_stages || null,
        growth_stage: icpData.growth_stage || null,
        tech_stack: icpData.tech_stack || null,
        budget_indicators: icpData.budget_indicators || null,
        competitive_landscape: icpData.competitive_landscape || null,
        use_case: icpData.use_case || null,
        template_source: "ai-parsed",
      })
      .select("id")
      .single();

    if (icpError) throw icpError;

    // Also populate org_onboarding_config with extracted data (if fields are empty)
    try {
      const { data: existingConfig } = await supabase
        .from("org_onboarding_config")
        .select("id, value_proposition, target_persona_description")
        .eq("org_id", effectiveOrgId)
        .maybeSingle();

      const updates: Record<string, string> = {};
      if (!existingConfig?.value_proposition && icpData.description) {
        updates.value_proposition = icpData.description;
      }
      if (!existingConfig?.target_persona_description && icpData.persona_job_titles?.length) {
        updates.target_persona_description = icpData.persona_job_titles.join(", ");
      }

      if (Object.keys(updates).length > 0) {
        if (existingConfig) {
          await supabase
            .from("org_onboarding_config")
            .update(updates)
            .eq("org_id", effectiveOrgId);
        } else {
          await supabase
            .from("org_onboarding_config")
            .insert({ org_id: effectiveOrgId, ...updates });
        }
      }
    } catch (configErr) {
      console.error("Failed to update onboarding config (non-fatal):", configErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        org_id: effectiveOrgId,
        icp_id: icpProfile.id,
        extracted_fields: Object.keys(icpData).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-icp-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

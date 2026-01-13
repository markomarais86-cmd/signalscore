import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// ============= Configuration =============
const CONFIDENCE_THRESHOLD = 60;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY = 500;

// ============= Types =============
interface AccountToEnrich {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  linkedin_url: string | null;
}

interface EnrichedField {
  value: any;
  confidence: number;
  reasoning: string;
}

interface AIEnrichmentResult {
  external_id: string;
  employee_count?: EnrichedField;
  revenue_range?: EnrichedField;
  industry_norm?: EnrichedField;
  country?: EnrichedField;
  business_model?: EnrichedField;
  linkedin_url?: EnrichedField;
}

// ============= Retry Helper =============
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) throw lastError;
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError!;
}

// ============= AI Enrichment Call =============
async function enrichWithAI(accounts: AccountToEnrich[]): Promise<AIEnrichmentResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("AI enrichment not available - LOVABLE_API_KEY not configured");
  }

  const systemPrompt = `You are a B2B company data analyst. Given company information, estimate missing firmographic data.

Use these signals to estimate:
- Domain TLD (.ai, .io = tech; .gov = government; .edu = education)
- Domain patterns (cloud-, -labs, -tech = technology)
- Company name keywords (bank, financial = finance; health, med = healthcare)

Revenue ranges: $0-1M, $1M-10M, $10M-50M, $50M-100M, $100M-500M, $500M-1B, $1B+
Business models: B2B, B2C, B2B2C, Marketplace, SaaS, Services, Manufacturing, Retail

LINKEDIN URL ESTIMATION:
Generate the company's LinkedIn URL: https://www.linkedin.com/company/{company-slug}
- Remove suffixes: Inc, LLC, Corp, Ltd, Co
- Replace spaces with hyphens, lowercase

Be conservative with confidence scores:
- 90%+: Known major companies
- 70-89%: Strong indicators
- 50-69%: Moderate signals
- <50%: Use sparingly`;

  const accountsForPrompt = accounts.map(a => ({
    id: a.external_id,
    name: a.name,
    domain: a.domain,
    current_industry: a.industry_raw,
    current_employee_count: a.employee_count,
    current_revenue: a.revenue_range,
    country: a.country,
    current_linkedin: a.linkedin_url,
  }));

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze these ${accounts.length} companies and estimate missing data:\n\n${JSON.stringify(accountsForPrompt, null, 2)}` 
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "enrich_companies",
            description: "Return enrichment estimates for companies with confidence scores",
            parameters: {
              type: "object",
              properties: {
                enrichments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      external_id: { type: "string" },
                      employee_count: {
                        type: "object",
                        properties: {
                          value: { type: "number" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      revenue_range: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      industry_norm: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      business_model: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      country: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      linkedin_url: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      }
                    },
                    required: ["external_id"]
                  }
                }
              },
              required: ["enrichments"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "enrich_companies" } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI enrichment failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    return [];
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.enrichments || [];
  } catch {
    return [];
  }
}

// ============= Main Handler =============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { org_id, job_id, accounts } = await req.json();
    
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, attempted: 0, enriched: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-free-worker] Processing ${accounts.length} accounts for job ${job_id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let enriched = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Call AI with retry
      const aiResults = await retryWithBackoff(() => enrichWithAI(accounts));

      // Process each result
      for (const result of aiResults) {
        const account = accounts.find((a: AccountToEnrich) => a.external_id === result.external_id);
        if (!account) continue;

        try {
          const updates: Record<string, any> = {
            enriched_at: new Date().toISOString(),
            enriched_from: "ai_free",
          };

          const fieldScores: Record<string, number> = {};
          let fieldsEnriched = 0;

          // Apply employee_count if confident and missing
          if (result.employee_count && 
              result.employee_count.confidence >= CONFIDENCE_THRESHOLD &&
              !account.employee_count) {
            updates.employee_count = result.employee_count.value;
            fieldScores.employee_count = result.employee_count.confidence;
            fieldsEnriched++;
          }

          // Apply revenue_range if confident and missing
          if (result.revenue_range && 
              result.revenue_range.confidence >= CONFIDENCE_THRESHOLD &&
              !account.revenue_range) {
            updates.revenue_range = result.revenue_range.value;
            fieldScores.revenue_range = result.revenue_range.confidence;
            fieldsEnriched++;
          }

          // Apply industry_norm if confident and missing
          if (result.industry_norm && 
              result.industry_norm.confidence >= CONFIDENCE_THRESHOLD &&
              !account.industry_raw) {
            updates.industry_norm = result.industry_norm.value;
            updates.industry_raw = result.industry_norm.value;
            fieldScores.industry = result.industry_norm.confidence;
            fieldsEnriched++;
          }

          // Apply business_model if confident
          if (result.business_model && 
              result.business_model.confidence >= CONFIDENCE_THRESHOLD) {
            updates.business_model = result.business_model.value;
            fieldScores.business_model = result.business_model.confidence;
            fieldsEnriched++;
          }

          // Apply country if confident and missing
          if (result.country && 
              result.country.confidence >= CONFIDENCE_THRESHOLD &&
              !account.country) {
            updates.country = result.country.value;
            fieldScores.country = result.country.confidence;
            fieldsEnriched++;
          }

          // Apply linkedin_url if confident and missing
          if (result.linkedin_url && 
              result.linkedin_url.confidence >= CONFIDENCE_THRESHOLD &&
              !account.linkedin_url &&
              result.linkedin_url.value?.includes('linkedin.com/company/')) {
            updates.linkedin_url = result.linkedin_url.value;
            fieldScores.linkedin_url = result.linkedin_url.confidence;
            fieldsEnriched++;
          }

          // Calculate overall confidence
          const confidenceValues = Object.values(fieldScores);
          if (confidenceValues.length > 0) {
            updates.enrichment_confidence = Math.round(
              confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
            );
            updates.enrichment_field_scores = fieldScores;
            updates.enrichment_phase = "ai_free";
          }

          // Update account
          if (fieldsEnriched > 0) {
            const { error: updateError } = await supabase
              .from("accounts")
              .update(updates)
              .eq("external_id", result.external_id)
              .eq("org_id", org_id);

            if (updateError) {
              failed++;
              errors.push(`Update failed for ${result.external_id}: ${updateError.message}`);
            } else {
              enriched++;
            }
          }
        } catch (updateError) {
          failed++;
          errors.push(`Update failed: ${updateError instanceof Error ? updateError.message : 'Unknown'}`);
        }
      }
    } catch (aiError) {
      // AI call failed - mark all as failed
      failed = accounts.length;
      errors.push(`AI batch failed: ${aiError instanceof Error ? aiError.message : 'Unknown'}`);
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[enrich-free-worker] Completed: ${enriched} enriched, ${failed} failed in ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        processed: accounts.length,
        attempted: accounts.length,
        enriched,
        failed,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        latency_ms: latencyMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[enrich-free-worker] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

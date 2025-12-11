import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountToEnrich {
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
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
  company_type?: EnrichedField;
  business_model?: EnrichedField;
}

// Call Lovable AI with structured output via tool calling
async function enrichWithAI(accounts: AccountToEnrich[]): Promise<AIEnrichmentResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[enrich-ai-only] LOVABLE_API_KEY not configured");
    throw new Error("AI enrichment not available - API key not configured");
  }

  const systemPrompt = `You are a B2B company data analyst. Given company information, estimate missing firmographic data.

Use these signals to estimate:
- Domain TLD (.ai, .io = tech; .gov = government; .edu = education)
- Domain patterns (cloud-, -labs, -tech = technology)
- Company name keywords (bank, financial = finance; health, med = healthcare)
- Known domain patterns (salesforce.com = enterprise; stripe.com = fintech)

Revenue ranges: $0-1M, $1M-10M, $10M-50M, $50M-100M, $100M-500M, $500M-1B, $1B+
Company types: startup, scaleup, sme, mid-market, enterprise, government, non-profit
Business models: B2B, B2C, B2B2C, Marketplace, SaaS, Services, Manufacturing, Retail

Be conservative with confidence scores:
- 90%+: Known major companies or very clear signals
- 70-89%: Strong domain/name indicators
- 50-69%: Moderate signals, some uncertainty
- <50%: Mostly guessing, use sparingly

Only return estimates you're confident about (>50%).`;

  const accountsForPrompt = accounts.map(a => ({
    id: a.external_id,
    name: a.name,
    domain: a.domain,
    current_industry: a.industry_raw,
    current_employee_count: a.employee_count,
    current_revenue: a.revenue_range,
    country: a.country,
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
                      external_id: { type: "string", description: "The account external ID" },
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
                      company_type: {
                        type: "object",
                        properties: {
                          value: { type: "string", enum: ["startup", "scaleup", "sme", "mid-market", "enterprise", "government", "non-profit"] },
                          confidence: { type: "number", minimum: 0, maximum: 100 },
                          reasoning: { type: "string" }
                        }
                      },
                      business_model: {
                        type: "object",
                        properties: {
                          value: { type: "string", enum: ["B2B", "B2C", "B2B2C", "Marketplace", "SaaS", "Services", "Manufacturing", "Retail"] },
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
    console.error("[enrich-ai-only] AI API error:", response.status, errorText);
    throw new Error(`AI enrichment failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    console.error("[enrich-ai-only] No tool call in response");
    return [];
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.enrichments || [];
  } catch (e) {
    console.error("[enrich-ai-only] Failed to parse AI response:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { jobId, batchSize = 25, filters = {} } = await req.json();
    console.log(`[enrich-ai-only] Starting AI-only enrichment, jobId: ${jobId}, batchSize: ${batchSize}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("enrichment_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Update job status
    await supabase
      .from("enrichment_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId);

    // Build query for accounts needing enrichment
    let query = supabase
      .from("accounts")
      .select("external_id, name, domain, industry_raw, employee_count, revenue_range, country")
      .eq("org_id", job.org_id)
      .not("domain", "is", null);

    // Apply filters - focus on accounts missing data
    if (!filters.include_complete) {
      query = query.or("employee_count.is.null,revenue_range.is.null,industry_raw.is.null");
    }

    if (filters.min_score) {
      // Would need to join scores table
    }

    const { data: accounts, error: accountsError } = await query.limit(batchSize);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          processed_records: 0,
          enriched_records: 0,
          error_message: "No accounts need enrichment"
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({
        success: true,
        message: "No accounts need enrichment",
        processed: 0,
        enriched: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[enrich-ai-only] Found ${accounts.length} accounts to enrich`);

    // Process in smaller batches for AI
    const AI_BATCH_SIZE = 10;
    let totalEnriched = 0;
    let totalProcessed = 0;
    const enrichmentResults: any[] = [];

    for (let i = 0; i < accounts.length; i += AI_BATCH_SIZE) {
      const batch = accounts.slice(i, i + AI_BATCH_SIZE);
      console.log(`[enrich-ai-only] Processing batch ${Math.floor(i / AI_BATCH_SIZE) + 1}/${Math.ceil(accounts.length / AI_BATCH_SIZE)}`);

      try {
        const aiResults = await enrichWithAI(batch);
        
        // Apply enrichments with confidence threshold
        const CONFIDENCE_THRESHOLD = 60;

        for (const result of aiResults) {
          const account = batch.find(a => a.external_id === result.external_id);
          if (!account) continue;

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
              .eq("org_id", job.org_id);

            if (!updateError) {
              totalEnriched++;
              enrichmentResults.push({
                external_id: result.external_id,
                fields_enriched: fieldsEnriched,
                avg_confidence: updates.enrichment_confidence,
              });
            }
          }

          totalProcessed++;
        }

        // Update job progress
        await supabase
          .from("enrichment_jobs")
          .update({
            processed_records: totalProcessed,
            enriched_records: totalEnriched,
            progress_percentage: Math.round((totalProcessed / accounts.length) * 100),
            last_progress_update: new Date().toISOString(),
          })
          .eq("id", jobId);

      } catch (batchError) {
        console.error(`[enrich-ai-only] Batch error:`, batchError);
        // Continue with next batch
      }

      // Small delay between AI calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Complete job
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        processed_records: totalProcessed,
        enriched_records: totalEnriched,
        progress_percentage: 100,
      })
      .eq("id", jobId);

    // Log enrichment history
    await supabase.from("enrichment_history").insert({
      org_id: job.org_id,
      account_external_id: job.id,
      provider: "ai_free",
      enrichment_type: "firmographics",
      status: "completed",
      fields_enriched: enrichmentResults.map(r => r.external_id),
      cost_usd: 0,
      credits_used: 0,
      response_time_ms: Date.now() - startTime,
    });

    const avgConfidence = enrichmentResults.length > 0
      ? Math.round(enrichmentResults.reduce((a, b) => a + b.avg_confidence, 0) / enrichmentResults.length)
      : 0;

    console.log(`[enrich-ai-only] Completed: ${totalEnriched}/${totalProcessed} accounts enriched (avg confidence: ${avgConfidence}%)`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      enriched: totalEnriched,
      avg_confidence: avgConfidence,
      duration_ms: Date.now() - startTime,
      message: `AI enriched ${totalEnriched} of ${totalProcessed} accounts with ${avgConfidence}% average confidence`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[enrich-ai-only] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

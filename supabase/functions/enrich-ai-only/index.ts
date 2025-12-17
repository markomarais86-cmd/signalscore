import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { applyRateLimit } from "../_shared/rate-limit.ts";
import { updateHeartbeat, logRecoveryEvent } from "../_shared/job-heartbeat.ts";

// ============= Configuration =============
const AI_BATCH_SIZE = 10;          // Accounts per AI call
const CONCURRENT_LIMIT = 3;        // Parallel AI calls
const CONFIDENCE_THRESHOLD = 60;   // Minimum confidence to apply
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;
const RATE_LIMIT_DELAY = 500;      // Delay between concurrent batches
const MAX_BATCH_SIZE = 100;        // Max accounts per function invocation (prevents timeout)
const MAX_EXECUTION_MS = 45000;    // 45 second max execution time (leaves buffer before 60s timeout)

// ============= Types =============
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

interface ProcessingError {
  external_id: string;
  error: string;
  error_type: 'ai_failure' | 'update_failure' | 'validation_failure' | 'rate_limit';
  timestamp: string;
  retryable: boolean;
}

interface JobProgress {
  processed_account_ids: string[];
  failed_accounts: ProcessingError[];
  last_processed_at: string | null;
}

// ============= Retry Helper =============
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_RETRY_DELAY,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('rate limit'));
      
      if (attempt === maxRetries) {
        console.error(`[enrich-ai-only] ${operationName} failed after ${maxRetries + 1} attempts:`, lastError.message);
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = isRateLimit 
        ? baseDelay * Math.pow(3, attempt) // Longer delay for rate limits
        : baseDelay * Math.pow(2, attempt);
      const jitter = delay * 0.1 * (Math.random() * 2 - 1);
      const finalDelay = Math.floor(delay + jitter);
      
      console.log(`[enrich-ai-only] ${operationName} attempt ${attempt + 1} failed, retrying in ${finalDelay}ms...`);
      await new Promise(r => setTimeout(r, finalDelay));
    }
  }
  
  throw lastError!;
}

// ============= Chunk Helper =============
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============= AI Enrichment Call =============
async function enrichWithAI(accounts: AccountToEnrich[]): Promise<AIEnrichmentResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
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
    if (response.status === 429) {
      throw new Error(`Rate limit exceeded (429): ${errorText}`);
    }
    if (response.status === 402) {
      throw new Error(`Payment required (402): ${errorText}`);
    }
    throw new Error(`AI enrichment failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    console.warn("[enrich-ai-only] No tool call in response");
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

// ============= Process Single Batch with Retry =============
async function processBatchWithRetry(
  batch: AccountToEnrich[],
  supabase: any,
  orgId: string
): Promise<{
  enriched: number;
  processed: number;
  results: any[];
  errors: ProcessingError[];
}> {
  const errors: ProcessingError[] = [];
  const results: any[] = [];
  let enriched = 0;
  let processed = 0;

  try {
    // Call AI with retry
    const aiResults = await retryWithBackoff(
      () => enrichWithAI(batch),
      MAX_RETRIES,
      BASE_RETRY_DELAY,
      `AI enrichment for ${batch.length} accounts`
    );

    // Process each result
    for (const result of aiResults) {
      const account = batch.find(a => a.external_id === result.external_id);
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

        // Calculate overall confidence
        const confidenceValues = Object.values(fieldScores);
        if (confidenceValues.length > 0) {
          updates.enrichment_confidence = Math.round(
            confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
          );
          updates.enrichment_field_scores = fieldScores;
          updates.enrichment_phase = "ai_free";
        }

        // Update account with retry
        if (fieldsEnriched > 0) {
          await retryWithBackoff(
            async () => {
              const { error: updateError } = await supabase
                .from("accounts")
                .update(updates)
                .eq("external_id", result.external_id)
                .eq("org_id", orgId);
              if (updateError) throw updateError;
            },
            2,
            500,
            `Update account ${result.external_id}`
          );

          enriched++;
          results.push({
            external_id: result.external_id,
            fields_enriched: fieldsEnriched,
            avg_confidence: updates.enrichment_confidence,
          });
        }

        processed++;
      } catch (updateError) {
        errors.push({
          external_id: result.external_id,
          error: updateError instanceof Error ? updateError.message : 'Update failed',
          error_type: 'update_failure',
          timestamp: new Date().toISOString(),
          retryable: true,
        });
        processed++;
      }
    }

    // Mark accounts not in AI response as processed (no enrichment data available)
    for (const account of batch) {
      if (!aiResults.find(r => r.external_id === account.external_id)) {
        processed++;
      }
    }

  } catch (aiError) {
    // AI call failed completely for this batch
    const errorMessage = aiError instanceof Error ? aiError.message : 'AI call failed';
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate limit');
    
    for (const account of batch) {
      errors.push({
        external_id: account.external_id,
        error: errorMessage,
        error_type: isRateLimit ? 'rate_limit' : 'ai_failure',
        timestamp: new Date().toISOString(),
        retryable: isRateLimit,
      });
    }
  }

  return { enriched, processed, results, errors };
}

// ============= Main Handler =============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { jobId, batchSize = 100, filters = {}, resumeFromCheckpoint = true } = await req.json();
    // Enforce max batch size to prevent timeouts
    const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);
    console.log(`[enrich-ai-only] Starting AI enrichment, jobId: ${jobId}, batchSize: ${effectiveBatchSize} (requested: ${batchSize}), resume: ${resumeFromCheckpoint}`);

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

    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(supabase, job.org_id, 'enrich-ai-only');
    if (rateLimitResponse) {
      console.log(`[enrich-ai-only] Rate limited for org ${job.org_id}`);
      return rateLimitResponse;
    }

    // Get existing progress for resumability
    let existingProgress: JobProgress = {
      processed_account_ids: [],
      failed_accounts: [],
      last_processed_at: null,
    };

    if (resumeFromCheckpoint && job.status === 'paused') {
      // Parse existing progress from job metadata if available
      const metadata = job.agent_config as any;
      if (metadata?.progress) {
        existingProgress = metadata.progress;
        console.log(`[enrich-ai-only] Resuming from checkpoint: ${existingProgress.processed_account_ids.length} accounts already processed`);
      }
    }

    // Update job status with heartbeat
    await supabase
      .from("enrichment_jobs")
      .update({ 
        status: "processing", 
        started_at: job.started_at || new Date().toISOString(),
        paused_at: null,
        last_heartbeat: new Date().toISOString()
      })
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

    // NOTE: We do NOT filter out processed IDs in the query because it causes URL length overflow
    // when there are hundreds of processed IDs. Instead, we fetch more and filter in memory.
    const processedIdsSet = new Set(existingProgress.processed_account_ids);
    
    // Fetch more accounts than needed to account for filtering
    const fetchLimit = effectiveBatchSize + Math.min(processedIdsSet.size, 500);
    const { data: rawAccounts, error: accountsError } = await query.limit(fetchLimit);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    // Filter out already processed accounts in memory
    const accounts = (rawAccounts || [])
      .filter(a => !processedIdsSet.has(a.external_id))
      .slice(0, effectiveBatchSize);

    if (!accounts || accounts.length === 0) {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          processed_records: existingProgress.processed_account_ids.length,
          enriched_records: job.enriched_records || 0,
          error_message: existingProgress.processed_account_ids.length > 0 
            ? "Resumed - no additional accounts need enrichment"
            : "No accounts need enrichment"
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({
        success: true,
        message: "No accounts need enrichment",
        processed: existingProgress.processed_account_ids.length,
        enriched: job.enriched_records || 0,
        resumed: existingProgress.processed_account_ids.length > 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[enrich-ai-only] Found ${accounts.length} accounts to enrich`);

    // Split accounts into AI-sized batches
    const aiBatches = chunkArray(accounts, AI_BATCH_SIZE);
    
    let totalEnriched = job.enriched_records || 0;
    let totalProcessed = existingProgress.processed_account_ids.length;
    const allResults: any[] = [];
    const allErrors: ProcessingError[] = [...existingProgress.failed_accounts];
    const processedIds = new Set(existingProgress.processed_account_ids);

    // Process batches with controlled concurrency
    const concurrentChunks = chunkArray(aiBatches, CONCURRENT_LIMIT);
    
    let shouldPauseForTimeout = false;
    
    for (let chunkIndex = 0; chunkIndex < concurrentChunks.length; chunkIndex++) {
      // Check execution time before each chunk - auto-pause if approaching timeout
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > MAX_EXECUTION_MS) {
        console.log(`[enrich-ai-only] Approaching timeout (${elapsedMs}ms elapsed), pausing job for resumption`);
        shouldPauseForTimeout = true;
        break;
      }
      
      const concurrentBatches = concurrentChunks[chunkIndex];
      
      console.log(`[enrich-ai-only] Processing concurrent chunk ${chunkIndex + 1}/${concurrentChunks.length} (${concurrentBatches.length} parallel batches, ${elapsedMs}ms elapsed)`);

      // Process batches in parallel
      const batchPromises = concurrentBatches.map(batch => 
        processBatchWithRetry(batch, supabase, job.org_id)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const batch = concurrentBatches[i];
        
        if (result.status === 'fulfilled') {
          totalEnriched += result.value.enriched;
          totalProcessed += result.value.processed;
          allResults.push(...result.value.results);
          allErrors.push(...result.value.errors);
          
          // Track processed account IDs
          for (const account of batch) {
            processedIds.add(account.external_id);
          }
        } else {
          // Entire batch failed
          console.error(`[enrich-ai-only] Batch failed:`, result.reason);
          for (const account of batch) {
            allErrors.push({
              external_id: account.external_id,
              error: result.reason?.message || 'Batch processing failed',
              error_type: 'ai_failure',
              timestamp: new Date().toISOString(),
              retryable: true,
            });
            processedIds.add(account.external_id);
          }
          totalProcessed += batch.length;
        }
      }

      // Update job progress after each concurrent chunk (checkpoint for resumability)
      const progress: JobProgress = {
        processed_account_ids: Array.from(processedIds),
        failed_accounts: allErrors,
        last_processed_at: new Date().toISOString(),
      };

      // Update heartbeat and progress
      await updateHeartbeat(supabase, jobId, {
        processed: totalProcessed,
        total: accounts.length + existingProgress.processed_account_ids.length,
        current_step: `Processing batch ${chunkIndex + 1}/${concurrentChunks.length}`
      });

      await supabase
        .from("enrichment_jobs")
        .update({
          processed_records: totalProcessed,
          enriched_records: totalEnriched,
          failed_records: allErrors.length,
          progress_percentage: Math.round((totalProcessed / (accounts.length + existingProgress.processed_account_ids.length)) * 100),
          agent_config: { ...job.agent_config, progress },
        })
        .eq("id", jobId);

      // Rate limit delay between concurrent chunks
      if (chunkIndex < concurrentChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }
    
    // If pausing due to timeout, set job to paused state for auto-resume
    if (shouldPauseForTimeout) {
      const progress: JobProgress = {
        processed_account_ids: Array.from(processedIds),
        failed_accounts: allErrors,
        last_processed_at: new Date().toISOString(),
      };
      
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "paused",
          paused_at: new Date().toISOString(),
          can_pause: true,
          processed_records: totalProcessed,
          enriched_records: totalEnriched,
          failed_records: allErrors.length,
          last_progress_update: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          error_message: "Auto-paused before timeout - will auto-resume",
          agent_config: { ...job.agent_config, progress },
        })
        .eq("id", jobId);

      // Log timeout pause event
      await logRecoveryEvent(supabase, {
        jobId,
        orgId: job.org_id,
        recoveryType: 'timeout_pause',
        previousStatus: 'processing',
        newStatus: 'paused',
        reason: `Auto-paused before timeout. ${totalProcessed} processed, ${allErrors.length} failed.`
      });
      
      return new Response(JSON.stringify({
        success: true,
        status: "paused",
        message: "Job paused before timeout, will auto-resume",
        processed: totalProcessed,
        enriched: totalEnriched,
        duration_ms: Date.now() - startTime,
        needs_resume: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if more accounts remain to be processed
    const moreAccountsRemaining = totalProcessed < job.total_records;
    
    if (moreAccountsRemaining) {
      // Pause for auto-resume instead of completing
      const progress: JobProgress = {
        processed_account_ids: Array.from(processedIds),
        failed_accounts: allErrors,
        last_processed_at: new Date().toISOString(),
      };
      
      const progressPercentage = Math.round((totalProcessed / job.total_records) * 100);
      
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "paused",
          paused_at: new Date().toISOString(),
          can_pause: true,
          processed_records: totalProcessed,
          enriched_records: totalEnriched,
          failed_records: allErrors.length,
          progress_percentage: progressPercentage,
          last_progress_update: new Date().toISOString(),
          error_message: `Auto-paused after batch - ${job.total_records - totalProcessed} accounts remaining`,
          agent_config: { ...job.agent_config, progress },
        })
        .eq("id", jobId);
      
      console.log(`[enrich-ai-only] Paused for auto-resume: ${totalProcessed}/${job.total_records} processed, ${job.total_records - totalProcessed} remaining`);
      
      return new Response(JSON.stringify({
        success: true,
        status: "paused",
        message: `Batch complete, paused for auto-resume. ${job.total_records - totalProcessed} accounts remaining.`,
        processed: totalProcessed,
        enriched: totalEnriched,
        remaining: job.total_records - totalProcessed,
        duration_ms: Date.now() - startTime,
        needs_resume: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // All accounts processed - determine final status
    const retryableErrors = allErrors.filter(e => e.retryable);
    const finalStatus = retryableErrors.length > 0 && retryableErrors.length === allErrors.length
      ? "completed_with_errors"
      : allErrors.length > 0
        ? "completed_with_failures"
        : "completed";

    // Complete job
    await supabase
      .from("enrichment_jobs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processed_records: totalProcessed,
        enriched_records: totalEnriched,
        failed_records: allErrors.length,
        progress_percentage: 100,
        error_message: allErrors.length > 0 
          ? `${allErrors.length} accounts had errors (${retryableErrors.length} retryable)`
          : null,
        agent_config: {
          ...job.agent_config,
          progress: {
            processed_account_ids: Array.from(processedIds),
            failed_accounts: allErrors,
            last_processed_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", jobId);

    // Log enrichment history
    await supabase.from("enrichment_history").insert({
      org_id: job.org_id,
      account_external_id: job.id,
      provider: "ai_free",
      enrichment_type: "firmographics",
      status: finalStatus,
      fields_enriched: allResults.map(r => r.external_id),
      cost_usd: 0,
      credits_used: 0,
      response_time_ms: Date.now() - startTime,
      error_message: allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 10)) : null,
    });

    const avgConfidence = allResults.length > 0
      ? Math.round(allResults.reduce((a, b) => a + (b.avg_confidence || 0), 0) / allResults.length)
      : 0;

    console.log(`[enrich-ai-only] Completed: ${totalEnriched}/${totalProcessed} accounts enriched, ${allErrors.length} errors (avg confidence: ${avgConfidence}%)`);

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      processed: totalProcessed,
      enriched: totalEnriched,
      failed: allErrors.length,
      retryable_failures: retryableErrors.length,
      avg_confidence: avgConfidence,
      duration_ms: Date.now() - startTime,
      message: `AI enriched ${totalEnriched} of ${totalProcessed} accounts with ${avgConfidence}% average confidence`,
      errors_sample: allErrors.slice(0, 5), // Return sample of errors for debugging
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[enrich-ai-only] Error:", error);
    
    // Try to update job status to failed
    try {
      const { jobId } = await req.clone().json();
      if (jobId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase
          .from("enrichment_jobs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    } catch (e) {
      console.error("[enrich-ai-only] Failed to update job status:", e);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      retryable: true,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

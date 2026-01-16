import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * enrich-fast: Lightweight enrichment for small batches (<= 100 accounts)
 * 
 * This function enriches specific accounts directly without job queues,
 * designed for Quick Enrich and small batch operations.
 */

const MAX_ACCOUNTS = 100;

interface EnrichFastRequest {
  account_ids: string[];  // Account UUIDs (id column, not external_id)
  org_id: string;
}

interface EnrichmentResult {
  account_id: string;
  name: string;
  success: boolean;
  fields_enriched: number;
  source: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { account_ids, org_id }: EnrichFastRequest = await req.json();

    console.log(`[enrich-fast] Starting: ${account_ids.length} accounts for org ${org_id}`);

    // Validate input
    if (!account_ids || !Array.isArray(account_ids)) {
      return new Response(
        JSON.stringify({ error: "account_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (account_ids.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          stats: { processed: 0, enriched: 0, failed: 0, fields_enriched: 0 },
          results: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (account_ids.length > MAX_ACCOUNTS) {
      return new Response(
        JSON.stringify({ 
          error: `Too many accounts. Maximum is ${MAX_ACCOUNTS}. Use batch enrichment for larger datasets.`,
          max_allowed: MAX_ACCOUNTS,
          requested: account_ids.length
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch accounts
    const { data: accounts, error: fetchError } = await supabase
      .from("accounts")
      .select("id, external_id, name, domain, industry_raw, industry_norm, employee_count, revenue_range, country, state_province, city, linkedin_url, enriched_at")
      .in("id", account_ids)
      .eq("org_id", org_id);

    if (fetchError) {
      console.error("[enrich-fast] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          stats: { processed: 0, enriched: 0, failed: 0, fields_enriched: 0 },
          results: [],
          message: "No matching accounts found"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-fast] Found ${accounts.length} accounts to enrich`);

    // Process accounts using the worker function for consistency
    const results: EnrichmentResult[] = [];
    let totalFieldsEnriched = 0;
    let successCount = 0;
    let failCount = 0;

    // Process accounts using verified multi-source enrichment
    // Smaller chunks for verified enrichment (more API calls per account)
    const CHUNK_SIZE = 10;
    const chunks: any[][] = [];
    for (let i = 0; i < accounts.length; i += CHUNK_SIZE) {
      chunks.push(accounts.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      try {
        // Try verified enrichment first (uses Firecrawl + Perplexity)
        const { data: verifiedResult, error: verifiedError } = await supabase.functions.invoke(
          "enrich-verified",
          {
            body: {
              org_id,
              accounts: chunk
            }
          }
        );

        if (verifiedError) {
          console.log("[enrich-fast] Verified enrichment error, falling back to AI:", verifiedError.message);
          
          // Fallback to AI-only enrichment
          const { data: workerResult, error: workerError } = await supabase.functions.invoke(
            "enrich-free-worker",
            {
              body: {
                org_id,
                job_id: null,
                accounts: chunk
              }
            }
          );

          if (workerError) {
            console.error("[enrich-fast] Fallback worker also failed:", workerError);
            for (const account of chunk) {
              results.push({
                account_id: account.id,
                name: account.name || "Unknown",
                success: false,
                fields_enriched: 0,
                source: "error",
                error: workerError.message || "All enrichment methods failed"
              });
              failCount++;
            }
            continue;
          }

          // Process fallback results
          const fieldsEnriched = workerResult?.fields_enriched || 0;
          totalFieldsEnriched += fieldsEnriched;
          
          for (const account of chunk) {
            results.push({
              account_id: account.id,
              name: account.name || "Unknown",
              success: true,
              fields_enriched: Math.floor(fieldsEnriched / chunk.length),
              source: "ai_fallback",
              confidence: "low"
            });
            successCount++;
          }
          continue;
        }

        // Process verified results
        const verifiedStats = verifiedResult?.stats || {};
        totalFieldsEnriched += verifiedStats.fields_enriched || 0;
        
        // Use detailed per-account results from verified enrichment
        const accountResults = verifiedResult?.results || [];
        for (const result of accountResults) {
          if (result.success) {
            successCount++;
            results.push({
              account_id: result.account_id,
              name: result.name,
              success: true,
              fields_enriched: result.fields_enriched || 0,
              source: "verified",
              confidence: result.confidence || 0,
              sources_used: result.sources || [],
              needs_review: result.needs_review || false
            });
          } else {
            failCount++;
            results.push({
              account_id: result.account_id,
              name: result.name,
              success: false,
              fields_enriched: 0,
              source: "error",
              error: result.error
            });
          }
        }

        console.log(`[enrich-fast] Chunk complete: ${verifiedStats.accounts_enriched || 0} accounts, ${verifiedStats.fields_enriched || 0} fields via verified enrichment`);

      } catch (chunkError) {
        console.error("[enrich-fast] Chunk error:", chunkError);
        for (const account of chunk) {
          results.push({
            account_id: account.id,
            name: account.name || "Unknown",
            success: false,
            fields_enriched: 0,
            source: "error",
            error: chunkError instanceof Error ? chunkError.message : "Unknown error"
          });
          failCount++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[enrich-fast] Complete: ${successCount} enriched, ${failCount} failed, ${totalFieldsEnriched} fields in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          processed: accounts.length,
          enriched: successCount,
          failed: failCount,
          fields_enriched: totalFieldsEnriched,
          duration_ms: duration
        },
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-fast] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

    // Split into chunks and call worker
    const CHUNK_SIZE = 25;
    const chunks: any[][] = [];
    for (let i = 0; i < accounts.length; i += CHUNK_SIZE) {
      chunks.push(accounts.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      try {
        const { data: workerResult, error: workerError } = await supabase.functions.invoke(
          "enrich-free-worker",
          {
            body: {
              org_id,
              job_id: null, // No job tracking for fast enrichment
              accounts: chunk
            }
          }
        );

        if (workerError) {
          console.error("[enrich-fast] Worker error:", workerError);
          // Mark chunk as failed
          for (const account of chunk) {
            results.push({
              account_id: account.id,
              name: account.name || "Unknown",
              success: false,
              fields_enriched: 0,
              source: "error",
              error: workerError.message || "Worker failed"
            });
            failCount++;
          }
          continue;
        }

        // Process worker results
        const fieldsEnriched = workerResult?.fields_enriched || 0;
        const accountsEnriched = workerResult?.accounts_enriched || workerResult?.enriched || 0;
        
        totalFieldsEnriched += fieldsEnriched;
        
        // Add results for each account in chunk
        for (const account of chunk) {
          results.push({
            account_id: account.id,
            name: account.name || "Unknown",
            success: true,
            fields_enriched: Math.floor(fieldsEnriched / chunk.length), // Approximate per-account
            source: "launch_pulse"
          });
          successCount++;
        }

        console.log(`[enrich-fast] Chunk complete: ${accountsEnriched} accounts, ${fieldsEnriched} fields`);

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

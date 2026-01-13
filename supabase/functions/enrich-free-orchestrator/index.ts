import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// ============= Configuration =============
const MAX_EXECUTION_MS = 44000;   // Stop before edge timeout (60s)
const BATCH_SIZE = 250;           // Accounts fetched per round
const WORKER_CHUNK = 25;          // Accounts per worker
const CONCURRENT_WORKERS = 5;     // Parallel worker calls

function nowMs() { return Date.now(); }

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = nowMs();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id, org_id, create_new = false, total_records = 0 } = await req.json();
    console.log(`[enrich-free-orchestrator] Starting job=${job_id}, org=${org_id}, create_new=${create_new}`);

    // 1) Create or load job
    let job: any;
    
    if (create_new) {
      // Create a new job
      const { data: newJob, error: createError } = await supabase
        .from("enrichment_jobs")
        .insert({
          org_id,
          provider: "ai_free",
          status: "processing",
          total_records,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0,
          started_at: new Date().toISOString(),
          source_breakdown: { ai: { attempted: 0, enriched: 0, failed: 0 } },
        })
        .select()
        .single();

      if (createError || !newJob) {
        throw new Error(`Failed to create job: ${createError?.message || "Unknown error"}`);
      }
      job = newJob;
      console.log(`[enrich-free-orchestrator] Created new job: ${job.id}`);
    } else {
      // Load existing job
      const { data: existingJob, error: jobErr } = await supabase
        .from("enrichment_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (jobErr || !existingJob) {
        return new Response(
          JSON.stringify({ error: jobErr?.message || "Job not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      job = existingJob;
    }

    const jobId = job.id;
    const jobOrgId = job.org_id;

    // 2) Mark as running
    await supabase.from("enrichment_jobs")
      .update({ status: "processing", error_message: null })
      .eq("id", jobId);

    // Aggregate metrics across all iterations
    let totalProcessed = job.processed_records || 0;
    let totalEnriched = job.enriched_records || 0;
    let totalFailed = job.failed_records || 0;
    let lastCursor = job.cursor;
    let iterationsCompleted = 0;

    // Main processing loop - continues until timeout or done
    while (nowMs() - start < MAX_EXECUTION_MS) {
      // 3) Fetch next batch of accounts (cursor-based pagination)
      let query = supabase
        .from("accounts")
        .select("id, external_id, name, domain, industry_raw, employee_count, revenue_range, country, linkedin_url")
        .eq("org_id", jobOrgId)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastCursor) {
        query = query.gt("id", lastCursor);
      }

      const { data: accounts, error: accErr } = await query;
      
      if (accErr) {
        await supabase.from("enrichment_jobs")
          .update({ status: "failed", error_message: accErr.message })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ error: accErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No more accounts - job complete
      if (!accounts || accounts.length === 0) {
        await supabase.from("enrichment_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processed_records: totalProcessed,
            enriched_records: totalEnriched,
            failed_records: totalFailed,
          })
          .eq("id", jobId);

        console.log(`[enrich-free-orchestrator] Job ${jobId} completed: ${totalEnriched}/${totalProcessed} enriched`);
        return new Response(
          JSON.stringify({ status: "completed", processed: totalProcessed, enriched: totalEnriched }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4) Split into worker chunks
      const chunks: any[][] = [];
      for (let i = 0; i < accounts.length; i += WORKER_CHUNK) {
        chunks.push(accounts.slice(i, i + WORKER_CHUNK));
      }

      // 5) Process chunks with concurrent workers
      let batchProcessed = 0;
      let batchEnriched = 0;
      let batchFailed = 0;
      const workerErrors: string[] = [];

      for (let i = 0; i < chunks.length; i += CONCURRENT_WORKERS) {
        // Check timeout before each worker group
        if (nowMs() - start > MAX_EXECUTION_MS) break;

        const group = chunks.slice(i, i + CONCURRENT_WORKERS);

        const results = await Promise.allSettled(
          group.map((chunk) =>
            supabase.functions.invoke("enrich-free-worker", {
              body: { org_id: jobOrgId, job_id: jobId, accounts: chunk },
            })
          )
        );

        for (const r of results) {
          if (r.status === "fulfilled" && !r.value.error && r.value.data) {
            batchProcessed += r.value.data.processed || 0;
            batchEnriched += r.value.data.enriched || 0;
            batchFailed += r.value.data.failed || 0;
            if (r.value.data.errors) {
              workerErrors.push(...r.value.data.errors);
            }
          } else if (r.status === "rejected") {
            workerErrors.push(r.reason?.message || "Worker failed");
          } else if (r.value?.error) {
            workerErrors.push(r.value.error);
          }
        }
      }

      // 6) Update cursor and progress
      lastCursor = accounts[accounts.length - 1].id;
      totalProcessed += batchProcessed;
      totalEnriched += batchEnriched;
      totalFailed += batchFailed;
      iterationsCompleted++;

      // Calculate ETR
      const elapsedMs = nowMs() - start + (job.started_at ? Date.now() - new Date(job.started_at).getTime() : 0);
      const ratePerMs = totalProcessed > 0 ? totalProcessed / elapsedMs : 0.001;
      const remaining = (job.total_records || totalProcessed) - totalProcessed;
      const etrMs = remaining / ratePerMs;
      const estimatedCompletion = new Date(Date.now() + etrMs).toISOString();

      // Update source breakdown
      const sourceBreakdown = {
        ai: {
          attempted: totalProcessed,
          enriched: totalEnriched,
          failed: totalFailed,
        },
      };

      // Checkpoint update
      await supabase.from("enrichment_jobs")
        .update({
          cursor: lastCursor,
          processed_records: totalProcessed,
          enriched_records: totalEnriched,
          failed_records: totalFailed,
          source_breakdown: sourceBreakdown,
          estimated_completion_at: estimatedCompletion,
          updated_at: new Date().toISOString(),
          error_message: workerErrors.length > 0 ? workerErrors.slice(0, 3).join("; ") : null,
        })
        .eq("id", jobId);

      console.log(`[enrich-free-orchestrator] Iteration ${iterationsCompleted}: processed=${batchProcessed}, enriched=${batchEnriched}, cursor=${lastCursor}`);
    }

    // 7) Timeout reached - pause for resumption
    const timeUp = nowMs() - start >= MAX_EXECUTION_MS;
    
    if (timeUp && totalProcessed < (job.total_records || totalProcessed + 1)) {
      await supabase.from("enrichment_jobs")
        .update({
          status: "paused",
          paused_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`[enrich-free-orchestrator] Job ${jobId} paused at cursor ${lastCursor}, processed ${totalProcessed}`);
    }

    return new Response(
      JSON.stringify({
        status: timeUp ? "paused" : "processing",
        job_id: jobId,
        processed: totalProcessed,
        enriched: totalEnriched,
        failed: totalFailed,
        cursor: lastCursor,
        iterations: iterationsCompleted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[enrich-free-orchestrator] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

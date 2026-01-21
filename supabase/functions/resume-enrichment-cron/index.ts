import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

// This function is designed to be called by a cron job or manually
// to resume paused enrichment jobs
serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log("[resume-enrichment-cron] Checking for paused jobs...");

    // Find all paused AI free enrichment jobs
    const { data: pausedJobs, error: queryError } = await supabase
      .from("enrichment_jobs")
      .select("id, org_id, provider, paused_at, cursor, processed_records, total_records")
      .eq("status", "paused")
      .eq("provider", "ai_free")
      .order("paused_at", { ascending: true })
      .limit(3); // Only resume up to 3 jobs at once to avoid overwhelming the system

    if (queryError) {
      console.error("[resume-enrichment-cron] Query error:", queryError);
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pausedJobs || pausedJobs.length === 0) {
      console.log("[resume-enrichment-cron] No paused jobs found");
      return new Response(
        JSON.stringify({ status: "ok", message: "No paused jobs", resumed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[resume-enrichment-cron] Found ${pausedJobs.length} paused jobs to resume`);

    const resumeResults: any[] = [];

    // Resume each job sequentially (one at a time to avoid overwhelming)
    for (const job of pausedJobs) {
      try {
        console.log(`[resume-enrichment-cron] Resuming job ${job.id} for org ${job.org_id}`);
        
        // Check if job was paused more than 30 seconds ago (avoid resuming too quickly)
        const pausedAt = new Date(job.paused_at).getTime();
        const minWait = 30000; // 30 seconds
        if (Date.now() - pausedAt < minWait) {
          console.log(`[resume-enrichment-cron] Job ${job.id} was paused recently, skipping`);
          resumeResults.push({ job_id: job.id, status: "skipped", reason: "too_recent" });
          continue;
        }

        // Invoke the orchestrator to resume
        const { data, error } = await supabase.functions.invoke("enrich-free-orchestrator", {
          body: { job_id: job.id, org_id: job.org_id },
        });

        if (error) {
          console.error(`[resume-enrichment-cron] Failed to resume job ${job.id}:`, error);
          resumeResults.push({ job_id: job.id, status: "error", error: error.message });
        } else {
          console.log(`[resume-enrichment-cron] Resumed job ${job.id}:`, data);
          resumeResults.push({ job_id: job.id, status: "resumed", data });
        }

        // Wait 2 seconds between job resumes to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (resumeError) {
        console.error(`[resume-enrichment-cron] Error resuming job ${job.id}:`, resumeError);
        resumeResults.push({ 
          job_id: job.id, 
          status: "error", 
          error: resumeError instanceof Error ? resumeError.message : "Unknown error" 
        });
      }
    }

    const resumed = resumeResults.filter(r => r.status === "resumed").length;
    console.log(`[resume-enrichment-cron] Completed: ${resumed}/${pausedJobs.length} jobs resumed`);

    return new Response(
      JSON.stringify({
        status: "ok",
        total_paused: pausedJobs.length,
        resumed,
        results: resumeResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[resume-enrichment-cron] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

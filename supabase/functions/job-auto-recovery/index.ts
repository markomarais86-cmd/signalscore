import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  detectStaleJobs,
  detectAutoResumeJobs,
  markJobAsStuck,
  prepareJobForResume,
  logRecoveryEvent,
  MAX_RECOVERY_ATTEMPTS,
  STALE_JOB_THRESHOLD_MS,
  AUTO_RESUME_THRESHOLD_MS,
} from "../_shared/job-heartbeat.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[AutoRecovery] Starting job auto-recovery scan');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      stale_jobs_found: 0,
      stale_jobs_paused: 0,
      stale_jobs_failed: 0,
      resume_candidates_found: 0,
      jobs_resumed: 0,
      jobs_failed_max_retries: 0,
      errors: [] as string[],
    };

    // Step 1: Find and handle stale "processing" jobs (no heartbeat for 2+ minutes)
    console.log('[AutoRecovery] Checking for stale processing jobs...');
    const staleJobs = await detectStaleJobs(supabase, undefined, STALE_JOB_THRESHOLD_MS);
    results.stale_jobs_found = staleJobs.length;

    for (const job of staleJobs) {
      try {
        const reason = job.last_heartbeat 
          ? `Job stalled - no heartbeat since ${job.last_heartbeat}. Will auto-resume.`
          : `Job stalled - no heartbeat recorded. Will auto-resume.`;
        
        const success = await markJobAsStuck(supabase, job, reason);
        
        if (success) {
          const newRecoveryCount = (job.recovery_count || 0) + 1;
          if (newRecoveryCount >= MAX_RECOVERY_ATTEMPTS) {
            results.stale_jobs_failed++;
            console.log(`[AutoRecovery] Job ${job.id} marked as failed after ${MAX_RECOVERY_ATTEMPTS} recovery attempts`);
          } else {
            results.stale_jobs_paused++;
            console.log(`[AutoRecovery] Job ${job.id} marked as paused (recovery ${newRecoveryCount}/${MAX_RECOVERY_ATTEMPTS})`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to handle stale job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[AutoRecovery] ${errorMsg}`);
      }
    }

    // Step 2: Find paused jobs that are candidates for auto-resume
    console.log('[AutoRecovery] Checking for auto-resume candidates...');
    const resumeCandidates = await detectAutoResumeJobs(supabase, undefined, AUTO_RESUME_THRESHOLD_MS);
    results.resume_candidates_found = resumeCandidates.length;

    for (const job of resumeCandidates) {
      try {
        // Check if job hasn't exceeded max recovery attempts
        if ((job.recovery_count || 0) >= MAX_RECOVERY_ATTEMPTS) {
          // Mark as failed
          await supabase
            .from('enrichment_jobs')
            .update({
              status: 'failed',
              error_message: `Job failed after ${MAX_RECOVERY_ATTEMPTS} recovery attempts`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          
          await logRecoveryEvent(supabase, {
            jobId: job.id,
            orgId: job.org_id,
            recoveryType: 'stuck_cleanup',
            previousStatus: job.status,
            newStatus: 'failed',
            reason: `Exceeded max recovery attempts (${MAX_RECOVERY_ATTEMPTS})`,
          });
          
          results.jobs_failed_max_retries++;
          console.log(`[AutoRecovery] Job ${job.id} marked as failed - exceeded max retries`);
          continue;
        }

        // Prepare job for resume
        const prepared = await prepareJobForResume(supabase, job);
        if (!prepared) {
          results.errors.push(`Failed to prepare job ${job.id} for resume`);
          continue;
        }

        // Call resume-enrichment-job function
        console.log(`[AutoRecovery] Resuming job ${job.id}...`);
        
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/resume-enrichment-job`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ job_id: job.id }),
          }
        );

        if (response.ok) {
          // Increment recovery count
          await supabase
            .from('enrichment_jobs')
            .update({ 
              recovery_count: (job.recovery_count || 0) + 1,
            })
            .eq('id', job.id);
          
          results.jobs_resumed++;
          console.log(`[AutoRecovery] Successfully resumed job ${job.id}`);
        } else {
          const errorText = await response.text();
          results.errors.push(`Failed to resume job ${job.id}: ${errorText}`);
          console.error(`[AutoRecovery] Failed to resume job ${job.id}: ${errorText}`);
        }
      } catch (error) {
        const errorMsg = `Failed to auto-resume job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[AutoRecovery] ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[AutoRecovery] Completed in ${duration}ms:`, results);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AutoRecovery] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Job Heartbeat and Recovery Helper
// Provides heartbeat tracking and stale job detection for long-running enrichment jobs

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Default heartbeat interval (30 seconds)
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;

// Stale threshold - jobs without heartbeat for this long are considered stuck
export const STALE_JOB_THRESHOLD_MS = 120000; // 2 minutes

// Auto-resume threshold - paused jobs older than this can be auto-resumed
export const AUTO_RESUME_THRESHOLD_MS = 300000; // 5 minutes

// Max recovery attempts before marking job as failed
export const MAX_RECOVERY_ATTEMPTS = 3;

export interface StaleJob {
  id: string;
  org_id: string;
  status: string;
  last_heartbeat: string | null;
  recovery_count: number;
  paused_at: string | null;
  error_message: string | null;
}

export interface HeartbeatProgress {
  processed?: number;
  total?: number;
  completed?: number;
  failed?: number;
  current_step?: string;
}

/**
 * Update job heartbeat to indicate the job is still running
 */
export async function updateHeartbeat(
  supabase: SupabaseClient,
  jobId: string,
  progress?: HeartbeatProgress
): Promise<void> {
  const updates: Record<string, any> = {
    last_heartbeat: new Date().toISOString(),
    last_progress_update: new Date().toISOString(),
  };

  if (progress) {
    if (progress.processed !== undefined) updates.processed_records = progress.processed;
    if (progress.completed !== undefined) updates.rows_completed = progress.completed;
    if (progress.failed !== undefined) updates.rows_failed = progress.failed;
    if (progress.total !== undefined) updates.total_records = progress.total;
  }

  const { error } = await supabase
    .from('enrichment_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.warn(`[Heartbeat] Failed to update heartbeat for job ${jobId}:`, error.message);
  }
}

/**
 * Create a heartbeat interval that updates periodically during processing
 */
export function createHeartbeatInterval(
  supabase: SupabaseClient,
  jobId: string,
  intervalMs: number = DEFAULT_HEARTBEAT_INTERVAL_MS,
  getProgress?: () => HeartbeatProgress
): { stop: () => void } {
  const interval = setInterval(async () => {
    const progress = getProgress ? getProgress() : undefined;
    await updateHeartbeat(supabase, jobId, progress);
  }, intervalMs);

  return {
    stop: () => clearInterval(interval),
  };
}

/**
 * Detect jobs that appear to be stuck (no heartbeat update for too long)
 */
export async function detectStaleJobs(
  supabase: SupabaseClient,
  orgId?: string,
  staleThresholdMs: number = STALE_JOB_THRESHOLD_MS
): Promise<StaleJob[]> {
  const staleThreshold = new Date(Date.now() - staleThresholdMs).toISOString();
  
  let query = supabase
    .from('enrichment_jobs')
    .select('id, org_id, status, last_heartbeat, recovery_count, paused_at, error_message')
    .eq('status', 'processing')
    .or(`last_heartbeat.is.null,last_heartbeat.lt.${staleThreshold}`);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Heartbeat] Failed to detect stale jobs:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Detect paused jobs that are candidates for auto-resume
 */
export async function detectAutoResumeJobs(
  supabase: SupabaseClient,
  orgId?: string,
  resumeThresholdMs: number = AUTO_RESUME_THRESHOLD_MS
): Promise<StaleJob[]> {
  const resumeThreshold = new Date(Date.now() - resumeThresholdMs).toISOString();
  
  let query = supabase
    .from('enrichment_jobs')
    .select('id, org_id, status, last_heartbeat, recovery_count, paused_at, error_message')
    .eq('status', 'paused')
    .lt('paused_at', resumeThreshold)
    .lt('recovery_count', MAX_RECOVERY_ATTEMPTS);

  // Only auto-resume jobs that were paused due to timeout (have auto-resume message)
  query = query.or('error_message.ilike.%auto-resume%,error_message.ilike.%timeout%,error_message.is.null');

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Heartbeat] Failed to detect auto-resume jobs:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Log a recovery event for audit purposes
 */
export async function logRecoveryEvent(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    orgId: string;
    recoveryType: 'auto_resume' | 'manual_resume' | 'stuck_cleanup' | 'timeout_pause';
    previousStatus: string;
    newStatus: string;
    rowsRecovered?: number;
    reason?: string;
    recoveredBy?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('job_recovery_log')
    .insert({
      job_id: params.jobId,
      org_id: params.orgId,
      recovery_type: params.recoveryType,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      rows_recovered: params.rowsRecovered || 0,
      reason: params.reason,
      recovered_by: params.recoveredBy,
    });

  if (error) {
    console.error('[Heartbeat] Failed to log recovery event:', error.message);
  }
}

/**
 * Mark a stuck job as paused and increment recovery count
 */
export async function markJobAsStuck(
  supabase: SupabaseClient,
  job: StaleJob,
  reason: string
): Promise<boolean> {
  const newRecoveryCount = (job.recovery_count || 0) + 1;
  const newStatus = newRecoveryCount >= MAX_RECOVERY_ATTEMPTS ? 'failed' : 'paused';
  
  const { error } = await supabase
    .from('enrichment_jobs')
    .update({
      status: newStatus,
      paused_at: new Date().toISOString(),
      recovery_count: newRecoveryCount,
      error_message: reason,
    })
    .eq('id', job.id)
    .eq('status', 'processing'); // Only update if still processing

  if (error) {
    console.error(`[Heartbeat] Failed to mark job ${job.id} as stuck:`, error.message);
    return false;
  }

  // Log the recovery event
  await logRecoveryEvent(supabase, {
    jobId: job.id,
    orgId: job.org_id,
    recoveryType: 'stuck_cleanup',
    previousStatus: job.status,
    newStatus,
    reason,
  });

  return true;
}

/**
 * Prepare a paused job for auto-resume
 */
export async function prepareJobForResume(
  supabase: SupabaseClient,
  job: StaleJob
): Promise<boolean> {
  // Reset any stuck "processing" rows back to pending
  const { data: resetRows, error: resetError } = await supabase
    .from('enrichment_rows')
    .update({ status: 'pending', current_agent: null })
    .eq('job_id', job.id)
    .eq('status', 'processing')
    .select('id');

  if (resetError) {
    console.error(`[Heartbeat] Failed to reset rows for job ${job.id}:`, resetError.message);
    return false;
  }

  const rowsRecovered = resetRows?.length || 0;

  // Log the recovery event
  await logRecoveryEvent(supabase, {
    jobId: job.id,
    orgId: job.org_id,
    recoveryType: 'auto_resume',
    previousStatus: job.status,
    newStatus: 'processing',
    rowsRecovered,
    reason: 'Auto-resumed after timeout',
  });

  return true;
}

-- First drop the existing constraint
ALTER TABLE enrichment_jobs DROP CONSTRAINT IF EXISTS enrichment_jobs_status_check;

-- Add a new constraint that allows 'paused' and other states
ALTER TABLE enrichment_jobs ADD CONSTRAINT enrichment_jobs_status_check 
CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'failed', 'paused', 'cancelled', 'completed_with_errors', 'completed_with_failures']));

-- Now fix the stuck jobs by marking them as paused
UPDATE enrichment_jobs 
SET 
  status = 'paused', 
  paused_at = NOW(),
  can_pause = true,
  error_message = 'Auto-paused: job stalled (likely edge function timeout)'
WHERE status = 'processing' 
  AND last_progress_update < NOW() - INTERVAL '5 minutes';
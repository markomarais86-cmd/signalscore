-- Reset stuck sync jobs to 'failed' status so new ones can start with fixed functions
UPDATE sync_jobs 
SET status = 'failed', 
    updated_at = NOW()
WHERE status = 'processing';
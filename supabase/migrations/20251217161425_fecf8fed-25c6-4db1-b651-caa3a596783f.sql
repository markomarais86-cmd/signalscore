-- Clean up old stuck/paused jobs
UPDATE enrichment_jobs 
SET status = 'cancelled', 
    error_message = 'Auto-cancelled - stale job',
    completed_at = NOW()
WHERE status IN ('paused', 'processing') 
AND (last_progress_update < NOW() - INTERVAL '1 hour' OR last_progress_update IS NULL);

-- Create a fresh enrichment job for HQ address enrichment
INSERT INTO enrichment_jobs (
  org_id,
  job_type,
  provider,
  status,
  total_records,
  processed_records,
  enriched_records,
  failed_records,
  created_at,
  started_at
)
SELECT 
  '726a0dc0-99c7-43c2-b20f-b849f2760c3f',
  'accounts',
  'ai_free',
  'pending',
  COUNT(*),
  0,
  0,
  0,
  NOW(),
  NOW()
FROM accounts 
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
AND (hq_city IS NULL OR employee_count IS NULL OR revenue_range IS NULL);
-- Clean up zombie scoring jobs that have been stuck for over 1 hour
UPDATE bulk_scoring_jobs
SET 
  status = 'failed',
  error_message = 'Job stuck for >1 hour - cleaned up automatically',
  completed_at = NOW(),
  updated_at = NOW()
WHERE status = 'processing'
  AND (last_processed_at < NOW() - INTERVAL '1 hour' OR last_processed_at IS NULL OR started_at < NOW() - INTERVAL '1 hour');
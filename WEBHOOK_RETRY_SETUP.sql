-- ============================================
-- Webhook Retry Cron Job Setup
-- ============================================
-- IMPORTANT: Run this SQL in the Supabase SQL Editor
-- This will set up automatic retrying of failed webhooks

-- Step 1: Ensure extensions are enabled (if not already done)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Schedule the webhook retry job
-- This runs every 2 minutes to retry failed webhooks
SELECT cron.schedule(
  'webhook-retry-job',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/retry-failed-webhooks',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
      body := jsonb_build_object('timestamp', now()::text)
    ) as request_id;
  $$
);

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'webhook-retry-job';

-- Step 4: (Optional) Manually trigger the retry to test
-- Uncomment the line below to test immediately:
-- SELECT net.http_post(
--   url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/retry-failed-webhooks',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
--   body := '{"timestamp": "test"}'::jsonb
-- );

-- ============================================
-- How the retry mechanism works:
-- ============================================
-- 1. When a webhook fails to process, it's marked with:
--    - processed = false
--    - next_retry_at = current_time + exponential_backoff_delay
--    - retry_count incremented
--
-- 2. The retry job runs every 2 minutes and:
--    - Finds all webhooks where next_retry_at <= now()
--    - Attempts to reprocess them
--    - Uses exponential backoff: 2min, 4min, 8min
--
-- 3. After max_retries (default: 3):
--    - Webhook is marked as permanently_failed = true
--    - No more retry attempts
--    - Requires manual intervention
--
-- ============================================

-- View retry statistics
-- SELECT 
--   COUNT(*) FILTER (WHERE processed = true) as successful,
--   COUNT(*) FILTER (WHERE processed = false AND permanently_failed = false) as pending_retry,
--   COUNT(*) FILTER (WHERE permanently_failed = true) as permanently_failed
-- FROM webhook_logs;

-- View webhooks pending retry
-- SELECT 
--   id,
--   webhook_type,
--   object_type,
--   action,
--   retry_count,
--   max_retries,
--   next_retry_at,
--   failure_reason,
--   created_at
-- FROM webhook_logs
-- WHERE processed = false 
--   AND permanently_failed = false
-- ORDER BY next_retry_at;

-- View permanently failed webhooks
-- SELECT 
--   id,
--   webhook_type,
--   object_type,
--   action,
--   retry_count,
--   failure_reason,
--   created_at
-- FROM webhook_logs
-- WHERE permanently_failed = true
-- ORDER BY created_at DESC;

-- Manually retry a specific webhook
-- UPDATE webhook_logs 
-- SET 
--   next_retry_at = now(),
--   permanently_failed = false,
--   retry_count = 0
-- WHERE id = 'your-webhook-id-here';

-- View cron job run history
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'webhook-retry-job')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- To delete the cron job (if needed):
-- SELECT cron.unschedule('webhook-retry-job');

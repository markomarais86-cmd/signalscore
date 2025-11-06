-- ============================================
-- CRM Auto-Sync Cron Job Setup
-- ============================================
-- IMPORTANT: Run this SQL in the Supabase SQL Editor
-- This will set up automatic syncing for Salesforce and HubSpot integrations

-- Step 1: Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Schedule the hourly CRM sync job
-- This runs every hour and syncs integrations based on their configured frequency
SELECT cron.schedule(
  'crm-auto-sync-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-crm-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
      body := jsonb_build_object('timestamp', now()::text)
    ) as request_id;
  $$
);

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'crm-auto-sync-hourly';

-- Step 4: (Optional) Manually trigger the sync to test
-- Uncomment the line below to test immediately:
-- SELECT net.http_post(
--   url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-crm-sync',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
--   body := '{"timestamp": "test"}'::jsonb
-- );

-- ============================================
-- How the sync frequency works:
-- ============================================
-- - hourly: Syncs every hour when the cron job runs
-- - daily: Syncs only at 2 AM (configured in the edge function)
-- - weekly: Syncs only on Monday at 2 AM (configured in the edge function)
-- - manual: Never syncs automatically, only when user clicks "Sync" button
--
-- The sync frequency is stored in integration_configs.config.sync_frequency
-- ============================================

-- View cron job run history (last 10 runs)
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'crm-auto-sync-hourly')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- To delete the cron job (if needed):
-- SELECT cron.unschedule('crm-auto-sync-hourly');

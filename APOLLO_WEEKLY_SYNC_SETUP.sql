-- =====================================================
-- Apollo Weekly Auto-Sync Setup
-- =====================================================
-- This script sets up a weekly cron job to automatically sync
-- Apollo TAM data every Monday at 9:00 AM UTC
-- 
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/sql/new
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- =====================================================

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create the weekly Apollo sync job
-- Runs every Monday at 9:00 AM UTC (cron format: minute hour day month weekday)
SELECT cron.schedule(
  'apollo-weekly-tam-sync',
  '0 9 * * 1', -- Every Monday at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/sync-external-provider',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
        body:=jsonb_build_object(
          'org_id', (SELECT org_id FROM external_data_sources WHERE provider = 'apollo' LIMIT 1),
          'provider', 'apollo'
        )
    ) as request_id;
  $$
);

-- Verify the cron job was created successfully
SELECT * FROM cron.job WHERE jobname = 'apollo-weekly-tam-sync';

-- =====================================================
-- OPTIONAL: Test the sync immediately (uncomment to run)
-- =====================================================
-- SELECT
--   net.http_post(
--       url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/sync-external-provider',
--       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
--       body:=jsonb_build_object(
--         'org_id', (SELECT org_id FROM external_data_sources WHERE provider = 'apollo' LIMIT 1),
--         'provider', 'apollo'
--       )
--   ) as request_id;

-- =====================================================
-- USEFUL COMMANDS:
-- =====================================================

-- View all scheduled cron jobs:
-- SELECT * FROM cron.job;

-- View cron job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Unschedule the job (if needed):
-- SELECT cron.unschedule('apollo-weekly-tam-sync');

-- Manually trigger the sync (alternative method):
-- SELECT
--   net.http_post(
--       url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/sync-external-provider',
--       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
--       body:='{"org_id": "YOUR_ORG_ID", "provider": "apollo"}'::jsonb
--   ) as request_id;

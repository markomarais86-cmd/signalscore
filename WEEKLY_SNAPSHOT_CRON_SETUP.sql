-- Weekly Analytics Snapshot Cron Job Setup
-- This creates a scheduled job that runs every Monday at 6:00 AM UTC
-- to capture weekly snapshots of key analytics metrics

SELECT cron.schedule(
  'weekly-analytics-snapshot',
  '0 6 * * 1', -- Every Monday at 6:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/weekly-analytics-snapshot',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'weekly-analytics-snapshot';

-- To manually trigger the snapshot (for testing):
-- SELECT net.http_post(
--     url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/weekly-analytics-snapshot',
--     headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
--     body:='{"triggered_at": "manual"}'::jsonb
-- ) as request_id;

-- To unschedule the job:
-- SELECT cron.unschedule('weekly-analytics-snapshot');

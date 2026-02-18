-- Enrich Bed Counts Cron Job
-- Runs every 2 minutes, processes up to 200 accounts per run
-- Will harmlessly no-op once all accounts have bed_count data

SELECT cron.schedule(
  'enrich-bed-counts-loop',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-bed-counts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := '{"org_id": "726a0dc0-99c7-43c2-b20f-b849f2760c3f", "batch_size": 200, "triggered_by": "scheduled"}'::jsonb
  ) AS request_id;
  $$
);

-- Verify it was created
SELECT * FROM cron.job WHERE jobname = 'enrich-bed-counts-loop';

-- To remove when done:
-- SELECT cron.unschedule('enrich-bed-counts-loop');


-- Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Set up the scheduled agent runner cron job to run every hour
SELECT cron.schedule(
  'scheduled-agent-runner-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-agent-runner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
      body := jsonb_build_object('timestamp', now()::text)
    ) as request_id;
  $$
);

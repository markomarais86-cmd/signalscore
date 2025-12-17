-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule job-auto-recovery to run every 5 minutes
SELECT cron.schedule(
  'job-auto-recovery-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/job-auto-recovery',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MzE1NzUsImV4cCI6MjA1NjEwNzU3NX0.u_q8t9gWuKFCnP2CtMSu8zJo3aVQ5B_4cTHCJNn_l2Q"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
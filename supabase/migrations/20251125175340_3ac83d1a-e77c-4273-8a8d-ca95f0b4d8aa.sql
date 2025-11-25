-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule AI Agent Runner to run every hour
-- This will check for active agents that are due to run and execute them
SELECT cron.schedule(
  'run-ai-agents-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url:='https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-agent-runner',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Log the cron job setup
DO $$
BEGIN
  -- Only log if organizations table has at least one row
  IF EXISTS (SELECT 1 FROM organizations LIMIT 1) THEN
    INSERT INTO audit_logs (org_id, actor, action, meta)
    SELECT 
      id as org_id,
      'system' as actor,
      'ai_agent_cron_setup' as action,
      jsonb_build_object(
        'schedule', 'hourly',
        'cron_expression', '0 * * * *',
        'setup_at', now()
      ) as meta
    FROM organizations
    LIMIT 1;
  END IF;
END $$;
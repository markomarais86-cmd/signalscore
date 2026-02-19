-- Step 1: Unschedule the broken auto-score cron
SELECT cron.unschedule(4);

-- Step 2: Reschedule with org_id in body and reduced chunk_size, no is_active filter
SELECT cron.schedule(
  'auto-score-accounts-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/bulk-score-accounts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := jsonb_build_object('org_id', id, 'chunk_size', 200, 'triggered_by', 'scheduled')
  ) as request_id
  FROM public.organizations;
  $$
);

-- Step 3: Register core pipeline agents
INSERT INTO public.ai_agent_registry (org_id, agent_name, agent_type, capabilities, status, health_score, last_heartbeat)
VALUES
  ('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'lead_qualification', 'pipeline', '[{"name": "qualify_leads", "description": "Qualifies leads based on ICP scoring and fit analysis"}]'::jsonb, 'active', 1.0, now()),
  ('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'data_enrichment', 'pipeline', '[{"name": "enrich_accounts", "description": "Enriches account data with external sources"}]'::jsonb, 'active', 1.0, now()),
  ('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'follow_up', 'pipeline', '[{"name": "follow_up_leads", "description": "Generates follow-up actions for qualified leads"}]'::jsonb, 'active', 1.0, now()),
  ('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'meeting_scheduler', 'pipeline', '[{"name": "schedule_meetings", "description": "Evaluates leads for meeting readiness and schedules outreach"}]'::jsonb, 'active', 1.0, now())
ON CONFLICT (org_id, agent_name) DO UPDATE SET
  status = 'active',
  capabilities = EXCLUDED.capabilities,
  health_score = 1.0,
  last_heartbeat = now(),
  updated_at = now();
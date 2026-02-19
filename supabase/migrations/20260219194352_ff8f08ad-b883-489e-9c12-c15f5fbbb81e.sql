-- Fix enrich-bed-counts-loop: loop over ALL organizations instead of hardcoded org_id
SELECT cron.unschedule('enrich-bed-counts-loop');

SELECT cron.schedule(
  'enrich-bed-counts-loop',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-bed-counts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := jsonb_build_object('org_id', id, 'batch_size', 200, 'triggered_by', 'scheduled')
  ) AS request_id
  FROM public.organizations;
  $$
);

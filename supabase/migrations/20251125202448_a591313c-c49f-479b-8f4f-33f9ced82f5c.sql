-- ============================================
-- Phase 1 & 3: GTM Fix - CRM Sync and Automation Cron Jobs
-- ============================================
-- Part 1: Create helper functions for scheduled jobs

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- Helper Function: Auto-match all orgs
-- ============================================
CREATE OR REPLACE FUNCTION public.scheduled_auto_match_all_orgs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org RECORD;
  result JSONB;
BEGIN
  FOR org IN SELECT id FROM public.organizations WHERE is_active = true LOOP
    BEGIN
      SELECT public.match_leads_to_accounts_fast(org.id, false) INTO result;
      
      -- Log the result
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        org.id,
        'system',
        'auto_match_scheduled',
        jsonb_build_object('result', result, 'timestamp', now())
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log errors but continue with other orgs
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        org.id,
        'system',
        'auto_match_error',
        jsonb_build_object('error', SQLERRM, 'timestamp', now())
      );
    END;
  END LOOP;
END;
$$;

-- ============================================
-- Helper Function: Data quality snapshot for all orgs
-- ============================================
CREATE OR REPLACE FUNCTION public.scheduled_quality_snapshot_all_orgs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations WHERE is_active = true LOOP
    BEGIN
      PERFORM public.record_data_quality_snapshot(org.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log errors but continue
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        org.id,
        'system',
        'quality_snapshot_error',
        jsonb_build_object('error', SQLERRM, 'timestamp', now())
      );
    END;
  END LOOP;
END;
$$;

-- ============================================
-- Schedule the cron jobs
-- ============================================

-- 1. CRM Sync - Every 4 hours
SELECT cron.schedule(
  'crm-sync-periodic',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-crm-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := jsonb_build_object('timestamp', now()::text)
  ) as request_id;
  $$
);

-- 2. Auto-match leads - Daily at 2am UTC
SELECT cron.schedule(
  'auto-match-leads-daily',
  '0 2 * * *',
  $$SELECT public.scheduled_auto_match_all_orgs();$$
);

-- 3. Auto-score accounts - Daily at 3am UTC
SELECT cron.schedule(
  'auto-score-accounts-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/bulk-score-accounts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := jsonb_build_object(
      'chunk_size', 5000,
      'triggered_by', 'scheduled'
    )
  ) as request_id
  FROM public.organizations
  WHERE is_active = true;
  $$
);

-- 4. Weekly data quality snapshot - Sunday at 6am UTC
SELECT cron.schedule(
  'weekly-quality-snapshot',
  '0 6 * * 0',
  $$SELECT public.scheduled_quality_snapshot_all_orgs();$$
);
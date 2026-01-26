-- Fix all SECURITY DEFINER functions that are missing search_path
-- This prevents search path hijacking attacks using ALTER FUNCTION

-- Fix get_current_user_org_id
ALTER FUNCTION public.get_current_user_org_id() SET search_path = public;

-- Fix is_current_user_admin
ALTER FUNCTION public.is_current_user_admin() SET search_path = public;

-- Fix has_role function if it exists
DO $$
BEGIN
  ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix get_org_enrichment_credits - use ALTER instead of CREATE OR REPLACE
DO $$
BEGIN
  ALTER FUNCTION public.get_org_enrichment_credits(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix normalize_domain_text
DO $$
BEGIN
  ALTER FUNCTION public.normalize_domain_text(text) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix get_dashboard_metrics_fast
DO $$
BEGIN
  ALTER FUNCTION public.get_dashboard_metrics_fast(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix get_geography_distribution
DO $$
BEGIN
  ALTER FUNCTION public.get_geography_distribution(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix increment_bulk_scoring_job_progress
DO $$
BEGIN
  ALTER FUNCTION public.increment_bulk_scoring_job_progress(uuid, integer, integer, integer) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix update_updated_at_column trigger function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Fix match_leads_to_accounts_fast if exists
DO $$
BEGIN
  ALTER FUNCTION public.match_leads_to_accounts_fast(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix update_scores_updated_at if exists
DO $$
BEGIN
  ALTER FUNCTION public.update_scores_updated_at() SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- Fix set_created_at if exists
DO $$
BEGIN
  ALTER FUNCTION public.set_created_at() SET search_path = public;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;
-- Phase 1: Add CRM/Database actual counts to dashboard metrics
-- This migration enhances get_dashboard_metrics_fast to return actual scored counts by source

DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE(
  total_accounts bigint,
  total_leads bigint,
  high_fit_accounts bigint,
  medium_fit_accounts bigint,
  low_fit_accounts bigint,
  campaign_ready_accounts bigint,
  campaign_ready_contacts bigint,
  crm_accounts bigint,
  database_accounts bigint,
  crm_scored_accounts bigint,
  database_scored_accounts bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_accounts AS (
    SELECT a.external_id, a.data_source
    FROM public.accounts a
    WHERE a.org_id = p_org_id
      AND (
        p_source_filter = 'all' 
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  source_breakdown AS (
    SELECT
      COUNT(*) FILTER (WHERE data_source IN ('crm', 'both'))::bigint AS crm_count,
      COUNT(*) FILTER (WHERE data_source = 'database')::bigint AS database_count
    FROM filtered_accounts
  ),
  scored_metrics AS (
    SELECT
      COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END)::bigint AS high_fit_count,
      COUNT(DISTINCT CASE WHEN s.overall >= 40 AND s.overall < 70 THEN s.account_external_id END)::bigint AS medium_fit_count,
      COUNT(DISTINCT CASE WHEN s.overall < 40 THEN s.account_external_id END)::bigint AS low_fit_count,
      COUNT(DISTINCT CASE WHEN fa.data_source IN ('crm', 'both') THEN s.account_external_id END)::bigint AS crm_scored_count,
      COUNT(DISTINCT CASE WHEN fa.data_source = 'database' THEN s.account_external_id END)::bigint AS database_scored_count
    FROM public.scores s
    INNER JOIN filtered_accounts fa ON s.account_external_id = fa.external_id
    WHERE s.org_id = p_org_id
  ),
  campaign_metrics AS (
    SELECT
      COUNT(DISTINCT a.external_id)::bigint AS ready_accounts,
      COUNT(DISTINCT l.id)::bigint AS ready_contacts
    FROM public.accounts a
    INNER JOIN public.scores s ON a.external_id = s.account_external_id AND s.org_id = a.org_id
    INNER JOIN public."Leads" l ON a.external_id = l.account_external_id AND l.org_id = a.org_id
    INNER JOIN filtered_accounts fa ON a.external_id = fa.external_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND l.email IS NOT NULL
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown'
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM filtered_accounts) AS total_accounts,
    (SELECT COUNT(*)::bigint FROM public."Leads" l INNER JOIN filtered_accounts fa ON l.account_external_id = fa.external_id WHERE l.org_id = p_org_id) AS total_leads,
    COALESCE(sm.high_fit_count, 0)::bigint AS high_fit_accounts,
    COALESCE(sm.medium_fit_count, 0)::bigint AS medium_fit_accounts,
    COALESCE(sm.low_fit_count, 0)::bigint AS low_fit_accounts,
    COALESCE(cm.ready_accounts, 0)::bigint AS campaign_ready_accounts,
    COALESCE(cm.ready_contacts, 0)::bigint AS campaign_ready_contacts,
    COALESCE(sb.crm_count, 0)::bigint AS crm_accounts,
    COALESCE(sb.database_count, 0)::bigint AS database_accounts,
    COALESCE(sm.crm_scored_count, 0)::bigint AS crm_scored_accounts,
    COALESCE(sm.database_scored_count, 0)::bigint AS database_scored_accounts
  FROM scored_metrics sm
  CROSS JOIN campaign_metrics cm
  CROSS JOIN source_breakdown sb;
END;
$function$;
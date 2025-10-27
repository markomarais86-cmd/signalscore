-- Fix dashboard metrics: Add campaign_ready_accounts and refresh views

-- 1. Drop and recreate dashboard metrics materialized view with campaign_ready calculation
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_metrics_by_org CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_metrics_by_org AS
SELECT 
  a.org_id,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_accounts,
  COUNT(*) FILTER (WHERE a.data_source = 'database') as database_accounts,
  COUNT(*) FILTER (WHERE a.data_source = 'both') as both_accounts,
  COUNT(*) FILTER (WHERE a.industry_norm IS NOT NULL) as with_industry,
  COUNT(*) FILTER (WHERE a.employee_count IS NOT NULL) as with_size,
  COUNT(*) FILTER (WHERE a.revenue_range IS NOT NULL) as with_revenue,
  COUNT(*) FILTER (WHERE a.country IS NOT NULL) as with_geo,
  COALESCE(COUNT(DISTINCT c.account_external_id), 0) as with_contacts,
  COALESCE(COUNT(DISTINCT s.account_external_id), 0) as scored_accounts,
  COALESCE(COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END), 0) as high_fit_accounts,
  COALESCE(COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN s.account_external_id END), 0) as high_fit_crm,
  COALESCE(COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN s.account_external_id END), 0) as high_fit_database,
  -- NEW: Campaign ready accounts (high fit + has contacts)
  COALESCE(COUNT(DISTINCT CASE WHEN s.overall >= 70 AND c.account_external_id IS NOT NULL THEN a.external_id END), 0) as campaign_ready_accounts,
  now() as computed_at
FROM public.accounts a
LEFT JOIN public.contacts c ON c.account_external_id = a.external_id AND c.org_id = a.org_id
LEFT JOIN public.scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
GROUP BY a.org_id;

CREATE UNIQUE INDEX idx_mv_dashboard_metrics_org ON public.mv_dashboard_metrics_by_org(org_id);

-- 2. Update get_dashboard_metrics_fast to include campaign_ready_accounts
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  mv_data RECORD;
  result JSONB;
BEGIN
  -- Get from materialized view
  SELECT * INTO mv_data
  FROM public.mv_dashboard_metrics_by_org
  WHERE org_id = p_org_id;
  
  IF mv_data IS NOT NULL THEN
    -- Build complete metrics response
    SELECT jsonb_build_object(
      'totalAccounts', mv_data.total_accounts,
      'crmAccounts', mv_data.crm_accounts,
      'databaseAccounts', mv_data.database_accounts,
      'bothAccounts', mv_data.both_accounts,
      'scoredAccounts', mv_data.scored_accounts,
      'highFitAccounts', mv_data.high_fit_accounts,
      'highFitCrmAccounts', mv_data.high_fit_crm,
      'highFitDatabaseAccounts', mv_data.high_fit_database,
      'campaignReadyAccounts', mv_data.campaign_ready_accounts,
      'totalLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id),
      'linkedLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id AND account_external_id IS NOT NULL),
      'dataCompleteness', CASE 
        WHEN mv_data.total_accounts > 0 THEN
          ROUND((
            mv_data.with_industry::numeric / mv_data.total_accounts * 25 +
            mv_data.with_size::numeric / mv_data.total_accounts * 25 +
            mv_data.with_revenue::numeric / mv_data.total_accounts * 25 +
            mv_data.with_geo::numeric / mv_data.total_accounts * 25
          ))::integer
        ELSE 0
      END,
      'computed_from_cache', true,
      'cache_age_minutes', EXTRACT(EPOCH FROM (now() - mv_data.computed_at)) / 60
    ) INTO result;
    
    RETURN result;
  END IF;
  
  -- Fallback if view is empty
  RETURN jsonb_build_object(
    'totalAccounts', 0,
    'computed_from_cache', false,
    'error', 'Materialized view not populated'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Refresh materialized views with fresh data
REFRESH MATERIALIZED VIEW public.mv_dashboard_metrics_by_org;
REFRESH MATERIALIZED VIEW public.mv_geography_by_org;
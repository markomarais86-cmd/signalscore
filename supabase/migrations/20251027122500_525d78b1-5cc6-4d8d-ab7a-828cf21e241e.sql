-- PHASE 2: Performance Optimizations - Materialized Views

-- 1. Dashboard metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dashboard_metrics_by_org AS
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
  now() as computed_at
FROM public.accounts a
LEFT JOIN public.contacts c ON c.account_external_id = a.external_id AND c.org_id = a.org_id
LEFT JOIN public.scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
GROUP BY a.org_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_metrics_org ON public.mv_dashboard_metrics_by_org(org_id);

-- 2. Geography distribution materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_geography_by_org AS
SELECT 
  a.org_id,
  public.normalize_country(a.country) as country,
  COUNT(*) as account_count
FROM public.accounts a
WHERE a.country IS NOT NULL
  AND a.country != ''
  AND NOT (a.country ~ '^[\d\s\-\(\)\+\.]+$')
GROUP BY a.org_id, public.normalize_country(a.country);

CREATE INDEX IF NOT EXISTS idx_mv_geography_org_count ON public.mv_geography_by_org(org_id, account_count DESC);

-- 3. Update get_dashboard_metrics_fast to use materialized view
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  mv_data RECORD;
  result JSONB;
BEGIN
  -- Try to get from materialized view first
  SELECT * INTO mv_data
  FROM public.mv_dashboard_metrics_by_org
  WHERE org_id = p_org_id;
  
  IF mv_data IS NOT NULL THEN
    -- Get additional metrics from other tables
    SELECT jsonb_build_object(
      'totalAccounts', mv_data.total_accounts,
      'crmAccounts', mv_data.crm_accounts,
      'databaseAccounts', mv_data.database_accounts,
      'bothAccounts', mv_data.both_accounts,
      'scoredAccounts', mv_data.scored_accounts,
      'highFitAccounts', mv_data.high_fit_accounts,
      'highFitCrmAccounts', mv_data.high_fit_crm,
      'highFitDatabaseAccounts', mv_data.high_fit_database,
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
  
  -- Fallback to live query if materialized view is empty
  RETURN jsonb_build_object(
    'totalAccounts', 0,
    'computed_from_cache', false,
    'error', 'Materialized view not populated'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update geography function to use materialized view
CREATE OR REPLACE FUNCTION public.get_geography_distribution(p_org_id UUID)
RETURNS TABLE(country TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT mv.country, mv.account_count
  FROM public.mv_geography_by_org mv
  WHERE mv.org_id = p_org_id
  ORDER BY mv.account_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
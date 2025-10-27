-- Fix materialized view to prevent duplicate counts and add score distribution

DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_metrics_by_org CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_metrics_by_org AS
SELECT 
  a.org_id,
  -- Account counts (no duplicates)
  COUNT(DISTINCT a.external_id) as total_accounts,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_accounts,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source = 'database') as database_accounts,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source = 'both') as both_accounts,
  
  -- Data completeness
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.industry_norm IS NOT NULL) as with_industry,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.employee_count IS NOT NULL) as with_size,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.revenue_range IS NOT NULL) as with_revenue,
  COUNT(DISTINCT a.external_id) FILTER (WHERE a.country IS NOT NULL) as with_geo,
  
  -- Accounts with contacts (distinct)
  COUNT(DISTINCT c.account_external_id) as with_contacts,
  
  -- Score-based metrics (distinct accounts only)
  COUNT(DISTINCT s.account_external_id) as scored_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END) as high_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 40 AND s.overall < 70 THEN s.account_external_id END) as medium_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall < 40 THEN s.account_external_id END) as low_fit_accounts,
  
  -- Score-based + data source breakdown
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN s.account_external_id END) as high_fit_crm,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN s.account_external_id END) as high_fit_database,
  
  -- Campaign ready (high fit + has contacts)
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND c.account_external_id IS NOT NULL THEN a.external_id END) as campaign_ready_accounts,
  
  now() as computed_at
FROM public.accounts a
LEFT JOIN public.contacts c ON c.account_external_id = a.external_id AND c.org_id = a.org_id
LEFT JOIN public.scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
GROUP BY a.org_id;

CREATE UNIQUE INDEX idx_mv_dashboard_metrics_org ON public.mv_dashboard_metrics_by_org(org_id);

-- Update the RPC function to include medium/low fit
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  mv_data RECORD;
  result JSONB;
BEGIN
  SELECT * INTO mv_data
  FROM public.mv_dashboard_metrics_by_org
  WHERE org_id = p_org_id;
  
  IF mv_data IS NOT NULL THEN
    SELECT jsonb_build_object(
      'totalAccounts', mv_data.total_accounts,
      'crmAccounts', mv_data.crm_accounts,
      'databaseAccounts', mv_data.database_accounts,
      'bothAccounts', mv_data.both_accounts,
      'scoredAccounts', mv_data.scored_accounts,
      'highFitAccounts', mv_data.high_fit_accounts,
      'mediumFitAccounts', mv_data.medium_fit_accounts,
      'lowFitAccounts', mv_data.low_fit_accounts,
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
  
  RETURN jsonb_build_object(
    'totalAccounts', 0,
    'computed_from_cache', false,
    'error', 'Materialized view not populated'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Refresh with corrected data
REFRESH MATERIALIZED VIEW public.mv_dashboard_metrics_by_org;
REFRESH MATERIALIZED VIEW public.mv_geography_by_org;
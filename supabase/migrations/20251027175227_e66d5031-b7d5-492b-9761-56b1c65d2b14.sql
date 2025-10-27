-- Add leads breakdown metrics to materialized view
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_metrics_by_org CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_metrics_by_org AS
SELECT 
  a.org_id,
  COUNT(DISTINCT a.external_id)::integer as total_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'crm' THEN a.external_id END)::integer as crm_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN a.external_id END)::integer as database_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'both' THEN a.external_id END)::integer as both_accounts,
  COUNT(DISTINCT s.account_external_id)::integer as scored_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END)::integer as high_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 50 AND s.overall < 70 THEN s.account_external_id END)::integer as medium_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall < 50 THEN s.account_external_id END)::integer as low_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN s.account_external_id END)::integer as high_fit_crm,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN s.account_external_id END)::integer as high_fit_database,
  COUNT(DISTINCT CASE WHEN a.industry_norm IS NOT NULL THEN a.external_id END)::integer as with_industry,
  COUNT(DISTINCT CASE WHEN a.employee_count IS NOT NULL THEN a.external_id END)::integer as with_size,
  COUNT(DISTINCT CASE WHEN a.revenue_range IS NOT NULL THEN a.external_id END)::integer as with_revenue,
  COUNT(DISTINCT CASE WHEN a.country IS NOT NULL THEN a.external_id END)::integer as with_geo,
  -- Campaign ready metrics (from Leads table)
  COUNT(DISTINCT CASE 
    WHEN l.email IS NOT NULL 
    AND l.email != '' 
    AND (l.persona IS NOT NULL OR l.title IS NOT NULL)
    AND s.overall >= 70
    THEN l.id 
  END)::integer as campaign_ready_leads,
  COUNT(DISTINCT CASE 
    WHEN l.email IS NOT NULL 
    AND l.email != '' 
    AND (l.persona IS NOT NULL OR l.title IS NOT NULL)
    AND s.overall >= 70
    THEN a.external_id 
  END)::integer as campaign_ready_accounts,
  -- NEW: Leads breakdown by source
  COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN l.id END)::integer as crm_leads,
  COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN l.id END)::integer as database_leads,
  -- NEW: High-fit leads breakdown
  COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN l.id END)::integer as high_fit_leads_total,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN l.id END)::integer as high_fit_crm_leads,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN l.id END)::integer as high_fit_database_leads,
  now() as computed_at
FROM public.accounts a
LEFT JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
LEFT JOIN public."Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
GROUP BY a.org_id;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_mv_dashboard_metrics_org ON public.mv_dashboard_metrics_by_org(org_id);

-- Refresh the view with initial data
REFRESH MATERIALIZED VIEW public.mv_dashboard_metrics_by_org;

-- Grant permissions
GRANT SELECT ON public.mv_dashboard_metrics_by_org TO authenticated;

COMMENT ON MATERIALIZED VIEW public.mv_dashboard_metrics_by_org IS 'Cached dashboard metrics per organization with full leads breakdown by source and fit level';

-- Update the function to return the new fields
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      'campaignReadyLeads', mv_data.campaign_ready_leads,
      'totalLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id),
      'linkedLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id AND account_external_id IS NOT NULL),
      'crmLeads', mv_data.crm_leads,
      'databaseLeads', mv_data.database_leads,
      'highFitLeadsTotal', mv_data.high_fit_leads_total,
      'highFitCrmLeads', mv_data.high_fit_crm_leads,
      'highFitDatabaseLeads', mv_data.high_fit_database_leads,
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
$function$;
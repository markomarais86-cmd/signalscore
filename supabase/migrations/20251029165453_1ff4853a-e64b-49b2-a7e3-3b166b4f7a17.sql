-- Fix function overloading conflict for get_dashboard_metrics_fast
-- Drop the old function signature first
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);

-- Recreate with the new signature including optional p_icp_id parameter
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id UUID,
  p_icp_id UUID DEFAULT NULL
)
RETURNS JSONB
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
    IF p_icp_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'totalAccounts', COUNT(DISTINCT a.external_id),
        'scoredAccounts', COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.external_id END),
        'highFitAccounts', COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END),
        'mediumFitAccounts', COUNT(DISTINCT CASE WHEN s.overall >= 40 AND s.overall < 70 THEN a.external_id END),
        'lowFitAccounts', COUNT(DISTINCT CASE WHEN s.overall < 40 THEN a.external_id END),
        'computed_from_cache', false,
        'filtered_by_icp', true,
        'icp_id', p_icp_id
      ) INTO result
      FROM public.accounts a
      LEFT JOIN public.scores s ON s.account_external_id = a.external_id 
        AND s.org_id = a.org_id 
        AND s.icp_id = p_icp_id
      WHERE a.org_id = p_org_id;
      
      RETURN result;
    END IF;
    
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
      'filtered_by_icp', false,
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
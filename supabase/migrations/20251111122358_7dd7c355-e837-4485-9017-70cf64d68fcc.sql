-- Update RPC functions to query external_data_sources for 'database' filter

-- Update get_dashboard_metrics_fast to query external_data_sources when filter is 'database'
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- When filter is 'database', query external_data_sources (third-party data)
  IF p_source_filter = 'database' THEN
    WITH external_metrics AS (
      SELECT
        COUNT(DISTINCT eds.external_id)::int AS total_accounts,
        0::int AS scored_accounts,
        0::int AS crm_accounts,
        COUNT(DISTINCT eds.external_id)::int AS database_accounts,
        0::int AS both_accounts,
        0::int AS high_fit_accounts,
        0::int AS medium_fit_accounts,
        0::int AS low_fit_accounts,
        0::int AS high_fit_crm_accounts,
        0::int AS high_fit_database_accounts,
        0::int AS data_completeness
      FROM external_data_sources eds
      WHERE eds.org_id = p_org_id
    ),
    external_lead_metrics AS (
      SELECT
        COUNT(DISTINCT edl.id)::int AS total_leads,
        0::int AS linked_leads,
        0::int AS crm_leads,
        COUNT(DISTINCT edl.id)::int AS database_leads,
        0::int AS high_fit_leads_total,
        0::int AS high_fit_crm_leads,
        0::int AS high_fit_database_leads,
        0::int AS campaign_ready_leads
      FROM external_data_leads edl
      INNER JOIN external_data_sources eds ON edl.source_id = eds.id
      WHERE eds.org_id = p_org_id
    )
    SELECT jsonb_build_object(
      'totalAccounts', em.total_accounts,
      'scoredAccounts', em.scored_accounts,
      'totalLeads', elm.total_leads,
      'crmAccounts', em.crm_accounts,
      'databaseAccounts', em.database_accounts,
      'bothAccounts', em.both_accounts,
      'linkedLeads', elm.linked_leads,
      'highFitAccounts', em.high_fit_accounts,
      'mediumFitAccounts', em.medium_fit_accounts,
      'lowFitAccounts', em.low_fit_accounts,
      'highFitCrmAccounts', em.high_fit_crm_accounts,
      'highFitDatabaseAccounts', em.high_fit_database_accounts,
      'crmLeads', elm.crm_leads,
      'databaseLeads', elm.database_leads,
      'highFitLeadsTotal', elm.high_fit_leads_total,
      'highFitCrmLeads', elm.high_fit_crm_leads,
      'highFitDatabaseLeads', elm.high_fit_database_leads,
      'campaignReadyAccounts', 0,
      'campaignReadyLeads', elm.campaign_ready_leads,
      'dataCompleteness', em.data_completeness
    ) INTO result
    FROM external_metrics em, external_lead_metrics elm;
    
    RETURN result;
  END IF;

  -- For 'all' and 'crm' filters, query accounts table (all internal data)
  WITH metrics AS (
    SELECT
      COUNT(DISTINCT a.external_id)::int AS total_accounts,
      COUNT(DISTINCT CASE WHEN s.overall IS NOT NULL THEN a.external_id END)::int AS scored_accounts,
      COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN a.external_id END)::int AS crm_accounts,
      COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN a.external_id END)::int AS database_accounts,
      COUNT(DISTINCT CASE WHEN a.data_source = 'both' THEN a.external_id END)::int AS both_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END)::int AS high_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 50 AND s.overall < 70 THEN a.external_id END)::int AS medium_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall < 50 THEN a.external_id END)::int AS low_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN a.external_id END)::int AS high_fit_crm_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN a.external_id END)::int AS high_fit_database_accounts,
      ROUND(AVG(CASE 
        WHEN a.industry_norm IS NOT NULL AND a.employee_count IS NOT NULL 
             AND a.revenue_range IS NOT NULL AND a.country IS NOT NULL 
        THEN 100 
        ELSE (
          (CASE WHEN a.industry_norm IS NOT NULL THEN 25 ELSE 0 END) +
          (CASE WHEN a.employee_count IS NOT NULL THEN 25 ELSE 0 END) +
          (CASE WHEN a.revenue_range IS NOT NULL THEN 25 ELSE 0 END) +
          (CASE WHEN a.country IS NOT NULL THEN 25 ELSE 0 END)
        )
      END))::int AS data_completeness
    FROM accounts a
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE a.org_id = p_org_id
  ),
  lead_metrics AS (
    SELECT
      COUNT(DISTINCT l.id)::int AS total_leads,
      COUNT(DISTINCT CASE WHEN l.account_external_id IS NOT NULL THEN l.id END)::int AS linked_leads,
      COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN l.id END)::int AS crm_leads,
      COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN l.id END)::int AS database_leads,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN l.id END)::int AS high_fit_leads_total,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN l.id END)::int AS high_fit_crm_leads,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN l.id END)::int AS high_fit_database_leads,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND is_lead_campaign_ready(l.email, l.title, l.persona) THEN l.id END)::int AS campaign_ready_leads
    FROM "Leads" l
    LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE l.org_id = p_org_id
  ),
  campaign_accounts AS (
    SELECT COUNT(DISTINCT a.external_id)::int AS campaign_ready_accounts
    FROM accounts a
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona)
  )
  SELECT jsonb_build_object(
    'totalAccounts', m.total_accounts,
    'scoredAccounts', m.scored_accounts,
    'totalLeads', lm.total_leads,
    'crmAccounts', m.crm_accounts,
    'databaseAccounts', m.database_accounts,
    'bothAccounts', m.both_accounts,
    'linkedLeads', lm.linked_leads,
    'highFitAccounts', m.high_fit_accounts,
    'mediumFitAccounts', m.medium_fit_accounts,
    'lowFitAccounts', m.low_fit_accounts,
    'highFitCrmAccounts', m.high_fit_crm_accounts,
    'highFitDatabaseAccounts', m.high_fit_database_accounts,
    'crmLeads', lm.crm_leads,
    'databaseLeads', lm.database_leads,
    'highFitLeadsTotal', lm.high_fit_leads_total,
    'highFitCrmLeads', lm.high_fit_crm_leads,
    'highFitDatabaseLeads', lm.high_fit_database_leads,
    'campaignReadyAccounts', ca.campaign_ready_accounts,
    'campaignReadyLeads', lm.campaign_ready_leads,
    'dataCompleteness', m.data_completeness
  ) INTO result
  FROM metrics m, lead_metrics lm, campaign_accounts ca;

  RETURN result;
END;
$function$;

-- Update get_geography_distribution to query external_data_sources when filter is 'database'
CREATE OR REPLACE FUNCTION public.get_geography_distribution(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE(country text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When filter is 'database', query external_data_sources (third-party data)
  IF p_source_filter = 'database' THEN
    RETURN QUERY
    SELECT 
      COALESCE(eds.country, 'Unknown') as country,
      COUNT(*)::bigint as count
    FROM external_data_sources eds
    WHERE eds.org_id = p_org_id
      AND eds.country IS NOT NULL
      AND eds.country != ''
    GROUP BY eds.country
    ORDER BY count DESC
    LIMIT 50;
    RETURN;
  END IF;

  -- For 'all' and 'crm' filters, query accounts table (all internal data)
  RETURN QUERY
  SELECT 
    COALESCE(a.country, 'Unknown') as country,
    COUNT(*)::bigint as count
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND a.country IS NOT NULL
    AND a.country != ''
  GROUP BY a.country
  ORDER BY count DESC
  LIMIT 50;
END;
$function$;
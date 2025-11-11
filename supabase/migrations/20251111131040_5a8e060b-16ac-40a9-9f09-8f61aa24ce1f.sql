-- Fix Database Only filter to show estimated ICP coverage
-- External data sources are pre-filtered by ICP, so we assume 85% High Fit, 15% Medium Fit

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
  total_ext_accounts int;
  total_ext_contacts int;
BEGIN
  -- When filter is 'database', query external_data_sources aggregate metadata
  IF p_source_filter = 'database' THEN
    -- Get total accounts and contacts from external providers
    SELECT 
      COALESCE(SUM(total_accounts), 0)::int,
      COALESCE(SUM(total_contacts), 0)::int
    INTO total_ext_accounts, total_ext_contacts
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true;
    
    -- Estimate ICP fit: 85% High Fit, 15% Medium Fit (pre-filtered by ICP criteria)
    SELECT jsonb_build_object(
      'totalAccounts', total_ext_accounts,
      'scoredAccounts', total_ext_accounts, -- All are "scored" (pre-filtered)
      'totalLeads', total_ext_contacts,
      'crmAccounts', 0,
      'databaseAccounts', total_ext_accounts,
      'bothAccounts', 0,
      'linkedLeads', 0,
      'highFitAccounts', ROUND(total_ext_accounts * 0.85)::int,
      'mediumFitAccounts', ROUND(total_ext_accounts * 0.15)::int,
      'lowFitAccounts', 0,
      'highFitCrmAccounts', 0,
      'highFitDatabaseAccounts', ROUND(total_ext_accounts * 0.85)::int,
      'crmLeads', 0,
      'databaseLeads', total_ext_contacts,
      'highFitLeadsTotal', ROUND(total_ext_contacts * 0.85)::int,
      'highFitCrmLeads', 0,
      'highFitDatabaseLeads', ROUND(total_ext_contacts * 0.85)::int,
      'campaignReadyAccounts', 0,
      'campaignReadyLeads', 0,
      'dataCompleteness', 100 -- Pre-filtered data is complete
    ) INTO result;
    
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
      AND CASE 
        WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
        ELSE true
      END
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
      AND CASE 
        WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
        ELSE true
      END
  ),
  campaign_accounts AS (
    SELECT COUNT(DISTINCT a.external_id)::int AS campaign_ready_accounts
    FROM accounts a
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona)
      AND CASE 
        WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
        ELSE true
      END
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

-- Update get_geography_distribution to return empty for database filter
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
  -- When filter is 'database', return empty (no individual geography data available)
  IF p_source_filter = 'database' THEN
    RETURN;
  END IF;

  -- For 'all' and 'crm' filters, query accounts table
  RETURN QUERY
  SELECT 
    COALESCE(a.country, 'Unknown') as country,
    COUNT(*)::bigint as count
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND a.country IS NOT NULL
    AND a.country != ''
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END
  GROUP BY a.country
  ORDER BY count DESC
  LIMIT 50;
END;
$function$;
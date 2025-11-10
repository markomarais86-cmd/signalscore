-- Update get_dashboard_metrics_fast to support source filtering
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
  source_where text;
BEGIN
  -- Build source filter condition
  IF p_source_filter = 'crm' THEN
    source_where := 'AND a.data_source IN (''crm'', ''both'')';
  ELSIF p_source_filter = 'database' THEN
    source_where := 'AND a.data_source = ''database''';
  ELSE
    source_where := ''; -- 'all' - no filter
  END IF;

  -- Single aggregated query with source filtering
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
      AND (p_source_filter = 'all' OR 
           (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
           (p_source_filter = 'database' AND a.data_source = 'database'))
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
      AND (p_source_filter = 'all' OR 
           (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
           (p_source_filter = 'database' AND a.data_source = 'database'))
  ),
  campaign_accounts AS (
    SELECT COUNT(DISTINCT a.external_id)::int AS campaign_ready_accounts
    FROM accounts a
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona)
      AND (p_source_filter = 'all' OR 
           (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
           (p_source_filter = 'database' AND a.data_source = 'database'))
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

-- Update get_geography_distribution to support source filtering
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
  RETURN QUERY
  SELECT 
    COALESCE(a.country, 'Unknown') as country,
    COUNT(*)::bigint as count
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND a.country IS NOT NULL
    AND a.country != ''
    AND (
      p_source_filter = 'all' OR
      (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
      (p_source_filter = 'database' AND a.data_source = 'database')
    )
  GROUP BY a.country
  ORDER BY count DESC
  LIMIT 50;
END;
$function$;
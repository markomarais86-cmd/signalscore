-- Fix get_dashboard_metrics_fast to use fit score AND accept p_source_filter parameter
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid, p_source_filter text DEFAULT 'crm')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH account_stats AS (
    SELECT
      COUNT(*) as total_accounts,
      COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source = 'salesforce' OR a.data_source = 'hubspot') as crm_accounts,
      COUNT(DISTINCT a.external_id) FILTER (WHERE a.external_database_match = true) as database_accounts,
      COUNT(DISTINCT a.external_id) FILTER (WHERE (a.data_source = 'salesforce' OR a.data_source = 'hubspot') AND a.external_database_match = true) as both_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id
  ),
  score_stats AS (
    SELECT
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE a.data_source IN ('salesforce', 'hubspot')) as crm_scored_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE a.external_database_match = true) as database_scored_accounts,
      -- Use s.fit for fit distribution (not s.overall)
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 70) as high_fit_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 40 AND s.fit < 70) as medium_fit_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit < 40) as low_fit_accounts,
      -- CRM source breakdown - use s.fit
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 70 AND a.data_source IN ('salesforce', 'hubspot')) as high_fit_crm_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 40 AND s.fit < 70 AND a.data_source IN ('salesforce', 'hubspot')) as medium_fit_crm_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit < 40 AND a.data_source IN ('salesforce', 'hubspot')) as low_fit_crm_accounts,
      -- Database source breakdown - use s.fit
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 70 AND a.external_database_match = true) as high_fit_database_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit >= 40 AND s.fit < 70 AND a.external_database_match = true) as medium_fit_database_accounts,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.fit < 40 AND a.external_database_match = true) as low_fit_database_accounts
    FROM scores s
    JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
  ),
  lead_stats AS (
    SELECT
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE l.account_external_id IS NOT NULL) as linked_leads,
      COUNT(*) FILTER (WHERE a.data_source IN ('salesforce', 'hubspot')) as crm_leads,
      COUNT(*) FILTER (WHERE a.external_database_match = true) as database_leads,
      -- Use fit_score for leads (Leads table uses fit_score column)
      COUNT(*) FILTER (WHERE l.fit_score >= 70) as high_fit_leads_total,
      COUNT(*) FILTER (WHERE l.fit_score >= 70 AND a.data_source IN ('salesforce', 'hubspot')) as high_fit_crm_leads,
      COUNT(*) FILTER (WHERE l.fit_score >= 70 AND a.external_database_match = true) as high_fit_database_leads,
      COUNT(*) FILTER (WHERE l.fit_score >= 40 AND l.fit_score < 70 AND a.data_source IN ('salesforce', 'hubspot')) as medium_fit_crm_leads,
      COUNT(*) FILTER (WHERE l.fit_score >= 40 AND l.fit_score < 70 AND a.external_database_match = true) as medium_fit_database_leads,
      COUNT(*) FILTER (WHERE l.fit_score < 40 AND a.data_source IN ('salesforce', 'hubspot')) as low_fit_crm_leads,
      COUNT(*) FILTER (WHERE l.fit_score < 40 AND a.external_database_match = true) as low_fit_database_leads
    FROM "Leads" l
    LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
  ),
  campaign_ready AS (
    SELECT 
      COUNT(DISTINCT a.external_id) as campaign_ready_accounts,
      COUNT(DISTINCT l.id) as campaign_ready_leads
    FROM "Leads" l
    JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.email IS NOT NULL 
      AND l.email != ''
      AND s.fit >= 70  -- Use fit score for campaign ready
  ),
  data_quality AS (
    SELECT COALESCE(
      (SELECT overall_completeness FROM data_quality_history 
       WHERE org_id = p_org_id 
       ORDER BY created_at DESC LIMIT 1), 
      0
    ) as data_completeness
  ),
  apollo_data AS (
    SELECT
      COALESCE(total_accounts, 0) as apollo_accounts_available,
      COALESCE(total_contacts, 0) as apollo_contacts_available,
      provider as apollo_provider
    FROM external_data_sources
    WHERE org_id = p_org_id AND provider = 'apollo' AND is_active = true
    LIMIT 1
  )
  SELECT json_build_object(
    'total_accounts', COALESCE(ast.total_accounts, 0),
    'total_leads', COALESCE(ls.total_leads, 0),
    'crm_accounts', COALESCE(ast.crm_accounts, 0),
    'database_accounts', COALESCE(ast.database_accounts, 0),
    'both_accounts', COALESCE(ast.both_accounts, 0),
    'crm_scored_accounts', COALESCE(ss.crm_scored_accounts, 0),
    'database_scored_accounts', COALESCE(ss.database_scored_accounts, 0),
    'linked_leads', COALESCE(ls.linked_leads, 0),
    'high_fit_accounts', COALESCE(ss.high_fit_accounts, 0),
    'medium_fit_accounts', COALESCE(ss.medium_fit_accounts, 0),
    'low_fit_accounts', COALESCE(ss.low_fit_accounts, 0),
    'high_fit_crm_accounts', COALESCE(ss.high_fit_crm_accounts, 0),
    'high_fit_database_accounts', COALESCE(ss.high_fit_database_accounts, 0),
    'medium_fit_crm_accounts', COALESCE(ss.medium_fit_crm_accounts, 0),
    'medium_fit_database_accounts', COALESCE(ss.medium_fit_database_accounts, 0),
    'low_fit_crm_accounts', COALESCE(ss.low_fit_crm_accounts, 0),
    'low_fit_database_accounts', COALESCE(ss.low_fit_database_accounts, 0),
    'crm_leads', COALESCE(ls.crm_leads, 0),
    'database_leads', COALESCE(ls.database_leads, 0),
    'high_fit_leads_total', COALESCE(ls.high_fit_leads_total, 0),
    'high_fit_crm_leads', COALESCE(ls.high_fit_crm_leads, 0),
    'high_fit_database_leads', COALESCE(ls.high_fit_database_leads, 0),
    'medium_fit_crm_leads', COALESCE(ls.medium_fit_crm_leads, 0),
    'medium_fit_database_leads', COALESCE(ls.medium_fit_database_leads, 0),
    'low_fit_crm_leads', COALESCE(ls.low_fit_crm_leads, 0),
    'low_fit_database_leads', COALESCE(ls.low_fit_database_leads, 0),
    'campaign_ready_accounts', COALESCE(cr.campaign_ready_accounts, 0),
    'campaign_ready_leads', COALESCE(cr.campaign_ready_leads, 0),
    'data_completeness', COALESCE(dq.data_completeness, 0),
    'apollo_accounts_available', COALESCE(ad.apollo_accounts_available, 0),
    'apollo_contacts_available', COALESCE(ad.apollo_contacts_available, 0),
    'apollo_provider', ad.apollo_provider
  ) INTO v_result
  FROM account_stats ast
  CROSS JOIN score_stats ss
  CROSS JOIN lead_stats ls
  CROSS JOIN campaign_ready cr
  CROSS JOIN data_quality dq
  LEFT JOIN apollo_data ad ON true;

  RETURN v_result;
END;
$$;
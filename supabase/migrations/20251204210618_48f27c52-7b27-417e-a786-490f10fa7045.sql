-- Update get_dashboard_metrics_fast to use fit score instead of overall score
-- This fixes the dashboard to show correct ICP fit distribution

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
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
      COUNT(DISTINCT a.external_id) FILTER (WHERE a.external_database_match = true) as database_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id
  ),
  score_stats AS (
    SELECT
      COUNT(DISTINCT s.account_external_id) as scored_accounts,
      ROUND(AVG(s.fit)::numeric, 1) as avg_fit_score,
      -- Use s.fit instead of s.overall for fit distribution
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
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as leads_with_email,
      COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '') as leads_with_phone,
      -- Use fit_score for lead distribution (leads table uses fit_score column)
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_leads_total,
      COUNT(*) FILTER (WHERE fit_score >= 40 AND fit_score < 70) as medium_fit_leads_total,
      COUNT(*) FILTER (WHERE fit_score < 40 AND fit_score IS NOT NULL) as low_fit_leads_total
    FROM "Leads"
    WHERE org_id = p_org_id
  ),
  campaign_ready AS (
    SELECT COUNT(DISTINCT l.id) as campaign_ready_leads
    FROM "Leads" l
    JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.email IS NOT NULL 
      AND l.email != ''
      AND s.fit >= 70  -- Use fit score for campaign ready
  )
  SELECT json_build_object(
    'total_accounts', COALESCE(ast.total_accounts, 0),
    'crm_accounts', COALESCE(ast.crm_accounts, 0),
    'database_accounts', COALESCE(ast.database_accounts, 0),
    'scored_accounts', COALESCE(ss.scored_accounts, 0),
    'avg_fit_score', COALESCE(ss.avg_fit_score, 0),
    'high_fit_accounts', COALESCE(ss.high_fit_accounts, 0),
    'medium_fit_accounts', COALESCE(ss.medium_fit_accounts, 0),
    'low_fit_accounts', COALESCE(ss.low_fit_accounts, 0),
    'high_fit_crm_accounts', COALESCE(ss.high_fit_crm_accounts, 0),
    'medium_fit_crm_accounts', COALESCE(ss.medium_fit_crm_accounts, 0),
    'low_fit_crm_accounts', COALESCE(ss.low_fit_crm_accounts, 0),
    'high_fit_database_accounts', COALESCE(ss.high_fit_database_accounts, 0),
    'medium_fit_database_accounts', COALESCE(ss.medium_fit_database_accounts, 0),
    'low_fit_database_accounts', COALESCE(ss.low_fit_database_accounts, 0),
    'total_leads', COALESCE(ls.total_leads, 0),
    'leads_with_email', COALESCE(ls.leads_with_email, 0),
    'leads_with_phone', COALESCE(ls.leads_with_phone, 0),
    'high_fit_leads_total', COALESCE(ls.high_fit_leads_total, 0),
    'medium_fit_leads_total', COALESCE(ls.medium_fit_leads_total, 0),
    'low_fit_leads_total', COALESCE(ls.low_fit_leads_total, 0),
    'campaign_ready_leads', COALESCE(cr.campaign_ready_leads, 0)
  ) INTO v_result
  FROM account_stats ast
  CROSS JOIN score_stats ss
  CROSS JOIN lead_stats ls
  CROSS JOIN campaign_ready cr;

  RETURN v_result;
END;
$$;
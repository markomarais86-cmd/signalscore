-- Fix score column reference from overall_fit_score to overall
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE (
  total_accounts bigint,
  total_leads bigint,
  campaign_ready_accounts bigint,
  high_fit_accounts bigint,
  scored_accounts bigint,
  accounts_with_contacts bigint,
  crm_accounts bigint,
  database_accounts bigint,
  crm_leads bigint,
  database_leads bigint,
  high_fit_crm_accounts bigint,
  high_fit_database_accounts bigint,
  high_fit_leads_total bigint,
  high_fit_crm_leads bigint,
  high_fit_database_leads bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH account_metrics AS (
    SELECT
      COUNT(*)::bigint AS total_accounts,
      COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both'))::bigint AS crm_accounts,
      COUNT(*) FILTER (WHERE a.data_source = 'database')::bigint AS database_accounts,
      COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM "Leads" l 
        WHERE l.account_external_id = a.external_id 
          AND l.org_id = a.org_id
      ) THEN a.external_id END)::bigint AS accounts_with_contacts
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  scored_metrics AS (
    SELECT
      COUNT(DISTINCT s.account_external_id)::bigint AS scored_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END)::bigint AS high_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN s.account_external_id END)::bigint AS high_fit_crm_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN s.account_external_id END)::bigint AS high_fit_database_accounts
    FROM scores s
    INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  lead_metrics AS (
    SELECT
      COUNT(*)::bigint AS total_leads,
      COUNT(*) FILTER (WHERE lead_source IN ('crm', 'both'))::bigint AS crm_leads,
      COUNT(*) FILTER (WHERE lead_source = 'database')::bigint AS database_leads,
      COUNT(*) FILTER (WHERE s.overall >= 70)::bigint AS high_fit_leads_total,
      COUNT(*) FILTER (WHERE s.overall >= 70 AND lead_source IN ('crm', 'both'))::bigint AS high_fit_crm_leads,
      COUNT(*) FILTER (WHERE s.overall >= 70 AND lead_source = 'database')::bigint AS high_fit_database_leads
    FROM "Leads" l
    LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    LEFT JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(l.data_source, a.data_source, 'crm') AS lead_source
    ) source_calc
    WHERE l.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND lead_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND lead_source = 'database')
      )
  ),
  campaign_accounts AS (
    SELECT COUNT(DISTINCT a.external_id)::bigint AS campaign_ready_accounts
    FROM accounts a
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND l.email IS NOT NULL
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown'
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  )
  SELECT
    am.total_accounts,
    lm.total_leads,
    ca.campaign_ready_accounts,
    sm.high_fit_accounts,
    sm.scored_accounts,
    am.accounts_with_contacts,
    am.crm_accounts,
    am.database_accounts,
    lm.crm_leads,
    lm.database_leads,
    sm.high_fit_crm_accounts,
    sm.high_fit_database_accounts,
    lm.high_fit_leads_total,
    lm.high_fit_crm_leads,
    lm.high_fit_database_leads
  FROM account_metrics am
  CROSS JOIN scored_metrics sm
  CROSS JOIN lead_metrics lm
  CROSS JOIN campaign_accounts ca;
END;
$$;
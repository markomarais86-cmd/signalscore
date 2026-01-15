-- Drop and recreate the get_dashboard_metrics_fast function to add medium/low fit leads
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts integer := 0;
  v_scored_accounts integer := 0;
  v_avg_score numeric := 0;
  v_high_fit_accounts integer := 0;
  v_medium_fit_accounts integer := 0;
  v_low_fit_accounts integer := 0;
  v_high_fit_crm_accounts integer := 0;
  v_high_fit_database_accounts integer := 0;
  v_medium_fit_crm_accounts integer := 0;
  v_medium_fit_database_accounts integer := 0;
  v_low_fit_crm_accounts integer := 0;
  v_low_fit_database_accounts integer := 0;
  v_total_leads integer := 0;
  v_high_fit_leads integer := 0;
  v_medium_fit_leads integer := 0;
  v_low_fit_leads integer := 0;
  v_high_fit_crm_leads integer := 0;
  v_high_fit_database_leads integer := 0;
  v_medium_fit_crm_leads integer := 0;
  v_medium_fit_database_leads integer := 0;
  v_low_fit_crm_leads integer := 0;
  v_low_fit_database_leads integer := 0;
  v_campaign_ready integer := 0;
  v_data_completeness numeric := 0;
BEGIN
  -- Get total and scored accounts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT account_external_id FROM scores WHERE org_id = p_org_id))
  INTO v_total_accounts, v_scored_accounts
  FROM accounts
  WHERE org_id = p_org_id;

  -- Get average score
  SELECT COALESCE(AVG(overall), 0)
  INTO v_avg_score
  FROM scores
  WHERE org_id = p_org_id;

  -- Get account fit breakdown by source
  SELECT 
    COUNT(*) FILTER (WHERE s.overall >= 70),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
    COUNT(*) FILTER (WHERE s.overall < 40),
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source = 'database')
  INTO 
    v_high_fit_accounts, v_medium_fit_accounts, v_low_fit_accounts,
    v_high_fit_crm_accounts, v_high_fit_database_accounts,
    v_medium_fit_crm_accounts, v_medium_fit_database_accounts,
    v_low_fit_crm_accounts, v_low_fit_database_accounts
  FROM scores s
  JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id;

  -- Get total leads
  SELECT COUNT(*)
  INTO v_total_leads
  FROM "Leads"
  WHERE org_id = p_org_id;

  -- Get high-fit leads breakdown by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_high_fit_leads, v_high_fit_crm_leads, v_high_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 70;

  -- Get medium-fit leads breakdown by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_medium_fit_leads, v_medium_fit_crm_leads, v_medium_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 40 AND s.overall < 70;

  -- Get low-fit leads breakdown by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_low_fit_leads, v_low_fit_crm_leads, v_low_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall < 40;

  -- Get campaign ready leads (leads with valid email on high-fit accounts)
  SELECT COUNT(*)
  INTO v_campaign_ready
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  WHERE l.org_id = p_org_id 
    AND s.overall >= 70 
    AND l.email IS NOT NULL 
    AND l.email != '';

  -- Calculate data completeness
  SELECT COALESCE(
    (
      (COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 0.25 +
      (COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 0.25 +
      (COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 0.25 +
      (COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 0.25
    ) * 100, 0
  )
  INTO v_data_completeness
  FROM accounts
  WHERE org_id = p_org_id;

  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'scored_accounts', v_scored_accounts,
    'avg_score', ROUND(v_avg_score, 1),
    'high_fit_accounts', v_high_fit_accounts,
    'medium_fit_accounts', v_medium_fit_accounts,
    'low_fit_accounts', v_low_fit_accounts,
    'high_fit_crm_accounts', v_high_fit_crm_accounts,
    'high_fit_database_accounts', v_high_fit_database_accounts,
    'medium_fit_crm_accounts', v_medium_fit_crm_accounts,
    'medium_fit_database_accounts', v_medium_fit_database_accounts,
    'low_fit_crm_accounts', v_low_fit_crm_accounts,
    'low_fit_database_accounts', v_low_fit_database_accounts,
    'total_leads', v_total_leads,
    'high_fit_leads', v_high_fit_leads,
    'medium_fit_leads', v_medium_fit_leads,
    'low_fit_leads', v_low_fit_leads,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'high_fit_database_leads', v_high_fit_database_leads,
    'medium_fit_crm_leads', v_medium_fit_crm_leads,
    'medium_fit_database_leads', v_medium_fit_database_leads,
    'low_fit_crm_leads', v_low_fit_crm_leads,
    'low_fit_database_leads', v_low_fit_database_leads,
    'campaign_ready', v_campaign_ready,
    'data_completeness', ROUND(v_data_completeness, 1)
  );
END;
$$;
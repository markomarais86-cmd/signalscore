-- Drop both function versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

-- Recreate with correct 2-parameter signature including medium/low fit leads
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid, 
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts bigint;
  v_scored_accounts bigint;
  v_high_fit_accounts bigint;
  v_medium_fit_accounts bigint;
  v_low_fit_accounts bigint;
  v_avg_score numeric;
  v_campaign_ready bigint;
  v_total_leads bigint;
  v_high_fit_leads bigint;
  v_medium_fit_leads bigint;
  v_low_fit_leads bigint;
  -- CRM breakdowns
  v_total_crm_accounts bigint;
  v_scored_crm_accounts bigint;
  v_high_fit_crm_accounts bigint;
  v_medium_fit_crm_accounts bigint;
  v_low_fit_crm_accounts bigint;
  v_total_crm_leads bigint;
  v_high_fit_crm_leads bigint;
  v_medium_fit_crm_leads bigint;
  v_low_fit_crm_leads bigint;
  -- Database breakdowns
  v_total_database_accounts bigint;
  v_scored_database_accounts bigint;
  v_high_fit_database_accounts bigint;
  v_medium_fit_database_accounts bigint;
  v_low_fit_database_accounts bigint;
  v_total_database_leads bigint;
  v_high_fit_database_leads bigint;
  v_medium_fit_database_leads bigint;
  v_low_fit_database_leads bigint;
BEGIN
  -- Total accounts by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE data_source = 'database')
  INTO v_total_accounts, v_total_crm_accounts, v_total_database_accounts
  FROM accounts
  WHERE org_id = p_org_id;

  -- Scored accounts by source with fit levels
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall >= 70),
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall < 40),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source = 'database'),
    COALESCE(AVG(s.overall), 0)
  INTO 
    v_scored_accounts, v_scored_crm_accounts, v_scored_database_accounts,
    v_high_fit_accounts, v_high_fit_crm_accounts, v_high_fit_database_accounts,
    v_medium_fit_accounts, v_medium_fit_crm_accounts, v_medium_fit_database_accounts,
    v_low_fit_accounts, v_low_fit_crm_accounts, v_low_fit_database_accounts,
    v_avg_score
  FROM scores s
  JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id;

  -- Campaign ready leads
  SELECT COUNT(*)
  INTO v_campaign_ready
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  WHERE l.org_id = p_org_id 
    AND s.overall >= 70 
    AND l.email IS NOT NULL;

  -- Total leads by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_total_leads, v_total_crm_leads, v_total_database_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id;

  -- High fit leads by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_high_fit_leads, v_high_fit_crm_leads, v_high_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 70;

  -- Medium fit leads by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_medium_fit_leads, v_medium_fit_crm_leads, v_medium_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 40 AND s.overall < 70;

  -- Low fit leads by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_low_fit_leads, v_low_fit_crm_leads, v_low_fit_database_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall < 40;

  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit_accounts,
    'medium_fit_accounts', v_medium_fit_accounts,
    'low_fit_accounts', v_low_fit_accounts,
    'avg_score', ROUND(v_avg_score, 1),
    'campaign_ready', v_campaign_ready,
    'total_leads', v_total_leads,
    'high_fit_leads', v_high_fit_leads,
    'medium_fit_leads', v_medium_fit_leads,
    'low_fit_leads', v_low_fit_leads,
    -- CRM breakdowns
    'total_crm_accounts', v_total_crm_accounts,
    'scored_crm_accounts', v_scored_crm_accounts,
    'high_fit_crm_accounts', v_high_fit_crm_accounts,
    'medium_fit_crm_accounts', v_medium_fit_crm_accounts,
    'low_fit_crm_accounts', v_low_fit_crm_accounts,
    'total_crm_leads', v_total_crm_leads,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'medium_fit_crm_leads', v_medium_fit_crm_leads,
    'low_fit_crm_leads', v_low_fit_crm_leads,
    -- Database breakdowns
    'total_database_accounts', v_total_database_accounts,
    'scored_database_accounts', v_scored_database_accounts,
    'high_fit_database_accounts', v_high_fit_database_accounts,
    'medium_fit_database_accounts', v_medium_fit_database_accounts,
    'low_fit_database_accounts', v_low_fit_database_accounts,
    'total_database_leads', v_total_database_leads,
    'high_fit_database_leads', v_high_fit_database_leads,
    'medium_fit_database_leads', v_medium_fit_database_leads,
    'low_fit_database_leads', v_low_fit_database_leads
  );
END;
$$;
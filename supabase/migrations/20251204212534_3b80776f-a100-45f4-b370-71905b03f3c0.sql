
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid, p_source_filter text DEFAULT 'all'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total_accounts integer;
  v_scored_accounts integer;
  v_high_fit integer;
  v_medium_fit integer;
  v_low_fit integer;
  v_total_leads integer;
  v_high_fit_leads integer;
  v_crm_accounts integer;
  v_database_accounts integer;
  v_both_accounts integer;
  v_crm_scored integer;
  v_database_scored integer;
  v_high_fit_crm integer;
  v_high_fit_database integer;
  v_medium_fit_crm integer;
  v_medium_fit_database integer;
  v_low_fit_crm integer;
  v_low_fit_database integer;
  v_crm_leads integer;
  v_database_leads integer;
  v_high_fit_crm_leads integer;
  v_high_fit_database_leads integer;
  v_campaign_ready_accounts integer;
  v_campaign_ready_leads integer;
  v_with_industry integer;
  v_with_size integer;
  v_with_revenue integer;
  v_with_geography integer;
  v_data_completeness numeric;
  v_apollo_accounts integer;
  v_apollo_contacts integer;
BEGIN
  -- Base account counts by source
  SELECT 
    COUNT(*) FILTER (WHERE data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE data_source = 'database'),
    COUNT(*) FILTER (WHERE data_source = 'both'),
    COUNT(*)
  INTO v_crm_accounts, v_database_accounts, v_both_accounts, v_total_accounts
  FROM accounts WHERE org_id = p_org_id;

  -- Apply source filter for main metrics
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(*) INTO v_total_accounts FROM accounts WHERE org_id = p_org_id AND data_source IN ('crm', 'both');
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*) INTO v_total_accounts FROM accounts WHERE org_id = p_org_id AND data_source = 'database';
  END IF;

  -- Scored accounts by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*)
  INTO v_crm_scored, v_database_scored, v_scored_accounts
  FROM scores s
  JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id;

  -- Fit distribution by source
  SELECT 
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source = 'database'),
    COUNT(*) FILTER (WHERE s.overall >= 70),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
    COUNT(*) FILTER (WHERE s.overall < 40)
  INTO v_high_fit_crm, v_high_fit_database, v_medium_fit_crm, v_medium_fit_database, 
       v_low_fit_crm, v_low_fit_database, v_high_fit, v_medium_fit, v_low_fit
  FROM scores s
  JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id;

  -- Total leads by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*)
  INTO v_crm_leads, v_database_leads, v_total_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id;

  -- High fit leads by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*)
  INTO v_high_fit_crm_leads, v_high_fit_database_leads, v_high_fit_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 70;

  -- Campaign ready accounts (high fit with campaign-ready leads)
  SELECT COUNT(DISTINCT a.external_id)
  INTO v_campaign_ready_accounts
  FROM accounts a
  JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND l.email IS NOT NULL AND l.email LIKE '%@%'
    AND l.title IS NOT NULL AND l.title != ''
    AND l.persona IS NOT NULL AND l.persona != 'Unknown';

  -- Campaign ready leads
  SELECT COUNT(*)
  INTO v_campaign_ready_leads
  FROM "Leads" l
  JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND l.email IS NOT NULL AND l.email LIKE '%@%'
    AND l.title IS NOT NULL AND l.title != ''
    AND l.persona IS NOT NULL AND l.persona != 'Unknown';

  -- Data completeness
  SELECT 
    COUNT(*) FILTER (WHERE industry_norm IS NOT NULL),
    COUNT(*) FILTER (WHERE employee_count IS NOT NULL),
    COUNT(*) FILTER (WHERE revenue_range IS NOT NULL),
    COUNT(*) FILTER (WHERE country IS NOT NULL)
  INTO v_with_industry, v_with_size, v_with_revenue, v_with_geography
  FROM accounts WHERE org_id = p_org_id;

  IF v_total_accounts > 0 THEN
    v_data_completeness := ROUND(((v_with_industry + v_with_size + v_with_revenue + v_with_geography)::numeric / (v_total_accounts * 4)) * 100, 1);
  ELSE
    v_data_completeness := 0;
  END IF;

  -- TAM data from external sources (Apollo)
  SELECT COALESCE(total_accounts, 0), COALESCE(total_contacts, 0)
  INTO v_apollo_accounts, v_apollo_contacts
  FROM external_data_sources
  WHERE org_id = p_org_id AND provider = 'apollo' AND is_active = true
  LIMIT 1;

  -- Build result
  v_result := jsonb_build_object(
    'total_accounts', v_total_accounts,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit,
    'medium_fit_accounts', v_medium_fit,
    'low_fit_accounts', v_low_fit,
    'total_leads', v_total_leads,
    'high_fit_leads', v_high_fit_leads,
    'crm_accounts', v_crm_accounts,
    'database_accounts', v_database_accounts,
    'both_accounts', v_both_accounts,
    'crm_scored_accounts', v_crm_scored,
    'database_scored_accounts', v_database_scored,
    'high_fit_crm_accounts', v_high_fit_crm,
    'high_fit_database_accounts', v_high_fit_database,
    'medium_fit_crm_accounts', v_medium_fit_crm,
    'medium_fit_database_accounts', v_medium_fit_database,
    'low_fit_crm_accounts', v_low_fit_crm,
    'low_fit_database_accounts', v_low_fit_database,
    'crm_leads', v_crm_leads,
    'database_leads', v_database_leads,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'high_fit_database_leads', v_high_fit_database_leads,
    'campaign_ready_accounts', v_campaign_ready_accounts,
    'campaign_ready_leads', v_campaign_ready_leads,
    'accounts_with_industry', v_with_industry,
    'accounts_with_size', v_with_size,
    'accounts_with_revenue', v_with_revenue,
    'accounts_with_geography', v_with_geography,
    'data_completeness', v_data_completeness,
    'apollo_accounts_available', COALESCE(v_apollo_accounts, 0),
    'apollo_contacts_available', COALESCE(v_apollo_contacts, 0)
  );

  RETURN v_result;
END;
$function$;

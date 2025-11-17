-- Fix source filtering in get_dashboard_metrics_fast function
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_icp_id uuid DEFAULT NULL,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts integer := 0;
  v_total_leads integer := 0;
  v_crm_accounts integer := 0;
  v_crm_leads integer := 0;
  v_database_accounts integer := 0;
  v_database_leads integer := 0;
  v_high_fit_accounts integer := 0;
  v_high_fit_leads integer := 0;
  v_campaign_ready_accounts integer := 0;
  v_campaign_ready_leads integer := 0;
  v_accounts_with_industry integer := 0;
  v_accounts_with_size integer := 0;
  v_accounts_with_revenue integer := 0;
  v_accounts_with_geography integer := 0;
  v_accounts_with_contacts integer := 0;
  v_overall_completeness numeric := 0;
  v_external_tam_accounts integer := 0;
  v_external_tam_contacts integer := 0;
  v_icp_profiles jsonb := '[]'::jsonb;
BEGIN
  -- Account counts with source filtering
  SELECT 
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both'))::integer,
    COUNT(*) FILTER (WHERE a.data_source = 'database' OR a.external_database_match = true)::integer
  INTO v_total_accounts, v_crm_accounts, v_database_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Lead counts with source filtering
  SELECT 
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))::integer,
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) = 'database' OR COALESCE(a.external_database_match, l.external_database_match, false) = true)::integer
  INTO v_total_leads, v_crm_leads, v_database_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = l.org_id
  WHERE l.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (COALESCE(a.data_source, l.data_source) = 'database' OR COALESCE(a.external_database_match, l.external_database_match, false) = true))
    );

  -- External TAM data (Apollo) - only include for 'all' or 'database' filters
  IF p_source_filter IN ('all', 'database') THEN
    SELECT 
      COALESCE(SUM(total_accounts), 0)::integer,
      COALESCE(SUM(total_contacts), 0)::integer
    INTO v_external_tam_accounts, v_external_tam_contacts
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true;
    
    -- Add Apollo data to database totals
    v_database_accounts := v_database_accounts + v_external_tam_accounts;
    v_database_leads := v_database_leads + v_external_tam_contacts;
    
    -- If 'all' filter, add to total as well
    IF p_source_filter = 'all' THEN
      v_total_accounts := v_total_accounts + v_external_tam_accounts;
      v_total_leads := v_total_leads + v_external_tam_contacts;
    END IF;
  END IF;

  -- High fit accounts with source filtering
  SELECT COUNT(DISTINCT s.account_external_id)::integer
  INTO v_high_fit_accounts
  FROM scores s
  INNER JOIN accounts a ON s.account_external_id = a.external_id AND a.org_id = s.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id)
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- High fit leads with source filtering
  SELECT COUNT(DISTINCT l.id)::integer
  INTO v_high_fit_leads
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = l.org_id
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id)
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Campaign ready counts with source filtering
  SELECT 
    COUNT(DISTINCT a.external_id)::integer,
    COUNT(DISTINCT l.id)::integer
  INTO v_campaign_ready_accounts, v_campaign_ready_leads
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = l.org_id
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona)
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id)
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Data completeness with source filtering
  SELECT 
    COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::integer,
    COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::integer,
    COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::integer,
    COUNT(*) FILTER (WHERE country IS NOT NULL)::integer
  INTO v_accounts_with_industry, v_accounts_with_size, v_accounts_with_revenue, v_accounts_with_geography
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Accounts with contacts
  SELECT COUNT(DISTINCT account_external_id)::integer
  INTO v_accounts_with_contacts
  FROM contacts c
  INNER JOIN accounts a ON c.account_external_id = a.external_id AND a.org_id = c.org_id
  WHERE c.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Calculate overall completeness
  IF v_total_accounts > 0 THEN
    v_overall_completeness := (
      (v_accounts_with_industry::numeric + v_accounts_with_size + v_accounts_with_revenue + v_accounts_with_geography) / 
      NULLIF(v_total_accounts * 4, 0)
    ) * 100;
  END IF;

  -- Get ICP profiles
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'status', status,
      'match_count', match_count
    ) ORDER BY is_primary DESC, name
  ), '[]'::jsonb)
  INTO v_icp_profiles
  FROM icp_profiles
  WHERE org_id = p_org_id AND status = 'active';

  -- Return all metrics
  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'total_leads', v_total_leads,
    'crm_accounts', v_crm_accounts,
    'crm_leads', v_crm_leads,
    'database_accounts', v_database_accounts,
    'database_leads', v_database_leads,
    'external_tam_accounts', v_external_tam_accounts,
    'external_tam_contacts', v_external_tam_contacts,
    'high_fit_accounts', v_high_fit_accounts,
    'high_fit_leads', v_high_fit_leads,
    'campaign_ready_accounts', v_campaign_ready_accounts,
    'campaign_ready_leads', v_campaign_ready_leads,
    'accounts_with_industry', v_accounts_with_industry,
    'accounts_with_size', v_accounts_with_size,
    'accounts_with_revenue', v_accounts_with_revenue,
    'accounts_with_geography', v_accounts_with_geography,
    'accounts_with_contacts', v_accounts_with_contacts,
    'overall_completeness', ROUND(v_overall_completeness, 1),
    'icp_profiles', v_icp_profiles
  );
END;
$$;
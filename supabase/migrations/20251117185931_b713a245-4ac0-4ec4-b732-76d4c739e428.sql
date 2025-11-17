-- Drop and recreate function with Apollo/external data included
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
  v_total_accounts bigint := 0;
  v_crm_accounts bigint := 0;
  v_database_accounts bigint := 0;
  v_both_accounts bigint := 0;
  v_total_leads bigint := 0;
  v_crm_leads bigint := 0;
  v_database_leads bigint := 0;
  v_linked_leads bigint := 0;
  v_scored_accounts bigint := 0;
  v_high_fit bigint := 0;
  v_medium_fit bigint := 0;
  v_low_fit bigint := 0;
  v_high_fit_crm bigint := 0;
  v_high_fit_database bigint := 0;
  v_high_fit_leads_total bigint := 0;
  v_high_fit_crm_leads bigint := 0;
  v_high_fit_database_leads bigint := 0;
  v_campaign_ready_accounts bigint := 0;
  v_campaign_ready_contacts bigint := 0;
  v_campaign_ready_leads bigint := 0;
  v_accounts_with_contacts bigint := 0;
  v_accounts_with_industry bigint := 0;
  v_accounts_with_geography bigint := 0;
  v_accounts_with_size bigint := 0;
  v_accounts_with_revenue bigint := 0;
  v_data_completeness numeric := 0;
  v_external_tam_accounts bigint := 0;
  v_external_tam_contacts bigint := 0;
BEGIN
  -- Get external TAM data (Apollo, ZoomInfo, etc.)
  SELECT 
    COALESCE(SUM(total_accounts), 0),
    COALESCE(SUM(total_contacts), 0)
  INTO v_external_tam_accounts, v_external_tam_contacts
  FROM external_data_sources
  WHERE org_id = p_org_id
    AND is_active = true;

  -- Get account counts by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source = 'crm'),
    COUNT(*) FILTER (WHERE a.data_source = 'database' OR a.external_database_match = true),
    COUNT(*) FILTER (WHERE a.data_source = 'crm' AND a.external_database_match = true)
  INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id;

  -- Get lead/contact counts by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE l.data_source = 'crm'),
    COUNT(*) FILTER (WHERE l.data_source = 'database' OR l.external_database_match = true),
    COUNT(*) FILTER (WHERE l.account_external_id IS NOT NULL)
  INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads
  FROM "Leads" l
  WHERE l.org_id = p_org_id;

  -- Add external TAM to database totals
  v_database_accounts := v_database_accounts + v_external_tam_accounts;
  v_database_leads := v_database_leads + v_external_tam_contacts;
  v_total_accounts := v_total_accounts + v_external_tam_accounts;
  v_total_leads := v_total_leads + v_external_tam_contacts;

  -- Get scored account counts with fit distribution using numeric ranges
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE s.overall >= 70),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
    COUNT(*) FILTER (WHERE s.overall < 40)
  INTO v_scored_accounts, v_high_fit, v_medium_fit, v_low_fit
  FROM scores s
  WHERE s.org_id = p_org_id
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);

  -- Get high fit accounts by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source = 'crm'),
    COUNT(*) FILTER (WHERE a.data_source = 'database' OR a.external_database_match = true)
  INTO v_high_fit_crm, v_high_fit_database
  FROM accounts a
  JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);

  -- Get high fit leads by source
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE l.data_source = 'crm'),
    COUNT(*) FILTER (WHERE l.data_source = 'database' OR l.external_database_match = true)
  INTO v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_database_leads
  FROM "Leads" l
  JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);

  -- Get campaign ready counts
  SELECT 
    COUNT(DISTINCT a.external_id),
    COUNT(*),
    COUNT(*)
  INTO v_campaign_ready_accounts, v_campaign_ready_contacts, v_campaign_ready_leads
  FROM "Leads" l
  JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND l.export_eligible = true
    AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);

  -- Get data completeness metrics
  SELECT
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM "Leads" l2 WHERE l2.account_external_id = a.external_id AND l2.org_id = a.org_id
    )),
    COUNT(*) FILTER (WHERE a.industry_norm IS NOT NULL),
    COUNT(*) FILTER (WHERE a.country IS NOT NULL),
    COUNT(*) FILTER (WHERE a.employee_count IS NOT NULL),
    COUNT(*) FILTER (WHERE a.revenue_range IS NOT NULL)
  INTO v_accounts_with_contacts, v_accounts_with_industry, v_accounts_with_geography, v_accounts_with_size, v_accounts_with_revenue
  FROM accounts a
  WHERE a.org_id = p_org_id;

  -- Calculate overall data completeness
  IF v_total_accounts > 0 THEN
    v_data_completeness := (
      (v_accounts_with_contacts::numeric + 
       v_accounts_with_industry::numeric + 
       v_accounts_with_geography::numeric + 
       v_accounts_with_size::numeric + 
       v_accounts_with_revenue::numeric) / 
      (v_total_accounts * 5)
    ) * 100;
  END IF;

  -- Return all metrics as JSON
  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'crm_accounts', v_crm_accounts,
    'database_accounts', v_database_accounts,
    'both_accounts', v_both_accounts,
    'total_leads', v_total_leads,
    'crm_leads', v_crm_leads,
    'database_leads', v_database_leads,
    'linked_leads', v_linked_leads,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit,
    'medium_fit_accounts', v_medium_fit,
    'low_fit_accounts', v_low_fit,
    'high_fit_crm_accounts', v_high_fit_crm,
    'high_fit_database_accounts', v_high_fit_database,
    'high_fit_leads_total', v_high_fit_leads_total,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'high_fit_database_leads', v_high_fit_database_leads,
    'campaign_ready_accounts', v_campaign_ready_accounts,
    'campaign_ready_contacts', v_campaign_ready_contacts,
    'campaign_ready_leads', v_campaign_ready_leads,
    'accounts_with_contacts', v_accounts_with_contacts,
    'accounts_with_industry', v_accounts_with_industry,
    'accounts_with_geography', v_accounts_with_geography,
    'accounts_with_size', v_accounts_with_size,
    'accounts_with_revenue', v_accounts_with_revenue,
    'data_completeness', v_data_completeness,
    'external_tam_accounts', v_external_tam_accounts,
    'external_tam_contacts', v_external_tam_contacts
  );
END;
$$;
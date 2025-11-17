-- Drop the broken function
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);

-- Create corrected function with proper column references and numeric score ranges
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
  v_total_contacts bigint := 0;
  v_scored_accounts bigint := 0;
  v_high_fit bigint := 0;
  v_medium_fit bigint := 0;
  v_low_fit bigint := 0;
  v_campaign_ready bigint := 0;
  v_accounts_with_contacts bigint := 0;
  v_accounts_with_industry bigint := 0;
  v_accounts_with_geography bigint := 0;
  v_accounts_with_size bigint := 0;
  v_accounts_with_revenue bigint := 0;
  v_external_tam bigint := 0;
BEGIN
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

  -- Get total accounts based on source filter
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(*) INTO v_total_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.data_source = 'crm';
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*) INTO v_total_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND (a.data_source = 'database' OR a.external_database_match = true);
  ELSE
    SELECT COUNT(*) INTO v_total_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id;
  END IF;

  -- Get total contacts based on source filter
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(*) INTO v_total_contacts
    FROM "Leads" l
    WHERE l.org_id = p_org_id
      AND l.data_source = 'crm';
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*) INTO v_total_contacts
    FROM "Leads" l
    WHERE l.org_id = p_org_id
      AND (l.data_source = 'database' OR l.external_database_match = true);
  ELSE
    SELECT COUNT(*) INTO v_total_contacts
    FROM "Leads" l
    WHERE l.org_id = p_org_id;
  END IF;

  -- Get campaign ready contacts
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(*) INTO v_campaign_ready
    FROM "Leads" l
    JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.export_eligible = true
      AND l.data_source = 'crm'
      AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*) INTO v_campaign_ready
    FROM "Leads" l
    JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.export_eligible = true
      AND (l.data_source = 'database' OR l.external_database_match = true)
      AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);
  ELSE
    SELECT COUNT(*) INTO v_campaign_ready
    FROM "Leads" l
    JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.export_eligible = true
      AND (p_icp_id IS NULL OR s.icp_id = p_icp_id);
  END IF;

  -- Get data completeness metrics
  IF p_source_filter = 'crm' THEN
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
    WHERE a.org_id = p_org_id
      AND a.data_source = 'crm';
  ELSIF p_source_filter = 'database' THEN
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
    WHERE a.org_id = p_org_id
      AND (a.data_source = 'database' OR a.external_database_match = true);
  ELSE
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
  END IF;

  -- Get external TAM (only for 'database' and 'all' filters)
  IF p_source_filter IN ('database', 'all') THEN
    SELECT COALESCE(SUM(total_accounts), 0) INTO v_external_tam
    FROM external_data_sources
    WHERE org_id = p_org_id
      AND is_active = true;
  END IF;

  -- Return all metrics as JSON
  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'total_contacts', v_total_contacts,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit,
    'medium_fit_accounts', v_medium_fit,
    'low_fit_accounts', v_low_fit,
    'campaign_ready_contacts', v_campaign_ready,
    'accounts_with_contacts', v_accounts_with_contacts,
    'accounts_with_industry', v_accounts_with_industry,
    'accounts_with_geography', v_accounts_with_geography,
    'accounts_with_size', v_accounts_with_size,
    'accounts_with_revenue', v_accounts_with_revenue,
    'external_tam', v_external_tam
  );
END;
$$;
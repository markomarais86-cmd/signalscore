-- Drop both conflicting overloaded functions
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

-- Create unified function with both optional parameters
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_icp_id uuid DEFAULT NULL,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total_accounts integer;
  v_high_fit_accounts integer;
  v_campaign_ready_accounts integer;
  v_total_contacts integer;
  v_campaign_ready_contacts integer;
  v_data_completeness numeric;
BEGIN
  -- Priority 1: ICP-specific filtering
  IF p_icp_id IS NOT NULL THEN
    SELECT 
      COUNT(DISTINCT a.external_id),
      COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END),
      COUNT(DISTINCT CASE WHEN s.overall >= 70 AND EXISTS (
        SELECT 1 FROM "Leads" l 
        WHERE l.account_external_id = a.external_id 
        AND l.org_id = a.org_id
        AND is_lead_campaign_ready(l.email, l.title, l.persona)
      ) THEN a.external_id END)
    INTO v_total_accounts, v_high_fit_accounts, v_campaign_ready_accounts
    FROM accounts a
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE a.org_id = p_org_id
      AND s.icp_id = p_icp_id;

    SELECT COUNT(*) INTO v_total_contacts
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.icp_id = p_icp_id;

    SELECT COUNT(*) INTO v_campaign_ready_contacts
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.icp_id = p_icp_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona);

  -- Priority 2: Source filtering (crm/database)
  ELSIF p_source_filter IN ('crm', 'database') THEN
    IF p_source_filter = 'crm' THEN
      SELECT 
        COUNT(DISTINCT a.external_id),
        COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END),
        COUNT(DISTINCT CASE WHEN s.overall >= 70 AND EXISTS (
          SELECT 1 FROM "Leads" l 
          WHERE l.account_external_id = a.external_id 
          AND l.org_id = a.org_id
          AND is_lead_campaign_ready(l.email, l.title, l.persona)
        ) THEN a.external_id END)
      INTO v_total_accounts, v_high_fit_accounts, v_campaign_ready_accounts
      FROM accounts a
      INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
      WHERE a.org_id = p_org_id
        AND a.data_source IN ('crm', 'both');
    ELSE
      SELECT 
        COUNT(DISTINCT a.external_id),
        COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END),
        COUNT(DISTINCT CASE WHEN s.overall >= 70 AND EXISTS (
          SELECT 1 FROM "Leads" l 
          WHERE l.account_external_id = a.external_id 
          AND l.org_id = a.org_id
          AND is_lead_campaign_ready(l.email, l.title, l.persona)
        ) THEN a.external_id END)
      INTO v_total_accounts, v_high_fit_accounts, v_campaign_ready_accounts
      FROM accounts a
      INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
      WHERE a.org_id = p_org_id
        AND a.data_source = 'database';
    END IF;

    SELECT COUNT(*) INTO v_total_contacts
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND (
        (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
        (p_source_filter = 'database' AND a.data_source = 'database')
      );

    SELECT COUNT(*) INTO v_campaign_ready_contacts
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona)
      AND (
        (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
        (p_source_filter = 'database' AND a.data_source = 'database')
      );

  -- Priority 3: Use materialized view for 'all' sources (fastest)
  ELSE
    SELECT 
      total_accounts,
      high_fit_accounts
    INTO v_total_accounts, v_high_fit_accounts
    FROM mv_score_distribution
    WHERE org_id = p_org_id
    LIMIT 1;

    v_campaign_ready_accounts := count_campaign_ready_accounts(p_org_id);
    v_total_contacts := (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id);
    v_campaign_ready_contacts := count_campaign_ready_leads(p_org_id);
  END IF;

  -- Calculate data completeness
  SELECT 
    ROUND(
      (COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric +
       COUNT(*) FILTER (WHERE employee_count IS NOT NULL) +
       COUNT(*) FILTER (WHERE revenue_range IS NOT NULL) +
       COUNT(*) FILTER (WHERE country IS NOT NULL)) /
      NULLIF(COUNT(*) * 4, 0) * 100, 1
    )
  INTO v_data_completeness
  FROM accounts
  WHERE org_id = p_org_id;

  v_result := jsonb_build_object(
    'totalAccounts', COALESCE(v_total_accounts, 0),
    'highFitAccounts', COALESCE(v_high_fit_accounts, 0),
    'campaignReadyAccounts', COALESCE(v_campaign_ready_accounts, 0),
    'totalContacts', COALESCE(v_total_contacts, 0),
    'campaignReadyContacts', COALESCE(v_campaign_ready_contacts, 0),
    'dataCompleteness', COALESCE(v_data_completeness, 0)
  );

  RETURN v_result;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_fast(uuid, uuid, text) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.get_dashboard_metrics_fast(uuid, uuid, text) IS 
'Unified dashboard metrics function supporting ICP filtering and source filtering. 
Priority: ICP filter > source filter > all (materialized view).';
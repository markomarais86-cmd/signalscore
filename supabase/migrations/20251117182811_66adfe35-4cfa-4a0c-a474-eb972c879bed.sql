-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);

-- Recreate the function with correct column references
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_total_accounts bigint;
  v_total_leads bigint;
  v_crm_accounts bigint;
  v_crm_leads bigint;
  v_database_accounts bigint;
  v_database_leads bigint;
  v_external_accounts bigint;
  v_external_contacts bigint;
  v_scored_accounts bigint;
  v_high_fit bigint;
  v_medium_fit bigint;
  v_low_fit bigint;
  v_campaign_ready bigint;
BEGIN
  -- Get total accounts by source
  SELECT 
    COUNT(*) FILTER (WHERE data_source = 'crm'),
    COUNT(*) FILTER (WHERE data_source = 'database'),
    COUNT(*)
  INTO v_crm_accounts, v_database_accounts, v_total_accounts
  FROM accounts
  WHERE org_id = p_org_id;

  -- Get total leads by source
  SELECT 
    COUNT(*) FILTER (WHERE data_source = 'crm'),
    COUNT(*) FILTER (WHERE data_source = 'database'),
    COUNT(*)
  INTO v_crm_leads, v_database_leads, v_total_leads
  FROM "Leads"
  WHERE org_id = p_org_id;

  -- Get external data source totals
  SELECT 
    COALESCE(SUM(total_accounts), 0),
    COALESCE(SUM(total_contacts), 0)
  INTO v_external_accounts, v_external_contacts
  FROM external_data_sources
  WHERE org_id = p_org_id AND is_active = true;

  -- Get scored accounts and fit distribution
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE s.overall = 'High Fit'),
    COUNT(*) FILTER (WHERE s.overall = 'Medium Fit'),
    COUNT(*) FILTER (WHERE s.overall = 'Low Fit')
  INTO v_scored_accounts, v_high_fit, v_medium_fit, v_low_fit
  FROM scores s
  WHERE s.org_id = p_org_id;

  -- Get campaign ready accounts (leads with export_eligible = true)
  SELECT COUNT(DISTINCT l.account_external_id)
  INTO v_campaign_ready
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id 
    AND l.export_eligible = true
    AND a.id IS NOT NULL;

  -- Build result JSON
  v_result := jsonb_build_object(
    'total_accounts', v_total_accounts + v_external_accounts,
    'total_leads', v_total_leads + v_external_contacts,
    'crm_accounts', v_crm_accounts,
    'crm_leads', v_crm_leads,
    'database_accounts', v_database_accounts + v_external_accounts,
    'database_leads', v_database_leads + v_external_contacts,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit,
    'medium_fit_accounts', v_medium_fit,
    'low_fit_accounts', v_low_fit,
    'campaign_ready_accounts', v_campaign_ready
  );

  RETURN v_result;
END;
$$;
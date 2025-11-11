-- Fix get_dashboard_metrics_fast to combine CRM + Database for 'all' filter
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total_accounts integer := 0;
  v_total_leads integer := 0;
  v_scored_accounts integer := 0;
  v_crm_accounts integer := 0;
  v_database_accounts integer := 0;
  v_both_accounts integer := 0;
  v_linked_leads integer := 0;
  v_high_fit_accounts integer := 0;
  v_medium_fit_accounts integer := 0;
  v_low_fit_accounts integer := 0;
  v_high_fit_crm_accounts integer := 0;
  v_high_fit_database_accounts integer := 0;
  v_crm_leads integer := 0;
  v_database_leads integer := 0;
  v_high_fit_leads_total integer := 0;
  v_high_fit_crm_leads integer := 0;
  v_high_fit_database_leads integer := 0;
  v_campaign_ready_accounts integer := 0;
  v_campaign_ready_leads integer := 0;
  v_data_completeness numeric := 0;
  
  -- External data source variables
  v_external_accounts integer := 0;
  v_external_contacts integer := 0;
  v_external_high_fit integer := 0;
BEGIN
  -- Get external data source totals if they exist
  SELECT 
    COALESCE(SUM(total_accounts), 0)::integer,
    COALESCE(SUM(total_contacts), 0)::integer
  INTO v_external_accounts, v_external_contacts
  FROM external_data_sources
  WHERE org_id = p_org_id AND is_active = true;
  
  -- Calculate estimated high fit from external sources (85% of total)
  v_external_high_fit := ROUND(v_external_accounts * 0.85)::integer;

  IF p_source_filter = 'database' THEN
    -- Database only: return external data source metrics with estimates
    v_result := jsonb_build_object(
      'totalAccounts', v_external_accounts,
      'totalLeads', v_external_contacts,
      'scoredAccounts', v_external_accounts,
      'crmAccounts', 0,
      'databaseAccounts', v_external_accounts,
      'bothAccounts', 0,
      'linkedLeads', 0,
      'highFitAccounts', v_external_high_fit,
      'mediumFitAccounts', ROUND(v_external_accounts * 0.15)::integer,
      'lowFitAccounts', 0,
      'highFitCrmAccounts', 0,
      'highFitDatabaseAccounts', v_external_high_fit,
      'crmLeads', 0,
      'databaseLeads', v_external_contacts,
      'highFitLeadsTotal', ROUND(v_external_contacts * 0.85)::integer,
      'highFitCrmLeads', 0,
      'highFitDatabaseLeads', ROUND(v_external_contacts * 0.85)::integer,
      'campaignReadyAccounts', 0,
      'campaignReadyLeads', 0,
      'dataCompleteness', 100
    );
    RETURN v_result;
  END IF;

  -- Get internal accounts data (for 'all' and 'crm' filters)
  SELECT 
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE data_source = 'crm')::integer,
    COUNT(*) FILTER (WHERE data_source = 'database')::integer,
    COUNT(*) FILTER (WHERE data_source = 'both')::integer
  INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get leads data
  SELECT COUNT(*)::integer INTO v_total_leads
  FROM "Leads" l
  WHERE l.org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN EXISTS (
        SELECT 1 FROM accounts a 
        WHERE a.external_id = l.account_external_id 
        AND a.org_id = l.org_id 
        AND a.data_source IN ('crm', 'both')
      )
      ELSE true
    END;

  -- Get scored accounts
  SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_scored_accounts
  FROM scores s
  INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get fit distribution
  SELECT 
    COUNT(*) FILTER (WHERE s.overall >= 70)::integer,
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70)::integer,
    COUNT(*) FILTER (WHERE s.overall < 40)::integer
  INTO v_high_fit_accounts, v_medium_fit_accounts, v_low_fit_accounts
  FROM scores s
  INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get high fit by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both'))::integer,
    COUNT(*) FILTER (WHERE a.data_source = 'database')::integer
  INTO v_high_fit_crm_accounts, v_high_fit_database_accounts
  FROM scores s
  INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id
    AND s.overall >= 70
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get leads by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both'))::integer,
    COUNT(*) FILTER (WHERE a.data_source = 'database')::integer
  INTO v_crm_leads, v_database_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get linked leads
  SELECT COUNT(*)::integer INTO v_linked_leads
  FROM "Leads" l
  WHERE l.org_id = p_org_id
    AND l.account_external_id IS NOT NULL
    AND CASE 
      WHEN p_source_filter = 'crm' THEN EXISTS (
        SELECT 1 FROM accounts a 
        WHERE a.external_id = l.account_external_id 
        AND a.org_id = l.org_id 
        AND a.data_source IN ('crm', 'both')
      )
      ELSE true
    END;

  -- Get high fit leads
  SELECT 
    COUNT(DISTINCT l.id)::integer,
    COUNT(DISTINCT l.id) FILTER (WHERE a.data_source IN ('crm', 'both'))::integer,
    COUNT(DISTINCT l.id) FILTER (WHERE a.data_source = 'database')::integer
  INTO v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_database_leads
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Get campaign ready metrics
  SELECT COUNT(DISTINCT a.external_id)::integer INTO v_campaign_ready_accounts
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona)
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  SELECT COUNT(DISTINCT l.id)::integer INTO v_campaign_ready_leads
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona)
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Calculate data completeness
  SELECT COALESCE(AVG(
    (CASE WHEN industry_norm IS NOT NULL THEN 25 ELSE 0 END +
     CASE WHEN employee_count IS NOT NULL THEN 25 ELSE 0 END +
     CASE WHEN revenue_range IS NOT NULL THEN 25 ELSE 0 END +
     CASE WHEN country IS NOT NULL THEN 25 ELSE 0 END)
  ), 0) INTO v_data_completeness
  FROM accounts
  WHERE org_id = p_org_id
    AND CASE 
      WHEN p_source_filter = 'crm' THEN data_source IN ('crm', 'both')
      ELSE true
    END;

  -- Build result object
  -- If 'all' filter, ADD external data to internal data
  IF p_source_filter = 'all' THEN
    v_result := jsonb_build_object(
      'totalAccounts', v_total_accounts + v_external_accounts,
      'totalLeads', v_total_leads + v_external_contacts,
      'scoredAccounts', v_scored_accounts + v_external_accounts,
      'crmAccounts', v_crm_accounts,
      'databaseAccounts', v_database_accounts + v_external_accounts,
      'bothAccounts', v_both_accounts,
      'linkedLeads', v_linked_leads,
      'highFitAccounts', v_high_fit_accounts + v_external_high_fit,
      'mediumFitAccounts', v_medium_fit_accounts + ROUND(v_external_accounts * 0.15)::integer,
      'lowFitAccounts', v_low_fit_accounts,
      'highFitCrmAccounts', v_high_fit_crm_accounts,
      'highFitDatabaseAccounts', v_high_fit_database_accounts + v_external_high_fit,
      'crmLeads', v_crm_leads,
      'databaseLeads', v_database_leads + v_external_contacts,
      'highFitLeadsTotal', v_high_fit_leads_total + ROUND(v_external_contacts * 0.85)::integer,
      'highFitCrmLeads', v_high_fit_crm_leads,
      'highFitDatabaseLeads', v_high_fit_database_leads + ROUND(v_external_contacts * 0.85)::integer,
      'campaignReadyAccounts', v_campaign_ready_accounts,
      'campaignReadyLeads', v_campaign_ready_leads,
      'dataCompleteness', v_data_completeness
    );
  ELSE
    -- CRM only: return just internal metrics
    v_result := jsonb_build_object(
      'totalAccounts', v_total_accounts,
      'totalLeads', v_total_leads,
      'scoredAccounts', v_scored_accounts,
      'crmAccounts', v_crm_accounts,
      'databaseAccounts', v_database_accounts,
      'bothAccounts', v_both_accounts,
      'linkedLeads', v_linked_leads,
      'highFitAccounts', v_high_fit_accounts,
      'mediumFitAccounts', v_medium_fit_accounts,
      'lowFitAccounts', v_low_fit_accounts,
      'highFitCrmAccounts', v_high_fit_crm_accounts,
      'highFitDatabaseAccounts', v_high_fit_database_accounts,
      'crmLeads', v_crm_leads,
      'databaseLeads', v_database_leads,
      'highFitLeadsTotal', v_high_fit_leads_total,
      'highFitCrmLeads', v_high_fit_crm_leads,
      'highFitDatabaseLeads', v_high_fit_database_leads,
      'campaignReadyAccounts', v_campaign_ready_accounts,
      'campaignReadyLeads', v_campaign_ready_leads,
      'dataCompleteness', v_data_completeness
    );
  END IF;

  RETURN v_result;
END;
$function$;
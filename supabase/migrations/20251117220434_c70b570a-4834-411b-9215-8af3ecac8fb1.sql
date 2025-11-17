-- Fix get_dashboard_metrics_fast to separate Apollo metadata from actual account totals
-- This migration removes Apollo counts from total_accounts and shows them separately

DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);

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
  v_total_accounts integer := 0;
  v_crm_accounts integer := 0;
  v_database_accounts integer := 0;
  v_scored_accounts integer := 0;
  v_high_fit_accounts integer := 0;
  v_high_fit_crm integer := 0;
  v_high_fit_database integer := 0;
  v_campaign_ready integer := 0;
  v_total_leads integer := 0;
  v_crm_leads integer := 0;
  v_database_leads integer := 0;
  v_high_fit_leads integer := 0;
  v_apollo_total integer := 0;
  v_apollo_contacts integer := 0;
  v_apollo_provider text := NULL;
  v_result jsonb;
BEGIN
  -- Get Apollo/external data (metadata only - NOT included in totals)
  SELECT 
    COALESCE(total_accounts, 0),
    COALESCE(total_contacts, 0),
    provider
  INTO v_apollo_total, v_apollo_contacts, v_apollo_provider
  FROM public.external_data_sources
  WHERE org_id = p_org_id 
    AND is_active = true
    AND provider = 'apollo'
  LIMIT 1;

  -- Calculate actual account metrics based on source filter
  IF p_source_filter = 'crm' THEN
    -- CRM only: accounts with data_source='crm' or 'both'
    SELECT COUNT(DISTINCT a.external_id)
    INTO v_total_accounts
    FROM public.accounts a
    WHERE a.org_id = p_org_id
      AND a.data_source IN ('crm', 'both');
    
    v_crm_accounts := v_total_accounts;
    v_database_accounts := 0;

  ELSIF p_source_filter = 'database' THEN
    -- Database only: accounts with data_source='database' (excluding Apollo metadata)
    SELECT COUNT(DISTINCT a.external_id)
    INTO v_total_accounts
    FROM public.accounts a
    WHERE a.org_id = p_org_id
      AND a.data_source = 'database';
    
    v_database_accounts := v_total_accounts;
    v_crm_accounts := 0;

  ELSE
    -- All sources: all actual accounts (CRM + database, NOT Apollo metadata)
    SELECT 
      COUNT(DISTINCT a.external_id),
      COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN a.external_id END),
      COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN a.external_id END)
    INTO v_total_accounts, v_crm_accounts, v_database_accounts
    FROM public.accounts a
    WHERE a.org_id = p_org_id;
  END IF;

  -- Scored accounts (only actual records, filtered by source)
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT s.account_external_id)
    INTO v_scored_accounts
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND a.data_source IN ('crm', 'both');

  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT s.account_external_id)
    INTO v_scored_accounts
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND a.data_source = 'database';

  ELSE
    SELECT COUNT(DISTINCT account_external_id)
    INTO v_scored_accounts
    FROM public.scores
    WHERE org_id = p_org_id;
  END IF;

  -- High fit accounts (score >= 70, filtered by source)
  IF p_source_filter = 'crm' THEN
    SELECT 
      COUNT(DISTINCT s.account_external_id),
      COUNT(DISTINCT s.account_external_id)
    INTO v_high_fit_accounts, v_high_fit_crm
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');
    
    v_high_fit_database := 0;

  ELSIF p_source_filter = 'database' THEN
    SELECT 
      COUNT(DISTINCT s.account_external_id),
      COUNT(DISTINCT s.account_external_id)
    INTO v_high_fit_accounts, v_high_fit_database
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source = 'database';
    
    v_high_fit_crm := 0;

  ELSE
    SELECT 
      COUNT(DISTINCT s.account_external_id),
      COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN s.account_external_id END),
      COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN s.account_external_id END)
    INTO v_high_fit_accounts, v_high_fit_crm, v_high_fit_database
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND s.overall >= 70;
  END IF;

  -- Campaign ready accounts and leads (actual records only)
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT l.account_external_id)
    INTO v_campaign_ready
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.email IS NOT NULL
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown'
      AND a.data_source IN ('crm', 'both');

  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT l.account_external_id)
    INTO v_campaign_ready
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND l.email IS NOT NULL
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown'
      AND a.data_source = 'database';

  ELSE
    SELECT COUNT(DISTINCT l.account_external_id)
    INTO v_campaign_ready
    FROM public."Leads" l
    WHERE l.org_id = p_org_id
      AND l.email IS NOT NULL
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
  END IF;

  -- Total leads by source
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(*)
    INTO v_total_leads
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND a.data_source IN ('crm', 'both');
    
    v_crm_leads := v_total_leads;
    v_database_leads := 0;

  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*)
    INTO v_total_leads
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND a.data_source = 'database';
    
    v_database_leads := v_total_leads;
    v_crm_leads := 0;

  ELSE
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
      COUNT(*) FILTER (WHERE a.data_source = 'database')
    INTO v_total_leads, v_crm_leads, v_database_leads
    FROM public."Leads" l
    LEFT JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id;
  END IF;

  -- High fit leads
  IF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT l.id)
    INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');

  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT l.id)
    INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source = 'database';

  ELSE
    SELECT COUNT(DISTINCT l.id)
    INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70;
  END IF;

  -- Build result JSON with Apollo shown separately
  v_result := jsonb_build_object(
    'total_accounts', COALESCE(v_total_accounts, 0),
    'crm_accounts', COALESCE(v_crm_accounts, 0),
    'database_accounts', COALESCE(v_database_accounts, 0),
    'scored_accounts', COALESCE(v_scored_accounts, 0),
    'high_fit_accounts', COALESCE(v_high_fit_accounts, 0),
    'high_fit_crm_accounts', COALESCE(v_high_fit_crm, 0),
    'high_fit_database_accounts', COALESCE(v_high_fit_database, 0),
    'campaign_ready_accounts', COALESCE(v_campaign_ready, 0),
    'total_leads', COALESCE(v_total_leads, 0),
    'crm_leads', COALESCE(v_crm_leads, 0),
    'database_leads', COALESCE(v_database_leads, 0),
    'high_fit_leads', COALESCE(v_high_fit_leads, 0),
    'apollo_accounts_available', COALESCE(v_apollo_total, 0),
    'apollo_contacts_available', COALESCE(v_apollo_contacts, 0),
    'apollo_provider', COALESCE(v_apollo_provider, 'Apollo')
  );

  RETURN v_result;
END;
$function$;
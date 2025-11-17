-- Drop ALL versions of get_dashboard_metrics_fast to resolve overloading conflict
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);

-- Recreate with 3 parameters (with defaults) to support both 2-param and 3-param calls
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
  v_total_leads integer;
  v_high_fit_accounts integer;
  v_high_fit_leads integer;
  v_campaign_ready_accounts integer;
  v_campaign_ready_leads integer;
  v_data_completeness numeric;
  v_apollo_total integer := 0;
BEGIN
  -- Validate source filter
  IF p_source_filter NOT IN ('all', 'crm', 'database') THEN
    RAISE EXCEPTION 'Invalid source_filter. Must be one of: all, crm, database';
  END IF;

  -- Get Apollo total (only for 'all' and 'database' filters)
  IF p_source_filter IN ('all', 'database') THEN
    SELECT COALESCE(total_accounts, 0)
    INTO v_apollo_total
    FROM public.external_data_sources
    WHERE org_id = p_org_id 
      AND provider = 'apollo'
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Total accounts with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(*)::integer INTO v_total_accounts
    FROM public.accounts
    WHERE org_id = p_org_id;
    
    -- Add Apollo accounts for 'all'
    v_total_accounts := v_total_accounts + v_apollo_total;
    
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(*)::integer INTO v_total_accounts
    FROM public.accounts
    WHERE org_id = p_org_id
      AND data_source IN ('crm', 'both');
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*)::integer INTO v_total_accounts
    FROM public.accounts
    WHERE org_id = p_org_id
      AND (data_source = 'database' OR external_database_match = true);
    
    -- Add Apollo accounts for 'database'
    v_total_accounts := v_total_accounts + v_apollo_total;
  END IF;

  -- Total leads with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(*)::integer INTO v_total_leads
    FROM public."Leads"
    WHERE org_id = p_org_id;
    
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(*)::integer INTO v_total_leads
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND a.data_source IN ('crm', 'both');
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(*)::integer INTO v_total_leads
    FROM public."Leads" l
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND (a.data_source = 'database' OR a.external_database_match = true);
  END IF;

  -- High fit accounts (score >= 70) with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_high_fit_accounts
    FROM public.scores s
    WHERE s.org_id = p_org_id
      AND s.overall >= 70;
      
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_high_fit_accounts
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_high_fit_accounts
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND s.overall >= 70
      AND (a.data_source = 'database' OR a.external_database_match = true);
  END IF;

  -- High fit leads (linked to accounts with score >= 70) with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70;
      
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_high_fit_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND (a.data_source = 'database' OR a.external_database_match = true);
  END IF;

  -- Campaign ready accounts (high fit + has campaign ready leads) with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(DISTINCT a.external_id)::integer INTO v_campaign_ready_accounts
    FROM public.accounts a
    INNER JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN public."Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
      
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT a.external_id)::integer INTO v_campaign_ready_accounts
    FROM public.accounts a
    INNER JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN public."Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both')
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT a.external_id)::integer INTO v_campaign_ready_accounts
    FROM public.accounts a
    INNER JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    INNER JOIN public."Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
    WHERE a.org_id = p_org_id
      AND s.overall >= 70
      AND (a.data_source = 'database' OR a.external_database_match = true)
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
  END IF;

  -- Campaign ready leads (high fit account + valid email/persona) with source filtering
  IF p_source_filter = 'all' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_campaign_ready_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
      
  ELSIF p_source_filter = 'crm' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_campaign_ready_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both')
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
      
  ELSIF p_source_filter = 'database' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_campaign_ready_leads
    FROM public."Leads" l
    INNER JOIN public.scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    INNER JOIN public.accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    WHERE l.org_id = p_org_id
      AND s.overall >= 70
      AND (a.data_source = 'database' OR a.external_database_match = true)
      AND l.email IS NOT NULL 
      AND l.email LIKE '%@%'
      AND l.title IS NOT NULL
      AND l.title != ''
      AND l.persona IS NOT NULL
      AND l.persona != 'Unknown';
  END IF;

  -- Data completeness (average of key fields) with source filtering
  IF p_source_filter = 'all' THEN
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
          (COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100) / 4
        , 1)
      END
    INTO v_data_completeness
    FROM public.accounts
    WHERE org_id = p_org_id;
    
  ELSIF p_source_filter = 'crm' THEN
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
          (COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100) / 4
        , 1)
      END
    INTO v_data_completeness
    FROM public.accounts
    WHERE org_id = p_org_id
      AND data_source IN ('crm', 'both');
      
  ELSIF p_source_filter = 'database' THEN
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
          (COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100 +
           COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100) / 4
        , 1)
      END
    INTO v_data_completeness
    FROM public.accounts
    WHERE org_id = p_org_id
      AND (data_source = 'database' OR external_database_match = true);
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'total_accounts', COALESCE(v_total_accounts, 0),
    'total_leads', COALESCE(v_total_leads, 0),
    'high_fit_accounts', COALESCE(v_high_fit_accounts, 0),
    'high_fit_leads', COALESCE(v_high_fit_leads, 0),
    'campaign_ready_accounts', COALESCE(v_campaign_ready_accounts, 0),
    'campaign_ready_leads', COALESCE(v_campaign_ready_leads, 0),
    'data_completeness', COALESCE(v_data_completeness, 0),
    'apollo_total', v_apollo_total,
    'source_filter', p_source_filter
  );

  RETURN v_result;
END;
$function$;
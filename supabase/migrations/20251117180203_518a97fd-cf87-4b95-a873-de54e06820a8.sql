-- Drop incomplete function
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);

-- Create complete unified function with all dashboard metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_icp_id uuid DEFAULT NULL,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_total_accounts integer;
  v_crm_accounts integer;
  v_database_accounts integer;
  v_both_accounts integer;
  v_scored_accounts integer;
  v_total_leads integer;
  v_crm_leads integer;
  v_database_leads integer;
  v_linked_leads integer;
  v_high_fit integer;
  v_medium_fit integer;
  v_low_fit integer;
  v_high_fit_crm integer;
  v_high_fit_database integer;
  v_total_leads_count integer;
  v_crm_leads_count integer;
  v_database_leads_count integer;
  v_high_fit_leads integer;
  v_campaign_ready_accounts integer;
  v_campaign_ready_leads integer;
  v_data_completeness numeric;
  v_accounts_with_industry integer;
  v_accounts_with_size integer;
  v_accounts_with_revenue integer;
  v_accounts_with_geography integer;
BEGIN
  -- Determine filtering mode: ICP > Source > All
  IF p_icp_id IS NOT NULL THEN
    -- ICP Mode: Filter by specific ICP profile
    
    -- Get ICP profile
    DECLARE
      v_icp_industries text[];
      v_icp_sizes integer[];
      v_icp_revenues text[];
      v_icp_geographies text[];
    BEGIN
      SELECT industries, company_sizes, revenue_ranges, geographies
      INTO v_icp_industries, v_icp_sizes, v_icp_revenues, v_icp_geographies
      FROM icp_profiles
      WHERE id = p_icp_id AND org_id = p_org_id;
      
      -- Account counts filtered by ICP
      SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE data_source = 'crm'),
        COUNT(*) FILTER (WHERE data_source = 'database'),
        COUNT(*) FILTER (WHERE data_source = 'both')
      INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts
      FROM accounts
      WHERE org_id = p_org_id
        AND (v_icp_industries IS NULL OR industry_norm = ANY(v_icp_industries))
        AND (v_icp_sizes IS NULL OR employee_count = ANY(v_icp_sizes))
        AND (v_icp_revenues IS NULL OR revenue_range = ANY(v_icp_revenues))
        AND (v_icp_geographies IS NULL OR country = ANY(v_icp_geographies));
      
      -- Scored accounts filtered by ICP
      SELECT COUNT(DISTINCT s.account_external_id)
      INTO v_scored_accounts
      FROM scores s
      INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
      WHERE s.org_id = p_org_id
        AND (v_icp_industries IS NULL OR a.industry_norm = ANY(v_icp_industries))
        AND (v_icp_sizes IS NULL OR a.employee_count = ANY(v_icp_sizes))
        AND (v_icp_revenues IS NULL OR a.revenue_range = ANY(v_icp_revenues))
        AND (v_icp_geographies IS NULL OR a.country = ANY(v_icp_geographies));
      
      -- Fit distribution filtered by ICP
      SELECT 
        COUNT(*) FILTER (WHERE s.overall >= 70),
        COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
        COUNT(*) FILTER (WHERE s.overall < 40)
      INTO v_high_fit, v_medium_fit, v_low_fit
      FROM scores s
      INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
      WHERE s.org_id = p_org_id
        AND (v_icp_industries IS NULL OR a.industry_norm = ANY(v_icp_industries))
        AND (v_icp_sizes IS NULL OR a.employee_count = ANY(v_icp_sizes))
        AND (v_icp_revenues IS NULL OR a.revenue_range = ANY(v_icp_revenues))
        AND (v_icp_geographies IS NULL OR a.country = ANY(v_icp_geographies));
    END;
    
  ELSIF p_source_filter IN ('crm', 'database') THEN
    -- Source Mode: Filter by data source
    
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE data_source = 'crm'),
      COUNT(*) FILTER (WHERE data_source = 'database'),
      COUNT(*) FILTER (WHERE data_source = 'both')
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts
    FROM accounts
    WHERE org_id = p_org_id
      AND (p_source_filter = 'all' OR data_source IN (p_source_filter, 'both'));
    
    SELECT COUNT(DISTINCT s.account_external_id)
    INTO v_scored_accounts
    FROM scores s
    INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND (p_source_filter = 'all' OR a.data_source IN (p_source_filter, 'both'));
    
    SELECT 
      COUNT(*) FILTER (WHERE s.overall >= 70),
      COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
      COUNT(*) FILTER (WHERE s.overall < 40)
    INTO v_high_fit, v_medium_fit, v_low_fit
    FROM scores s
    INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND (p_source_filter = 'all' OR a.data_source IN (p_source_filter, 'both'));
    
  ELSE
    -- All Mode: Include internal + external data
    
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE data_source = 'crm'),
      COUNT(*) FILTER (WHERE data_source = 'database'),
      COUNT(*) FILTER (WHERE data_source = 'both')
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts
    FROM accounts
    WHERE org_id = p_org_id;
    
    SELECT COUNT(DISTINCT account_external_id)
    INTO v_scored_accounts
    FROM scores
    WHERE org_id = p_org_id;
    
    SELECT 
      COUNT(*) FILTER (WHERE overall >= 70),
      COUNT(*) FILTER (WHERE overall >= 40 AND overall < 70),
      COUNT(*) FILTER (WHERE overall < 40)
    INTO v_high_fit, v_medium_fit, v_low_fit
    FROM scores
    WHERE org_id = p_org_id;
  END IF;
  
  -- High fit by source (always calculate from internal data)
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database')
  INTO v_high_fit_crm, v_high_fit_database
  FROM scores s
  INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE s.org_id = p_org_id AND s.overall >= 70;
  
  -- Lead counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*) FILTER (WHERE l.account_external_id IS NOT NULL)
  INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id;
  
  -- Lead distribution counts
  v_total_leads_count := v_total_leads;
  v_crm_leads_count := v_crm_leads;
  v_database_leads_count := v_database_leads;
  
  -- High fit leads
  SELECT COUNT(DISTINCT l.id)
  INTO v_high_fit_leads
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
  WHERE l.org_id = p_org_id AND s.overall >= 70;
  
  -- Campaign ready counts
  SELECT 
    COUNT(DISTINCT a.external_id),
    COUNT(DISTINCT l.id)
  INTO v_campaign_ready_accounts, v_campaign_ready_leads
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  INNER JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND is_lead_campaign_ready(l.email, l.title, l.persona);
  
  -- Data completeness
  SELECT 
    COUNT(*) FILTER (WHERE industry_norm IS NOT NULL),
    COUNT(*) FILTER (WHERE employee_count IS NOT NULL),
    COUNT(*) FILTER (WHERE revenue_range IS NOT NULL),
    COUNT(*) FILTER (WHERE country IS NOT NULL)
  INTO v_accounts_with_industry, v_accounts_with_size, v_accounts_with_revenue, v_accounts_with_geography
  FROM accounts
  WHERE org_id = p_org_id;
  
  v_data_completeness := CASE 
    WHEN v_total_accounts > 0 THEN
      ((v_accounts_with_industry + v_accounts_with_size + v_accounts_with_revenue + v_accounts_with_geography)::numeric / 
       (v_total_accounts * 4)) * 100
    ELSE 0
  END;
  
  -- Build result
  v_result := jsonb_build_object(
    'total_accounts', COALESCE(v_total_accounts, 0),
    'crm_accounts', COALESCE(v_crm_accounts, 0),
    'database_accounts', COALESCE(v_database_accounts, 0),
    'both_accounts', COALESCE(v_both_accounts, 0),
    'scored_accounts', COALESCE(v_scored_accounts, 0),
    'total_leads', COALESCE(v_total_leads, 0),
    'crm_leads', COALESCE(v_crm_leads, 0),
    'database_leads', COALESCE(v_database_leads, 0),
    'linked_leads', COALESCE(v_linked_leads, 0),
    'high_fit_accounts', COALESCE(v_high_fit, 0),
    'medium_fit_accounts', COALESCE(v_medium_fit, 0),
    'low_fit_accounts', COALESCE(v_low_fit, 0),
    'high_fit_crm', COALESCE(v_high_fit_crm, 0),
    'high_fit_database', COALESCE(v_high_fit_database, 0),
    'total_leads_count', COALESCE(v_total_leads_count, 0),
    'crm_leads_count', COALESCE(v_crm_leads_count, 0),
    'database_leads_count', COALESCE(v_database_leads_count, 0),
    'high_fit_leads', COALESCE(v_high_fit_leads, 0),
    'campaign_ready_accounts', COALESCE(v_campaign_ready_accounts, 0),
    'campaign_ready_leads', COALESCE(v_campaign_ready_leads, 0),
    'data_completeness', ROUND(COALESCE(v_data_completeness, 0), 1)
  );
  
  RETURN v_result;
END;
$function$;
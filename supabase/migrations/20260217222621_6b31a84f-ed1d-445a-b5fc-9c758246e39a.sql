
-- Create child dashboard metrics cache table
CREATE TABLE IF NOT EXISTS public.child_dashboard_metrics_cache (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.child_dashboard_metrics_cache ENABLE ROW LEVEL SECURITY;

-- Only accessible via service role / SECURITY DEFINER functions
CREATE POLICY "No direct access" ON public.child_dashboard_metrics_cache
  FOR ALL USING (false);

-- Create RPC for data completeness (replaces 192 client-side queries with 1)
CREATE OR REPLACE FUNCTION public.get_data_completeness(p_data_org_id uuid, p_child_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
  v_industry bigint;
  v_employee bigint;
  v_revenue bigint;
  v_country bigint;
  v_domain bigint;
  v_completeness int;
BEGIN
  IF p_child_org_id IS NOT NULL AND p_child_org_id != p_data_org_id THEN
    -- Child org: only accounts scored by the child
    SELECT 
      COUNT(*),
      COUNT(a.industry_norm),
      COUNT(a.employee_count),
      COUNT(a.revenue_range),
      COUNT(a.country),
      COUNT(a.domain)
    INTO v_total, v_industry, v_employee, v_revenue, v_country, v_domain
    FROM accounts a
    INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_child_org_id
    WHERE a.org_id = p_data_org_id;
  ELSE
    -- Parent / standalone org: all accounts
    SELECT 
      COUNT(*),
      COUNT(industry_norm),
      COUNT(employee_count),
      COUNT(revenue_range),
      COUNT(country),
      COUNT(domain)
    INTO v_total, v_industry, v_employee, v_revenue, v_country, v_domain
    FROM accounts
    WHERE org_id = p_data_org_id;
  END IF;

  IF v_total = 0 THEN
    v_completeness := 0;
  ELSE
    v_completeness := ROUND(((v_industry + v_employee + v_revenue + v_country + v_domain)::numeric / (v_total * 5)) * 100);
  END IF;

  RETURN jsonb_build_object('completeness', v_completeness, 'total', v_total);
END;
$$;

-- Update get_dashboard_metrics_cached to use cache for child orgs
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_cached(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_org_id uuid;
  v_account_metrics record;
  v_lead_metrics record;
  v_cached record;
BEGIN
  v_data_org_id := public.get_data_org_id(p_org_id);
  
  -- If this org IS the data org (no parent), use materialized views directly
  IF v_data_org_id = p_org_id THEN
    SELECT * INTO v_account_metrics FROM dashboard_metrics_cache WHERE org_id = p_org_id;
    SELECT * INTO v_lead_metrics FROM leads_metrics_cache WHERE org_id = p_org_id;
    
    RETURN jsonb_build_object(
      'total_accounts', COALESCE(v_account_metrics.total_accounts, 0),
      'total_crm_accounts', COALESCE(v_account_metrics.total_crm_accounts, 0),
      'total_database_accounts', COALESCE(v_account_metrics.total_database_accounts, 0),
      'scored_accounts', COALESCE(v_account_metrics.scored_accounts, 0),
      'scored_crm_accounts', COALESCE(v_account_metrics.scored_crm_accounts, 0),
      'scored_database_accounts', COALESCE(v_account_metrics.scored_database_accounts, 0),
      'high_fit_accounts', COALESCE(v_account_metrics.high_fit_accounts, 0),
      'high_fit_crm_accounts', COALESCE(v_account_metrics.high_fit_crm_accounts, 0),
      'high_fit_database_accounts', COALESCE(v_account_metrics.high_fit_database_accounts, 0),
      'medium_fit_accounts', COALESCE(v_account_metrics.medium_fit_accounts, 0),
      'medium_fit_crm_accounts', COALESCE(v_account_metrics.medium_fit_crm_accounts, 0),
      'medium_fit_database_accounts', COALESCE(v_account_metrics.medium_fit_database_accounts, 0),
      'low_fit_accounts', COALESCE(v_account_metrics.low_fit_accounts, 0),
      'low_fit_crm_accounts', COALESCE(v_account_metrics.low_fit_crm_accounts, 0),
      'low_fit_database_accounts', COALESCE(v_account_metrics.low_fit_database_accounts, 0),
      'avg_score', COALESCE(v_account_metrics.avg_score, 0),
      'total_leads', COALESCE(v_lead_metrics.total_leads, 0),
      'total_crm_leads', COALESCE(v_lead_metrics.total_crm_leads, 0),
      'total_database_leads', COALESCE(v_lead_metrics.total_database_leads, 0),
      'high_fit_leads', COALESCE(v_lead_metrics.high_fit_leads, 0),
      'high_fit_crm_leads', COALESCE(v_lead_metrics.high_fit_crm_leads, 0),
      'high_fit_database_leads', COALESCE(v_lead_metrics.high_fit_database_leads, 0),
      'medium_fit_leads', COALESCE(v_lead_metrics.medium_fit_leads, 0),
      'medium_fit_crm_leads', COALESCE(v_lead_metrics.medium_fit_crm_leads, 0),
      'medium_fit_database_leads', COALESCE(v_lead_metrics.medium_fit_database_leads, 0),
      'low_fit_leads', COALESCE(v_lead_metrics.low_fit_leads, 0),
      'low_fit_crm_leads', COALESCE(v_lead_metrics.low_fit_crm_leads, 0),
      'low_fit_database_leads', COALESCE(v_lead_metrics.low_fit_database_leads, 0),
      'campaign_ready', COALESCE(v_lead_metrics.campaign_ready, 0),
      'refreshed_at', COALESCE(v_account_metrics.refreshed_at, NOW())
    );
  END IF;
  
  -- Child org: check cache first (5-minute TTL)
  SELECT * INTO v_cached 
  FROM child_dashboard_metrics_cache 
  WHERE org_id = p_org_id 
    AND refreshed_at > NOW() - INTERVAL '5 minutes';
  
  IF FOUND THEN
    RETURN v_cached.metrics;
  END IF;
  
  -- Cache miss or stale: compute fresh metrics
  SELECT 
    COUNT(*) as total_accounts,
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as total_crm_accounts,
    COUNT(*) FILTER (WHERE a.data_source = 'database') as total_database_accounts,
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won') OR a.data_source = 'database') as both_accounts,
    COUNT(s.id) as scored_accounts,
    COUNT(s.id) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as scored_crm_accounts,
    COUNT(s.id) FILTER (WHERE a.data_source = 'database') as scored_database_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 70) as high_fit_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70) as medium_fit_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_accounts,
    COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_accounts,
    COUNT(s.id) FILTER (WHERE s.overall < 40) as low_fit_accounts,
    COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_accounts,
    COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_accounts,
    COALESCE(AVG(s.overall), 0)::numeric as avg_score,
    COUNT(s.id) FILTER (WHERE s.overall >= 70 AND a.icp_qualified = true) as campaign_ready_accounts
  INTO v_account_metrics
  FROM accounts a
  INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_org_id
  WHERE a.org_id = v_data_org_id;
  
  SELECT 
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as total_crm_leads,
    COUNT(*) FILTER (WHERE a.data_source = 'database') as total_database_leads,
    COUNT(*) FILTER (WHERE s.overall >= 70) as high_fit_leads,
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_leads,
    COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_leads,
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70) as medium_fit_leads,
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_leads,
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_leads,
    COUNT(*) FILTER (WHERE s.overall < 40) as low_fit_leads,
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_leads,
    COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_leads,
    COUNT(*) FILTER (WHERE s.overall >= 70 AND l.email IS NOT NULL) as campaign_ready
  INTO v_lead_metrics
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id AND s.org_id = p_org_id
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = v_data_org_id
  WHERE l.org_id = v_data_org_id;
  
  -- Build result
  DECLARE
    v_result jsonb;
  BEGIN
    v_result := jsonb_build_object(
      'total_accounts', COALESCE(v_account_metrics.total_accounts, 0),
      'total_crm_accounts', COALESCE(v_account_metrics.total_crm_accounts, 0),
      'total_database_accounts', COALESCE(v_account_metrics.total_database_accounts, 0),
      'both_accounts', COALESCE(v_account_metrics.both_accounts, 0),
      'scored_accounts', COALESCE(v_account_metrics.scored_accounts, 0),
      'scored_crm_accounts', COALESCE(v_account_metrics.scored_crm_accounts, 0),
      'scored_database_accounts', COALESCE(v_account_metrics.scored_database_accounts, 0),
      'high_fit_accounts', COALESCE(v_account_metrics.high_fit_accounts, 0),
      'high_fit_crm_accounts', COALESCE(v_account_metrics.high_fit_crm_accounts, 0),
      'high_fit_database_accounts', COALESCE(v_account_metrics.high_fit_database_accounts, 0),
      'medium_fit_accounts', COALESCE(v_account_metrics.medium_fit_accounts, 0),
      'medium_fit_crm_accounts', COALESCE(v_account_metrics.medium_fit_crm_accounts, 0),
      'medium_fit_database_accounts', COALESCE(v_account_metrics.medium_fit_database_accounts, 0),
      'low_fit_accounts', COALESCE(v_account_metrics.low_fit_accounts, 0),
      'low_fit_crm_accounts', COALESCE(v_account_metrics.low_fit_crm_accounts, 0),
      'low_fit_database_accounts', COALESCE(v_account_metrics.low_fit_database_accounts, 0),
      'avg_score', COALESCE(v_account_metrics.avg_score, 0),
      'campaign_ready_accounts', COALESCE(v_account_metrics.campaign_ready_accounts, 0),
      'total_leads', COALESCE(v_lead_metrics.total_leads, 0),
      'total_crm_leads', COALESCE(v_lead_metrics.total_crm_leads, 0),
      'total_database_leads', COALESCE(v_lead_metrics.total_database_leads, 0),
      'high_fit_leads', COALESCE(v_lead_metrics.high_fit_leads, 0),
      'high_fit_crm_leads', COALESCE(v_lead_metrics.high_fit_crm_leads, 0),
      'high_fit_database_leads', COALESCE(v_lead_metrics.high_fit_database_leads, 0),
      'medium_fit_leads', COALESCE(v_lead_metrics.medium_fit_leads, 0),
      'medium_fit_crm_leads', COALESCE(v_lead_metrics.medium_fit_crm_leads, 0),
      'medium_fit_database_leads', COALESCE(v_lead_metrics.medium_fit_database_leads, 0),
      'low_fit_leads', COALESCE(v_lead_metrics.low_fit_leads, 0),
      'low_fit_crm_leads', COALESCE(v_lead_metrics.low_fit_crm_leads, 0),
      'low_fit_database_leads', COALESCE(v_lead_metrics.low_fit_database_leads, 0),
      'campaign_ready', COALESCE(v_lead_metrics.campaign_ready, 0),
      'refreshed_at', NOW()
    );
    
    -- Store in cache (upsert)
    INSERT INTO child_dashboard_metrics_cache (org_id, metrics, refreshed_at)
    VALUES (p_org_id, v_result, NOW())
    ON CONFLICT (org_id) DO UPDATE SET metrics = EXCLUDED.metrics, refreshed_at = NOW();
    
    RETURN v_result;
  END;
END;
$function$;

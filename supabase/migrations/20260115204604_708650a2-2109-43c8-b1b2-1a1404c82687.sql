-- Add composite index for accounts org_id + data_source (critical for dashboard metrics)
CREATE INDEX IF NOT EXISTS idx_accounts_org_data_source 
ON accounts(org_id, data_source);

-- Add composite index for scores with overall score for fit level filtering
CREATE INDEX IF NOT EXISTS idx_scores_org_overall 
ON scores(org_id, overall);

-- Add composite index for scores joining to accounts
CREATE INDEX IF NOT EXISTS idx_scores_org_account_overall 
ON scores(org_id, account_external_id, overall);

-- Create materialized view for fast dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics_cache AS
SELECT 
  a.org_id,
  -- Total accounts by source
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as total_crm_accounts,
  COUNT(*) FILTER (WHERE a.data_source = 'database') as total_database_accounts,
  -- Scored accounts
  COUNT(s.id) as scored_accounts,
  COUNT(s.id) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as scored_crm_accounts,
  COUNT(s.id) FILTER (WHERE a.data_source = 'database') as scored_database_accounts,
  -- High fit (>= 70)
  COUNT(s.id) FILTER (WHERE s.overall >= 70) as high_fit_accounts,
  COUNT(s.id) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_accounts,
  COUNT(s.id) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_accounts,
  -- Medium fit (40-69)
  COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70) as medium_fit_accounts,
  COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_accounts,
  COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_accounts,
  -- Low fit (< 40)
  COUNT(s.id) FILTER (WHERE s.overall < 40) as low_fit_accounts,
  COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_accounts,
  COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_accounts,
  -- Avg score
  COALESCE(AVG(s.overall), 0)::numeric as avg_score,
  -- Last updated
  NOW() as refreshed_at
FROM accounts a
LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
GROUP BY a.org_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_metrics_cache_org 
ON dashboard_metrics_cache(org_id);

-- Create leads metrics cache
CREATE MATERIALIZED VIEW IF NOT EXISTS leads_metrics_cache AS
SELECT 
  l.org_id,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as total_crm_leads,
  COUNT(*) FILTER (WHERE a.data_source = 'database') as total_database_leads,
  -- High fit leads
  COUNT(*) FILTER (WHERE s.overall >= 70) as high_fit_leads,
  COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_leads,
  COUNT(*) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_leads,
  -- Medium fit leads
  COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70) as medium_fit_leads,
  COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_leads,
  COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_leads,
  -- Low fit leads
  COUNT(*) FILTER (WHERE s.overall < 40) as low_fit_leads,
  COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_leads,
  COUNT(*) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_leads,
  -- Campaign ready
  COUNT(*) FILTER (WHERE s.overall >= 70 AND l.email IS NOT NULL) as campaign_ready,
  NOW() as refreshed_at
FROM "Leads" l
LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
LEFT JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
GROUP BY l.org_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_metrics_cache_org 
ON leads_metrics_cache(org_id);

-- Create optimized function using the materialized views
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_cached(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_account_metrics record;
  v_lead_metrics record;
BEGIN
  -- Get account metrics from cache
  SELECT * INTO v_account_metrics 
  FROM dashboard_metrics_cache 
  WHERE org_id = p_org_id;
  
  -- Get lead metrics from cache
  SELECT * INTO v_lead_metrics 
  FROM leads_metrics_cache 
  WHERE org_id = p_org_id;
  
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
END;
$$;

-- Function to refresh the dashboard caches (call this periodically or after data changes)
CREATE OR REPLACE FUNCTION public.refresh_dashboard_caches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache;
END;
$$;
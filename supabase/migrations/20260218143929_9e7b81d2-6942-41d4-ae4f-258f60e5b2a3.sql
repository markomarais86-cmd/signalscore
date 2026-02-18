
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_cached(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
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
    v_apollo_accounts bigint := 0;
    v_apollo_contacts bigint := 0;
    v_apollo_provider text := 'Apollo';
  BEGIN
    -- Fetch Apollo/TAM data for cache
    SELECT 
      COALESCE(total_accounts, 0),
      COALESCE(total_contacts, 0),
      COALESCE(provider, 'Apollo')
    INTO v_apollo_accounts, v_apollo_contacts, v_apollo_provider
    FROM external_data_sources
    WHERE org_id IN (p_org_id, v_data_org_id)
      AND is_active = true
    ORDER BY last_synced_at DESC NULLS LAST
    LIMIT 1;

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
      'apollo_accounts_available', COALESCE(v_apollo_accounts, 0),
      'apollo_contacts_available', COALESCE(v_apollo_contacts, 0),
      'apollo_provider', COALESCE(v_apollo_provider, 'Apollo'),
      'refreshed_at', NOW()
    );
    
    -- Store in cache (upsert)
    INSERT INTO child_dashboard_metrics_cache (org_id, metrics, refreshed_at)
    VALUES (p_org_id, v_result, NOW())
    ON CONFLICT (org_id) DO UPDATE SET metrics = EXCLUDED.metrics, refreshed_at = NOW();
    
    RETURN v_result;
  END;
END;
$$;

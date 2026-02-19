
-- Fix child org dashboard function to use >=60 threshold (matching dashboard_metrics_cache)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_cached(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Cache miss or stale: compute fresh metrics using 60/40 thresholds
  DECLARE
    v_result jsonb;
    v_am record;
    v_lm record;
    v_apollo record;
    v_cr record;
  BEGIN
    SELECT 
      COUNT(*) as total_accounts,
      COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as total_crm_accounts,
      COUNT(*) FILTER (WHERE a.data_source = 'database') as total_database_accounts,
      COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won') OR a.data_source = 'database') as both_accounts,
      COUNT(s.id) as scored_accounts,
      COUNT(s.id) FILTER (WHERE a.data_source IN ('crm', 'both', 'closed_won')) as scored_crm_accounts,
      COUNT(s.id) FILTER (WHERE a.data_source = 'database') as scored_database_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 60) as high_fit_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 60 AND a.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 60 AND a.data_source = 'database') as high_fit_database_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60) as medium_fit_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND a.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_accounts,
      COUNT(s.id) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND a.data_source = 'database') as medium_fit_database_accounts,
      COUNT(s.id) FILTER (WHERE s.overall < 40) as low_fit_accounts,
      COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_accounts,
      COUNT(s.id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_accounts,
      COALESCE(AVG(s.overall), 0) as avg_score
    INTO v_am
    FROM accounts a
    LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_org_id
    WHERE a.org_id = v_data_org_id;
    
    -- Lead metrics
    SELECT
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE l.data_source IN ('crm', 'both', 'closed_won')) as total_crm_leads,
      COUNT(*) FILTER (WHERE l.data_source = 'database') as total_database_leads,
      COUNT(*) FILTER (WHERE s.overall >= 60) as high_fit_leads,
      COUNT(*) FILTER (WHERE s.overall >= 60 AND l.data_source IN ('crm', 'both', 'closed_won')) as high_fit_crm_leads,
      COUNT(*) FILTER (WHERE s.overall >= 60 AND l.data_source = 'database') as high_fit_database_leads,
      COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 60) as medium_fit_leads,
      COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND l.data_source IN ('crm', 'both', 'closed_won')) as medium_fit_crm_leads,
      COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 60 AND l.data_source = 'database') as medium_fit_database_leads,
      COUNT(*) FILTER (WHERE s.overall < 40 OR s.overall IS NULL) as low_fit_leads,
      COUNT(*) FILTER (WHERE (s.overall < 40 OR s.overall IS NULL) AND l.data_source IN ('crm', 'both', 'closed_won')) as low_fit_crm_leads,
      COUNT(*) FILTER (WHERE (s.overall < 40 OR s.overall IS NULL) AND l.data_source = 'database') as low_fit_database_leads,
      COUNT(*) FILTER (WHERE l.email IS NOT NULL AND l.email != '') as campaign_ready
    INTO v_lm
    FROM "Leads" l
    LEFT JOIN scores s ON s.account_external_id = l.account_external_id AND s.org_id = p_org_id
    WHERE l.org_id = v_data_org_id;
    
    -- Apollo stats
    SELECT
      COALESCE((SELECT total_accounts FROM apollo_stats WHERE org_id = p_org_id), 0) as accounts_available,
      COALESCE((SELECT total_contacts FROM apollo_stats WHERE org_id = p_org_id), 0) as contacts_available,
      COALESCE((SELECT provider FROM apollo_stats WHERE org_id = p_org_id), 'apollo') as provider
    INTO v_apollo;
    
    -- Campaign ready accounts
    SELECT COUNT(DISTINCT a.external_id) as campaign_ready_accounts
    INTO v_cr
    FROM accounts a
    JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = p_org_id
    JOIN "Leads" l ON l.account_external_id = a.external_id AND l.org_id = v_data_org_id
    WHERE a.org_id = v_data_org_id
      AND s.overall >= 60
      AND l.email IS NOT NULL AND l.email != '';
    
    v_result := jsonb_build_object(
      'total_accounts', v_am.total_accounts,
      'total_crm_accounts', v_am.total_crm_accounts,
      'total_database_accounts', v_am.total_database_accounts,
      'both_accounts', v_am.both_accounts,
      'scored_accounts', v_am.scored_accounts,
      'scored_crm_accounts', v_am.scored_crm_accounts,
      'scored_database_accounts', v_am.scored_database_accounts,
      'high_fit_accounts', v_am.high_fit_accounts,
      'high_fit_crm_accounts', v_am.high_fit_crm_accounts,
      'high_fit_database_accounts', v_am.high_fit_database_accounts,
      'medium_fit_accounts', v_am.medium_fit_accounts,
      'medium_fit_crm_accounts', v_am.medium_fit_crm_accounts,
      'medium_fit_database_accounts', v_am.medium_fit_database_accounts,
      'low_fit_accounts', v_am.low_fit_accounts,
      'low_fit_crm_accounts', v_am.low_fit_crm_accounts,
      'low_fit_database_accounts', v_am.low_fit_database_accounts,
      'avg_score', v_am.avg_score,
      'total_leads', v_lm.total_leads,
      'total_crm_leads', v_lm.total_crm_leads,
      'total_database_leads', v_lm.total_database_leads,
      'high_fit_leads', v_lm.high_fit_leads,
      'high_fit_crm_leads', v_lm.high_fit_crm_leads,
      'high_fit_database_leads', v_lm.high_fit_database_leads,
      'medium_fit_leads', v_lm.medium_fit_leads,
      'medium_fit_crm_leads', v_lm.medium_fit_crm_leads,
      'medium_fit_database_leads', v_lm.medium_fit_database_leads,
      'low_fit_leads', v_lm.low_fit_leads,
      'low_fit_crm_leads', v_lm.low_fit_crm_leads,
      'low_fit_database_leads', v_lm.low_fit_database_leads,
      'campaign_ready', v_lm.campaign_ready,
      'campaign_ready_accounts', v_cr.campaign_ready_accounts,
      'apollo_accounts_available', v_apollo.accounts_available,
      'apollo_contacts_available', v_apollo.contacts_available,
      'apollo_provider', v_apollo.provider
    );
    
    -- Store in cache (upsert)
    INSERT INTO child_dashboard_metrics_cache (org_id, metrics, refreshed_at)
    VALUES (p_org_id, v_result, NOW())
    ON CONFLICT (org_id) DO UPDATE SET metrics = EXCLUDED.metrics, refreshed_at = NOW();
    
    RETURN v_result;
  END;
END;
$$;

-- Invalidate stale child cache
DELETE FROM child_dashboard_metrics_cache WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';


CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_cached(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_data_org_id uuid;
  v_account_metrics record;
  v_lead_metrics record;
  v_cached record;
BEGIN
  v_data_org_id := public.get_data_org_id(p_org_id);
  
  -- Parent org: use materialized cache tables directly (fast)
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
  
  -- Child org: check cache first (use ANY available cache, not just 5-min fresh)
  SELECT * INTO v_cached 
  FROM child_dashboard_metrics_cache 
  WHERE org_id = p_org_id;
  
  -- If cache exists and is fresh (< 5 min), return immediately
  IF FOUND AND v_cached.refreshed_at > NOW() - INTERVAL '5 minutes' THEN
    RETURN v_cached.metrics;
  END IF;
  
  -- Try live computation, but if it fails/times out, fall back to stale cache
  BEGIN
    DECLARE
      v_result jsonb;
      v_am record;
      v_lm record;
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
      WHERE a.org_id = v_data_org_id
        AND s.id IS NOT NULL;

      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE l.source IN ('crm', 'both', 'closed_won', 'csv_upload')) as total_crm_leads,
        COUNT(*) FILTER (WHERE l.source = 'database') as total_database_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 60) as high_fit_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 60 AND l.source IN ('crm', 'both', 'closed_won', 'csv_upload')) as high_fit_crm_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 60 AND l.source = 'database') as high_fit_database_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 40 AND s2.overall < 60) as medium_fit_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 40 AND s2.overall < 60 AND l.source IN ('crm', 'both', 'closed_won', 'csv_upload')) as medium_fit_crm_leads,
        COUNT(*) FILTER (WHERE s2.overall >= 40 AND s2.overall < 60 AND l.source = 'database') as medium_fit_database_leads,
        COUNT(*) FILTER (WHERE s2.overall < 40) as low_fit_leads,
        COUNT(*) FILTER (WHERE s2.overall < 40 AND l.source IN ('crm', 'both', 'closed_won', 'csv_upload')) as low_fit_crm_leads,
        COUNT(*) FILTER (WHERE s2.overall < 40 AND l.source = 'database') as low_fit_database_leads,
        COUNT(*) FILTER (WHERE l.email IS NOT NULL AND l.email != '') as campaign_ready
      INTO v_lm
      FROM "Leads" l
      JOIN accounts a2 ON a2.external_id = l.account_external_id AND a2.org_id = v_data_org_id
      LEFT JOIN scores s2 ON s2.account_external_id = l.account_external_id AND s2.org_id = p_org_id
      WHERE l.org_id = v_data_org_id
        AND s2.id IS NOT NULL;

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
        'refreshed_at', NOW()
      );

      -- Update the cache
      INSERT INTO child_dashboard_metrics_cache (org_id, metrics, refreshed_at)
      VALUES (p_org_id, v_result, NOW())
      ON CONFLICT (org_id) DO UPDATE SET metrics = v_result, refreshed_at = NOW();

      RETURN v_result;
    END;
  EXCEPTION WHEN OTHERS THEN
    -- If live computation failed (timeout, etc.), return stale cache if available
    IF v_cached IS NOT NULL AND v_cached.metrics IS NOT NULL THEN
      RETURN v_cached.metrics;
    END IF;
    RAISE;
  END;
END;
$function$;

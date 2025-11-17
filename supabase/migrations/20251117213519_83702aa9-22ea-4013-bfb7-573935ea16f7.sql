
-- Fix source filtering - corrected table name from contacts to Leads
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_accounts bigint := 0;
  v_scored_accounts bigint := 0;
  v_total_leads bigint := 0;
  v_crm_accounts bigint := 0;
  v_database_accounts bigint := 0;
  v_both_accounts bigint := 0;
  v_linked_leads bigint := 0;
  v_high_fit_accounts bigint := 0;
  v_medium_fit_accounts bigint := 0;
  v_low_fit_accounts bigint := 0;
  v_high_fit_crm_accounts bigint := 0;
  v_high_fit_database_accounts bigint := 0;
  v_crm_leads bigint := 0;
  v_database_leads bigint := 0;
  v_high_fit_leads_total bigint := 0;
  v_high_fit_crm_leads bigint := 0;
  v_high_fit_database_leads bigint := 0;
  v_campaign_ready_accounts bigint := 0;
  v_campaign_ready_leads bigint := 0;
  v_data_completeness numeric := 0;
  v_external_tam_accounts bigint := 0;
  v_external_tam_contacts bigint := 0;
BEGIN
  -- Total accounts with source filter
  SELECT COUNT(*)
  INTO v_total_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Total leads with source filter
  SELECT COUNT(*)
  INTO v_total_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true))
    );

  -- Scored accounts
  SELECT COUNT(DISTINCT a.id)
  INTO v_scored_accounts
  FROM accounts a
  INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Account source breakdown
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source = 'crm'),
    COUNT(*) FILTER (WHERE a.data_source = 'database'),
    COUNT(*) FILTER (WHERE a.data_source = 'both')
  INTO v_crm_accounts, v_database_accounts, v_both_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Linked leads
  SELECT COUNT(*)
  INTO v_linked_leads
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Score distribution
  SELECT 
    COUNT(*) FILTER (WHERE s.overall >= 70),
    COUNT(*) FILTER (WHERE s.overall >= 40 AND s.overall < 70),
    COUNT(*) FILTER (WHERE s.overall < 40)
  INTO v_high_fit_accounts, v_medium_fit_accounts, v_low_fit_accounts
  FROM accounts a
  INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- High fit accounts by source
  SELECT 
    COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE a.data_source = 'database' OR a.external_database_match = true)
  INTO v_high_fit_crm_accounts, v_high_fit_database_accounts
  FROM accounts a
  INNER JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id
    AND s.overall >= 70
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
    );

  -- Lead source breakdown
  SELECT 
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true)
  INTO v_crm_leads, v_database_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true))
    );

  -- High fit leads
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) IN ('crm', 'both')),
    COUNT(*) FILTER (WHERE COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true)
  INTO v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_database_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND s.overall >= 70
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true))
    );

  -- Campaign ready counts
  SELECT 
    COUNT(DISTINCT l.account_external_id),
    COUNT(*)
  INTO v_campaign_ready_accounts, v_campaign_ready_leads
  FROM "Leads" l
  LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND l.email IS NOT NULL
    AND l.email_status = 'valid'
    AND s.overall >= 70
    AND (
      p_source_filter = 'all'
      OR (p_source_filter = 'crm' AND COALESCE(a.data_source, l.data_source) IN ('crm', 'both'))
      OR (p_source_filter = 'database' AND (COALESCE(a.data_source, l.data_source) = 'database' OR a.external_database_match = true))
    );

  -- Data completeness
  WITH completeness AS (
    SELECT 
      COUNT(*) as total,
      COUNT(a.domain) as has_domain,
      COUNT(a.industry_norm) as has_industry,
      COUNT(a.employee_count) as has_size,
      COUNT(a.revenue_range) as has_revenue,
      COUNT(a.country) as has_geography
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND (a.data_source = 'database' OR a.external_database_match = true))
      )
  )
  SELECT 
    CASE 
      WHEN total = 0 THEN 0
      ELSE ROUND(((has_domain + has_industry + has_size + has_revenue + has_geography)::numeric / (total * 5)) * 100, 1)
    END
  INTO v_data_completeness
  FROM completeness;

  -- Add external TAM data only for 'all' or 'database' filters
  IF p_source_filter IN ('all', 'database') THEN
    SELECT 
      COALESCE(SUM(total_accounts), 0),
      COALESCE(SUM(total_contacts), 0)
    INTO v_external_tam_accounts, v_external_tam_contacts
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true;
    
    v_database_accounts := v_database_accounts + v_external_tam_accounts;
    v_database_leads := v_database_leads + v_external_tam_contacts;
  END IF;

  -- Return all metrics as JSON
  RETURN jsonb_build_object(
    'total_accounts', v_total_accounts,
    'scored_accounts', v_scored_accounts,
    'total_leads', v_total_leads,
    'crm_accounts', v_crm_accounts,
    'database_accounts', v_database_accounts,
    'both_accounts', v_both_accounts,
    'linked_leads', v_linked_leads,
    'high_fit_accounts', v_high_fit_accounts,
    'medium_fit_accounts', v_medium_fit_accounts,
    'low_fit_accounts', v_low_fit_accounts,
    'high_fit_crm_accounts', v_high_fit_crm_accounts,
    'high_fit_database_accounts', v_high_fit_database_accounts,
    'crm_leads', v_crm_leads,
    'database_leads', v_database_leads,
    'high_fit_leads_total', v_high_fit_leads_total,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'high_fit_database_leads', v_high_fit_database_leads,
    'campaign_ready_accounts', v_campaign_ready_accounts,
    'campaign_ready_leads', v_campaign_ready_leads,
    'data_completeness', v_data_completeness
  );
END;
$$;

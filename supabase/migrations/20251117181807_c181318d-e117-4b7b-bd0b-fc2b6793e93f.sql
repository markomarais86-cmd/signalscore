
-- Update get_dashboard_metrics_fast to include external data sources in totals
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_icp_id uuid DEFAULT NULL,
  p_source_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_total_accounts int := 0;
  v_crm_accounts int := 0;
  v_database_accounts int := 0;
  v_both_accounts int := 0;
  v_scored_accounts int := 0;
  v_high_fit int := 0;
  v_medium_fit int := 0;
  v_low_fit int := 0;
  v_high_fit_crm int := 0;
  v_high_fit_db int := 0;
  v_total_leads int := 0;
  v_crm_leads int := 0;
  v_database_leads int := 0;
  v_linked_leads int := 0;
  v_high_fit_leads_total int := 0;
  v_high_fit_crm_leads int := 0;
  v_high_fit_db_leads int := 0;
  v_campaign_ready_accounts int := 0;
  v_campaign_ready_leads int := 0;
  v_data_completeness numeric := 0;
  
  -- External data source counts
  v_external_accounts int := 0;
  v_external_leads int := 0;
BEGIN
  -- Get external data source totals (only for 'all' or 'database' filter)
  IF p_source_filter IN ('all', 'database') THEN
    SELECT 
      COALESCE(SUM(total_accounts), 0),
      COALESCE(SUM(total_contacts), 0)
    INTO v_external_accounts, v_external_leads
    FROM external_data_sources
    WHERE org_id = p_org_id 
      AND is_active = true;
  END IF;

  -- Base account counts from accounts table
  IF p_icp_id IS NOT NULL THEN
    -- ICP-specific filtering
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data_source = 'crm') as crm,
      COUNT(*) FILTER (WHERE data_source IN ('database', 'api', 'enrichment')) as db,
      COUNT(*) FILTER (WHERE data_source = 'both') as both,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM scores s 
        WHERE s.account_external_id = a.external_id 
          AND s.org_id = a.org_id 
          AND s.icp_id = p_icp_id
      )) as scored
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts, v_scored_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id;
    
  ELSIF p_source_filter = 'crm' THEN
    -- CRM only filter
    SELECT 
      COUNT(*) as total,
      COUNT(*) as crm,
      0 as db,
      0 as both,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM scores s WHERE s.account_external_id = a.external_id AND s.org_id = a.org_id)) as scored
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts, v_scored_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id 
      AND a.data_source = 'crm';
      
  ELSIF p_source_filter = 'database' THEN
    -- Database only filter (internal database accounts only, external added later)
    SELECT 
      COUNT(*) as total,
      0 as crm,
      COUNT(*) as db,
      0 as both,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM scores s WHERE s.account_external_id = a.external_id AND s.org_id = a.org_id)) as scored
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts, v_scored_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id 
      AND a.data_source IN ('database', 'api', 'enrichment');
      
  ELSE
    -- All sources (default)
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data_source = 'crm') as crm,
      COUNT(*) FILTER (WHERE data_source IN ('database', 'api', 'enrichment')) as db,
      COUNT(*) FILTER (WHERE data_source = 'both') as both,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM scores s WHERE s.account_external_id = a.external_id AND s.org_id = a.org_id)) as scored
    INTO v_total_accounts, v_crm_accounts, v_database_accounts, v_both_accounts, v_scored_accounts
    FROM accounts a
    WHERE a.org_id = p_org_id;
  END IF;

  -- Fit distribution (high/medium/low scores)
  IF p_icp_id IS NOT NULL THEN
    SELECT 
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 40 AND s.overall_fit_score < 70) as med_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score < 40) as low_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70 AND a.data_source = 'crm') as high_crm,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70 AND a.data_source IN ('database', 'api', 'enrichment')) as high_db
    INTO v_high_fit, v_medium_fit, v_low_fit, v_high_fit_crm, v_high_fit_db
    FROM scores s
    JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id AND s.icp_id = p_icp_id;
    
  ELSIF p_source_filter = 'crm' THEN
    SELECT 
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 40 AND s.overall_fit_score < 70) as med_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score < 40) as low_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_crm,
      0 as high_db
    INTO v_high_fit, v_medium_fit, v_low_fit, v_high_fit_crm, v_high_fit_db
    FROM scores s
    JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id AND a.data_source = 'crm';
    
  ELSIF p_source_filter = 'database' THEN
    SELECT 
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 40 AND s.overall_fit_score < 70) as med_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score < 40) as low_fit,
      0 as high_crm,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_db
    INTO v_high_fit, v_medium_fit, v_low_fit, v_high_fit_crm, v_high_fit_db
    FROM scores s
    JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id AND a.data_source IN ('database', 'api', 'enrichment');
    
  ELSE
    SELECT 
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70) as high_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 40 AND s.overall_fit_score < 70) as med_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score < 40) as low_fit,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70 AND a.data_source = 'crm') as high_crm,
      COUNT(*) FILTER (WHERE s.overall_fit_score >= 70 AND a.data_source IN ('database', 'api', 'enrichment')) as high_db
    INTO v_high_fit, v_medium_fit, v_low_fit, v_high_fit_crm, v_high_fit_db
    FROM scores s
    JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id;
  END IF;

  -- Lead counts from Leads table
  IF p_icp_id IS NOT NULL THEN
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data_source = 'crm') as crm,
      COUNT(*) FILTER (WHERE data_source IN ('database', 'api', 'enrichment')) as db,
      COUNT(*) FILTER (WHERE account_id IS NOT NULL) as linked,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_total,
      COUNT(*) FILTER (WHERE fit_score >= 70 AND data_source = 'crm') as high_fit_crm,
      COUNT(*) FILTER (WHERE fit_score >= 70 AND data_source IN ('database', 'api', 'enrichment')) as high_fit_db,
      COUNT(*) FILTER (WHERE is_campaign_ready = true) as campaign_ready
    INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads, 
         v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_db_leads, v_campaign_ready_leads
    FROM "Leads"
    WHERE org_id = p_org_id;
    
  ELSIF p_source_filter = 'crm' THEN
    SELECT 
      COUNT(*) as total,
      COUNT(*) as crm,
      0 as db,
      COUNT(*) FILTER (WHERE account_id IS NOT NULL) as linked,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_total,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_crm,
      0 as high_fit_db,
      COUNT(*) FILTER (WHERE is_campaign_ready = true) as campaign_ready
    INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads,
         v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_db_leads, v_campaign_ready_leads
    FROM "Leads"
    WHERE org_id = p_org_id AND data_source = 'crm';
    
  ELSIF p_source_filter = 'database' THEN
    SELECT 
      COUNT(*) as total,
      0 as crm,
      COUNT(*) as db,
      COUNT(*) FILTER (WHERE account_id IS NOT NULL) as linked,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_total,
      0 as high_fit_crm,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_db,
      COUNT(*) FILTER (WHERE is_campaign_ready = true) as campaign_ready
    INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads,
         v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_db_leads, v_campaign_ready_leads
    FROM "Leads"
    WHERE org_id = p_org_id AND data_source IN ('database', 'api', 'enrichment');
    
  ELSE
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE data_source = 'crm') as crm,
      COUNT(*) FILTER (WHERE data_source IN ('database', 'api', 'enrichment')) as db,
      COUNT(*) FILTER (WHERE account_id IS NOT NULL) as linked,
      COUNT(*) FILTER (WHERE fit_score >= 70) as high_fit_total,
      COUNT(*) FILTER (WHERE fit_score >= 70 AND data_source = 'crm') as high_fit_crm,
      COUNT(*) FILTER (WHERE fit_score >= 70 AND data_source IN ('database', 'api', 'enrichment')) as high_fit_db,
      COUNT(*) FILTER (WHERE is_campaign_ready = true) as campaign_ready
    INTO v_total_leads, v_crm_leads, v_database_leads, v_linked_leads,
         v_high_fit_leads_total, v_high_fit_crm_leads, v_high_fit_db_leads, v_campaign_ready_leads
    FROM "Leads"
    WHERE org_id = p_org_id;
  END IF;

  -- Campaign ready accounts
  SELECT COUNT(*)
  INTO v_campaign_ready_accounts
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM "Leads" l 
      WHERE l.account_id = a.id 
        AND l.is_campaign_ready = true
    )
    AND (p_icp_id IS NULL OR EXISTS (
      SELECT 1 FROM scores s 
      WHERE s.account_external_id = a.external_id 
        AND s.org_id = a.org_id 
        AND s.icp_id = p_icp_id
    ))
    AND (
      p_source_filter = 'all' 
      OR (p_source_filter = 'crm' AND a.data_source = 'crm')
      OR (p_source_filter = 'database' AND a.data_source IN ('database', 'api', 'enrichment'))
    );

  -- Data completeness calculation
  WITH completeness AS (
    SELECT 
      COUNT(*) as total_accounts,
      COUNT(*) FILTER (WHERE domain IS NOT NULL) as has_domain,
      COUNT(*) FILTER (WHERE employee_count IS NOT NULL) as has_size,
      COUNT(*) FILTER (WHERE industry_norm IS NOT NULL) as has_industry,
      COUNT(*) FILTER (WHERE country IS NOT NULL) as has_geography,
      COUNT(*) FILTER (WHERE revenue_range IS NOT NULL) as has_revenue
    FROM accounts
    WHERE org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND data_source = 'crm')
        OR (p_source_filter = 'database' AND data_source IN ('database', 'api', 'enrichment'))
      )
  )
  SELECT 
    CASE 
      WHEN total_accounts = 0 THEN 0
      ELSE ROUND(
        ((has_domain::numeric + has_size + has_industry + has_geography + has_revenue) / 
         (total_accounts * 5.0)) * 100, 
        1
      )
    END
  INTO v_data_completeness
  FROM completeness;

  -- Add external data to totals for 'all' and 'database' filters
  IF p_source_filter = 'all' THEN
    v_total_accounts := v_total_accounts + v_external_accounts;
    v_database_accounts := v_database_accounts + v_external_accounts;
    v_total_leads := v_total_leads + v_external_leads;
    v_database_leads := v_database_leads + v_external_leads;
  ELSIF p_source_filter = 'database' THEN
    v_total_accounts := v_total_accounts + v_external_accounts;
    v_database_accounts := v_database_accounts + v_external_accounts;
    v_total_leads := v_total_leads + v_external_leads;
    v_database_leads := v_database_leads + v_external_leads;
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'total_accounts', v_total_accounts,
    'crm_accounts', v_crm_accounts,
    'database_accounts', v_database_accounts,
    'both_accounts', v_both_accounts,
    'scored_accounts', v_scored_accounts,
    'high_fit_accounts', v_high_fit,
    'medium_fit_accounts', v_medium_fit,
    'low_fit_accounts', v_low_fit,
    'high_fit_crm_accounts', v_high_fit_crm,
    'high_fit_database_accounts', v_high_fit_db,
    'total_leads', v_total_leads,
    'crm_leads', v_crm_leads,
    'database_leads', v_database_leads,
    'linked_leads', v_linked_leads,
    'high_fit_leads_total', v_high_fit_leads_total,
    'high_fit_crm_leads', v_high_fit_crm_leads,
    'high_fit_database_leads', v_high_fit_db_leads,
    'campaign_ready_accounts', v_campaign_ready_accounts,
    'campaign_ready_leads', v_campaign_ready_leads,
    'data_completeness', v_data_completeness
  );

  RETURN v_result;
END;
$$;

-- Fix missing created_at column in get_filtered_accounts function
DROP FUNCTION IF EXISTS get_filtered_accounts(uuid,timestamp with time zone,integer,text,text,text,text,integer,integer,boolean);

CREATE OR REPLACE FUNCTION get_filtered_accounts(
  p_org_id UUID,
  p_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_search_term TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_data_source TEXT DEFAULT NULL,
  p_fit_min INTEGER DEFAULT NULL,
  p_fit_max INTEGER DEFAULT NULL,
  p_campaign_ready BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  external_id TEXT,
  name TEXT,
  domain TEXT,
  industry_raw TEXT,
  industry_norm TEXT,
  employee_count INTEGER,
  revenue_range TEXT,
  country TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  data_source TEXT,
  enriched_from TEXT,
  enriched_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_accounts AS (
    SELECT DISTINCT 
      a.id,
      a.org_id,
      a.external_id,
      a.name,
      a.domain,
      a.industry_raw,
      a.industry_norm,
      a.employee_count,
      a.revenue_range,
      a.country,
      a.updated_at,
      a.data_source,
      a.enriched_from,
      a.enriched_at
    FROM accounts a
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND s.org_id = p_org_id
    LEFT JOIN (
      SELECT DISTINCT account_external_id
      FROM "Leads"
      WHERE "Leads".org_id = p_org_id
        AND email IS NOT NULL
        AND title IS NOT NULL
        AND persona IS NOT NULL
        AND persona != 'Unknown'
    ) cr ON a.external_id = cr.account_external_id
    WHERE a.org_id = p_org_id
      AND (p_cursor IS NULL OR a.updated_at < p_cursor)
      AND (p_search_term IS NULL OR 
           a.name ILIKE '%' || p_search_term || '%' OR
           a.domain ILIKE '%' || p_search_term || '%' OR
           a.external_id ILIKE '%' || p_search_term || '%')
      AND (p_industry IS NULL OR a.industry_norm = p_industry)
      AND (p_country IS NULL OR a.country = p_country)
      AND (p_data_source IS NULL OR 
           (p_data_source = 'crm' AND a.data_source IN ('crm', 'both', 'closed_won')) OR
           (p_data_source = 'database' AND a.data_source = 'database'))
      AND (p_fit_min IS NULL OR s.overall >= p_fit_min)
      AND (p_fit_max IS NULL OR s.overall <= p_fit_max)
      AND (NOT p_campaign_ready OR (s.overall >= 70 AND cr.account_external_id IS NOT NULL))
    ORDER BY a.updated_at DESC
    LIMIT p_limit
  ),
  total AS (
    SELECT COUNT(DISTINCT a.external_id) as cnt
    FROM accounts a
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND s.org_id = p_org_id
    LEFT JOIN (
      SELECT DISTINCT account_external_id
      FROM "Leads"
      WHERE "Leads".org_id = p_org_id
        AND email IS NOT NULL
        AND title IS NOT NULL
        AND persona IS NOT NULL
        AND persona != 'Unknown'
    ) cr ON a.external_id = cr.account_external_id
    WHERE a.org_id = p_org_id
      AND (p_search_term IS NULL OR 
           a.name ILIKE '%' || p_search_term || '%' OR
           a.domain ILIKE '%' || p_search_term || '%' OR
           a.external_id ILIKE '%' || p_search_term || '%')
      AND (p_industry IS NULL OR a.industry_norm = p_industry)
      AND (p_country IS NULL OR a.country = p_country)
      AND (p_data_source IS NULL OR 
           (p_data_source = 'crm' AND a.data_source IN ('crm', 'both', 'closed_won')) OR
           (p_data_source = 'database' AND a.data_source = 'database'))
      AND (p_fit_min IS NULL OR s.overall >= p_fit_min)
      AND (p_fit_max IS NULL OR s.overall <= p_fit_max)
      AND (NOT p_campaign_ready OR (s.overall >= 70 AND cr.account_external_id IS NOT NULL))
  )
  SELECT 
    fa.id,
    fa.org_id,
    fa.external_id,
    fa.name,
    fa.domain,
    fa.industry_raw,
    fa.industry_norm,
    fa.employee_count,
    fa.revenue_range,
    fa.country,
    fa.updated_at,
    fa.data_source,
    fa.enriched_from,
    fa.enriched_at,
    t.cnt as total_count
  FROM filtered_accounts fa
  CROSS JOIN total t;
END;
$$;
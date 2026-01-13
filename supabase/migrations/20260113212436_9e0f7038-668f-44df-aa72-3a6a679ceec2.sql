-- Update AI agent batch_size from 50 to 500
UPDATE ai_agents 
SET parameters = jsonb_set(COALESCE(parameters, '{}'::jsonb), '{batch_size}', '500')
WHERE agent_type = 'data_enrichment';

-- Update get_filtered_accounts function to support sorting
CREATE OR REPLACE FUNCTION get_filtered_accounts(
  p_org_id UUID,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_search_term TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_data_source TEXT DEFAULT NULL,
  p_fit_min INT DEFAULT NULL,
  p_fit_max INT DEFAULT NULL,
  p_campaign_ready BOOLEAN DEFAULT FALSE,
  p_sort_field TEXT DEFAULT 'updated_at',
  p_sort_direction TEXT DEFAULT 'desc'
)
RETURNS TABLE (
  external_id TEXT,
  name TEXT,
  industry_norm TEXT,
  country TEXT,
  city TEXT,
  state_province TEXT,
  employee_count INT,
  revenue_range TEXT,
  domain TEXT,
  linkedin_url TEXT,
  data_source TEXT,
  updated_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ,
  enrichment_overall_score NUMERIC,
  icp_qualified BOOLEAN,
  deep_research_requested BOOLEAN,
  deep_research_completed_at TIMESTAMPTZ,
  tech_stack TEXT[],
  total_raised_usd NUMERIC,
  last_funding_round TEXT,
  last_funding_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.external_id,
    a.name,
    a.industry_norm,
    a.country,
    a.city,
    a.state_province,
    a.employee_count,
    a.revenue_range,
    a.domain,
    a.linkedin_url,
    a.data_source,
    a.updated_at,
    a.enriched_at,
    a.enrichment_overall_score,
    a.icp_qualified,
    a.deep_research_requested,
    a.deep_research_completed_at,
    a.tech_stack,
    a.total_raised_usd,
    a.last_funding_round,
    a.last_funding_date::DATE
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (p_cursor IS NULL OR 
      CASE 
        WHEN p_sort_direction = 'desc' THEN 
          CASE p_sort_field
            WHEN 'name' THEN a.name < (SELECT acc.name FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            WHEN 'industry_norm' THEN a.industry_norm < (SELECT acc.industry_norm FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            WHEN 'country' THEN a.country < (SELECT acc.country FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            ELSE a.updated_at < p_cursor
          END
        ELSE 
          CASE p_sort_field
            WHEN 'name' THEN a.name > (SELECT acc.name FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            WHEN 'industry_norm' THEN a.industry_norm > (SELECT acc.industry_norm FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            WHEN 'country' THEN a.country > (SELECT acc.country FROM accounts acc WHERE acc.org_id = p_org_id AND acc.updated_at = p_cursor LIMIT 1)
            ELSE a.updated_at > p_cursor
          END
      END
    )
    AND (p_search_term IS NULL OR p_search_term = '' OR 
         a.name ILIKE '%' || p_search_term || '%' OR 
         a.domain ILIKE '%' || p_search_term || '%')
    AND (p_industry IS NULL OR p_industry = '' OR a.industry_norm = p_industry)
    AND (p_country IS NULL OR p_country = '' OR a.country = p_country)
    AND (p_data_source IS NULL OR p_data_source = '' OR a.data_source = p_data_source)
  ORDER BY 
    CASE WHEN p_sort_direction = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN a.name
        WHEN 'industry_norm' THEN a.industry_norm
        WHEN 'country' THEN a.country
        WHEN 'employee_count' THEN a.employee_count::TEXT
        ELSE NULL
      END
    END DESC NULLS LAST,
    CASE WHEN p_sort_direction = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN a.name
        WHEN 'industry_norm' THEN a.industry_norm
        WHEN 'country' THEN a.country
        WHEN 'employee_count' THEN a.employee_count::TEXT
        ELSE NULL
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_direction = 'desc' THEN a.updated_at END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_direction = 'asc' THEN a.updated_at END ASC NULLS LAST,
    a.updated_at DESC
  LIMIT p_limit;
END;
$$;
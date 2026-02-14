
-- Drop the 12-param version that lacks total_count
DROP FUNCTION IF EXISTS get_filtered_accounts(uuid, timestamp with time zone, integer, text, text, text, text, integer, integer, boolean, text, text);

-- Recreate with total_count included
CREATE OR REPLACE FUNCTION get_filtered_accounts(
  p_org_id uuid,
  p_cursor timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_search_term text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_data_source text DEFAULT NULL,
  p_fit_min integer DEFAULT NULL,
  p_fit_max integer DEFAULT NULL,
  p_campaign_ready boolean DEFAULT false,
  p_sort_field text DEFAULT 'updated_at',
  p_sort_direction text DEFAULT 'desc'
)
RETURNS TABLE(
  external_id text,
  name text,
  industry_norm text,
  country text,
  city text,
  state_province text,
  employee_count integer,
  revenue_range text,
  domain text,
  linkedin_url text,
  data_source text,
  updated_at timestamp with time zone,
  enriched_at timestamp with time zone,
  enrichment_overall_score numeric,
  icp_qualified boolean,
  deep_research_requested boolean,
  deep_research_completed_at timestamp with time zone,
  tech_stack text[],
  total_raised_usd numeric,
  last_funding_round text,
  last_funding_date date,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count first (without pagination)
  SELECT COUNT(*)
  INTO v_total_count
  FROM accounts a
  LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
  WHERE a.org_id = p_org_id
    AND (p_search_term IS NULL OR a.name ILIKE '%' || p_search_term || '%' OR a.domain ILIKE '%' || p_search_term || '%')
    AND (p_industry IS NULL OR a.industry_norm = p_industry)
    AND (p_country IS NULL OR a.country = p_country)
    AND (
      p_data_source IS NULL 
      OR (p_data_source = 'crm' AND a.data_source IN ('crm', 'both', 'closed_won'))
      OR (p_data_source = 'database' AND a.data_source = 'database')
    )
    AND (p_fit_min IS NULL OR s.overall >= p_fit_min)
    AND (p_fit_max IS NULL OR s.overall <= p_fit_max)
    AND (NOT p_campaign_ready OR EXISTS (
      SELECT 1 FROM "Leads" l 
      WHERE l.account_external_id = a.external_id 
      AND l.org_id = a.org_id
    ));

  -- Return paginated results with dynamic sort
  RETURN QUERY EXECUTE format(
    'SELECT 
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
      a.last_funding_date::date,
      $1::bigint as total_count
    FROM accounts a
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE a.org_id = $2
      AND ($3::text IS NULL OR a.name ILIKE ''%%'' || $3 || ''%%'' OR a.domain ILIKE ''%%'' || $3 || ''%%'')
      AND ($4::text IS NULL OR a.industry_norm = $4)
      AND ($5::text IS NULL OR a.country = $5)
      AND (
        $6::text IS NULL 
        OR ($6 = ''crm'' AND a.data_source IN (''crm'', ''both'', ''closed_won''))
        OR ($6 = ''database'' AND a.data_source = ''database'')
      )
      AND ($7::integer IS NULL OR s.overall >= $7)
      AND ($8::integer IS NULL OR s.overall <= $8)
      AND (NOT $9::boolean OR EXISTS (
        SELECT 1 FROM "Leads" l 
        WHERE l.account_external_id = a.external_id 
        AND l.org_id = a.org_id
      ))
      AND ($10::timestamp with time zone IS NULL OR a.updated_at < $10)
    ORDER BY %I %s
    LIMIT $11',
    CASE p_sort_field
      WHEN 'name' THEN 'a.name'
      WHEN 'industry_norm' THEN 'a.industry_norm'
      WHEN 'country' THEN 'a.country'
      WHEN 'score' THEN 's.overall'
      WHEN 'updated_at' THEN 'a.updated_at'
      ELSE 'a.updated_at'
    END,
    CASE WHEN p_sort_direction = 'asc' THEN 'ASC' ELSE 'DESC' END
  )
  USING v_total_count, p_org_id, p_search_term, p_industry, p_country, p_data_source, p_fit_min, p_fit_max, p_campaign_ready, p_cursor, p_limit;
END;
$$;

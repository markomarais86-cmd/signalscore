-- Fix get_filtered_accounts to return overall_score and optimize performance
CREATE OR REPLACE FUNCTION get_filtered_accounts(
  p_org_id uuid,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 25,
  p_search_term text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_data_source text DEFAULT NULL,
  p_fit_min int DEFAULT NULL,
  p_fit_max int DEFAULT NULL,
  p_campaign_ready boolean DEFAULT false
)
RETURNS TABLE(
  external_id text,
  name text,
  domain text,
  industry_norm text,
  country text,
  overall_score int,
  cursor text,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count first (without pagination)
  SELECT COUNT(DISTINCT a.external_id)
  INTO v_total_count
  FROM accounts a
  LEFT JOIN account_scores ascore ON a.external_id = ascore.account_external_id AND a.org_id = ascore.org_id
  WHERE a.org_id = p_org_id
    AND (p_search_term IS NULL OR a.name ILIKE '%' || p_search_term || '%' OR a.domain ILIKE '%' || p_search_term || '%')
    AND (p_industry IS NULL OR a.industry_norm = p_industry)
    AND (p_country IS NULL OR a.country = p_country)
    AND (p_data_source IS NULL OR a.data_source = p_data_source)
    AND (p_fit_min IS NULL OR ascore.overall_score >= p_fit_min)
    AND (p_fit_max IS NULL OR ascore.overall_score <= p_fit_max)
    AND (NOT p_campaign_ready OR EXISTS (
      SELECT 1 FROM leads l 
      WHERE l.account_external_id = a.external_id 
        AND l.org_id = a.org_id 
        AND l.email IS NOT NULL 
        AND l.email_verified = true
    ));

  -- Return paginated results with scores
  RETURN QUERY
  SELECT 
    a.external_id,
    a.name,
    a.domain,
    a.industry_norm,
    a.country,
    COALESCE(ascore.overall_score, 0) as overall_score,
    a.external_id as cursor,
    v_total_count as total_count
  FROM accounts a
  LEFT JOIN account_scores ascore ON a.external_id = ascore.account_external_id AND a.org_id = ascore.org_id
  WHERE a.org_id = p_org_id
    AND (p_cursor IS NULL OR a.external_id > p_cursor)
    AND (p_search_term IS NULL OR a.name ILIKE '%' || p_search_term || '%' OR a.domain ILIKE '%' || p_search_term || '%')
    AND (p_industry IS NULL OR a.industry_norm = p_industry)
    AND (p_country IS NULL OR a.country = p_country)
    AND (p_data_source IS NULL OR a.data_source = p_data_source)
    AND (p_fit_min IS NULL OR ascore.overall_score >= p_fit_min)
    AND (p_fit_max IS NULL OR ascore.overall_score <= p_fit_max)
    AND (NOT p_campaign_ready OR EXISTS (
      SELECT 1 FROM leads l 
      WHERE l.account_external_id = a.external_id 
        AND l.org_id = a.org_id 
        AND l.email IS NOT NULL 
        AND l.email_verified = true
    ))
  ORDER BY a.external_id
  LIMIT p_limit;
END;
$$;
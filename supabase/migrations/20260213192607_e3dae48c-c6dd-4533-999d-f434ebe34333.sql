
-- Fix: cast enrichment_overall_score to numeric to match return type
CREATE OR REPLACE FUNCTION public.get_filtered_accounts(
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
  last_funding_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    a.enrichment_overall_score::numeric,
    a.icp_qualified,
    a.deep_research_requested,
    a.deep_research_completed_at,
    a.tech_stack,
    a.total_raised_usd::numeric,
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

-- Insert onboarding config for LaunchPulse with active status
INSERT INTO org_onboarding_config (org_id, company_name, onboarding_status)
VALUES ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'Launchpulse', 'active')
ON CONFLICT (org_id) DO UPDATE SET onboarding_status = 'active';

-- Update Ninety One Life status to active since it has been onboarded
UPDATE org_onboarding_config 
SET onboarding_status = 'active' 
WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';

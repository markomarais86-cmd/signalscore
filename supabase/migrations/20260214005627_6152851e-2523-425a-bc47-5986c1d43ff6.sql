
-- Create the search_list_builder RPC function for server-side prospecting search
CREATE OR REPLACE FUNCTION public.search_list_builder(
  p_org_id UUID,
  p_industries TEXT[] DEFAULT NULL,
  p_revenue_buckets TEXT[] DEFAULT NULL,
  p_employee_min INT DEFAULT NULL,
  p_employee_max INT DEFAULT NULL,
  p_countries TEXT[] DEFAULT NULL,
  p_states TEXT[] DEFAULT NULL,
  p_cities TEXT[] DEFAULT NULL,
  p_business_models TEXT[] DEFAULT NULL,
  p_title_keywords TEXT DEFAULT NULL,
  p_personas TEXT[] DEFAULT NULL,
  p_levels TEXT[] DEFAULT NULL,
  p_has_email BOOLEAN DEFAULT NULL,
  p_has_phone BOOLEAN DEFAULT NULL,
  p_page_offset INT DEFAULT 0,
  p_page_limit INT DEFAULT 50
)
RETURNS TABLE(
  account_id UUID,
  external_id TEXT,
  account_name TEXT,
  industry TEXT,
  revenue_range TEXT,
  revenue_bucket TEXT,
  employee_count INT,
  country TEXT,
  state_province TEXT,
  city TEXT,
  domain TEXT,
  business_model TEXT,
  icp_qualified BOOLEAN,
  lead_count BIGINT,
  total_accounts BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH revenue_normalized AS (
    SELECT 
      a.id AS acc_id,
      a.external_id,
      a.name,
      a.industry_norm,
      a.revenue_range AS raw_revenue,
      CASE
        WHEN a.revenue_range IS NULL THEN 'Unknown'
        WHEN a.revenue_range ~* '(\$?\d+\.?\d*)\s*(b|billion)' THEN '$1B+'
        WHEN a.revenue_range ~* '500.*m|[5-9]\d{2}.*m' THEN '$500M-$1B'
        WHEN a.revenue_range ~* '100.*m|[1-4]\d{2}.*m' THEN '$100M-$500M'
        WHEN a.revenue_range ~* '50.*m|[5-9]\d.*m' THEN '$50M-$100M'
        WHEN a.revenue_range ~* '10.*m|[1-4]\d.*m' THEN '$10M-$50M'
        WHEN a.revenue_range ~* '1.*m|[1-9].*m' THEN '$1M-$10M'
        WHEN a.revenue_range ~* 'k|thousand|hundred' THEN '<$1M'
        WHEN a.revenue_range ~* '^\$?(\d{1,3}(,\d{3})*)' THEN
          CASE
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 1000000000 THEN '$1B+'
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 500000000 THEN '$500M-$1B'
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 100000000 THEN '$100M-$500M'
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 50000000 THEN '$50M-$100M'
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 10000000 THEN '$10M-$50M'
            WHEN REPLACE(REPLACE(REGEXP_REPLACE(a.revenue_range, '[^0-9,]', '', 'g'), ',', ''), ' ', '')::BIGINT >= 1000000 THEN '$1M-$10M'
            ELSE '<$1M'
          END
        ELSE 'Unknown'
      END AS rev_bucket,
      a.employee_count,
      a.country,
      a.state_province,
      a.city,
      a.domain,
      a.business_model,
      a.icp_qualified
    FROM accounts a
    WHERE a.org_id = p_org_id
  ),
  filtered_accounts AS (
    SELECT rn.*
    FROM revenue_normalized rn
    WHERE
      (p_industries IS NULL OR rn.industry_norm ILIKE ANY(
        SELECT '%' || unnest || '%' FROM unnest(p_industries)
      ))
      AND (p_revenue_buckets IS NULL OR rn.rev_bucket = ANY(p_revenue_buckets))
      AND (p_employee_min IS NULL OR rn.employee_count >= p_employee_min)
      AND (p_employee_max IS NULL OR rn.employee_count <= p_employee_max)
      AND (p_countries IS NULL OR rn.country ILIKE ANY(p_countries))
      AND (p_states IS NULL OR rn.state_province ILIKE ANY(p_states))
      AND (p_cities IS NULL OR rn.city ILIKE ANY(p_cities))
      AND (p_business_models IS NULL OR rn.business_model ILIKE ANY(p_business_models))
  ),
  lead_filtered AS (
    SELECT 
      fa.acc_id,
      COUNT(l.id) AS lcount
    FROM filtered_accounts fa
    LEFT JOIN "Leads" l ON l.account_external_id = fa.external_id 
      AND l.org_id = p_org_id
      AND (p_title_keywords IS NULL OR l.title ILIKE '%' || p_title_keywords || '%')
      AND (p_personas IS NULL OR l.persona = ANY(p_personas))
      AND (p_levels IS NULL OR l.level = ANY(p_levels))
      AND (p_has_email IS NULL OR (p_has_email = TRUE AND l.email IS NOT NULL AND l.email != '') OR (p_has_email = FALSE))
      AND (p_has_phone IS NULL OR (p_has_phone = TRUE AND l.phone IS NOT NULL AND l.phone != '') OR (p_has_phone = FALSE))
    GROUP BY fa.acc_id
    HAVING 
      -- If any people filter is set, require at least 1 matching lead
      (p_title_keywords IS NULL AND p_personas IS NULL AND p_levels IS NULL AND p_has_email IS NULL AND p_has_phone IS NULL)
      OR COUNT(l.id) > 0
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM lead_filtered
  )
  SELECT 
    fa.acc_id AS account_id,
    fa.external_id,
    fa.name AS account_name,
    fa.industry_norm AS industry,
    fa.raw_revenue AS revenue_range,
    fa.rev_bucket AS revenue_bucket,
    fa.employee_count,
    fa.country,
    fa.state_province,
    fa.city,
    fa.domain,
    fa.business_model,
    fa.icp_qualified,
    lf.lcount AS lead_count,
    t.cnt AS total_accounts
  FROM filtered_accounts fa
  JOIN lead_filtered lf ON lf.acc_id = fa.acc_id
  CROSS JOIN total t
  ORDER BY lf.lcount DESC, fa.name ASC
  OFFSET p_page_offset
  LIMIT p_page_limit;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_org_industry ON accounts(org_id, industry_norm);
CREATE INDEX IF NOT EXISTS idx_accounts_org_country ON accounts(org_id, country);
CREATE INDEX IF NOT EXISTS idx_accounts_org_employee ON accounts(org_id, employee_count);
CREATE INDEX IF NOT EXISTS idx_leads_account_ext_id ON "Leads"(account_external_id, org_id);
CREATE INDEX IF NOT EXISTS idx_leads_persona ON "Leads"(org_id, persona);
CREATE INDEX IF NOT EXISTS idx_leads_level ON "Leads"(org_id, level);

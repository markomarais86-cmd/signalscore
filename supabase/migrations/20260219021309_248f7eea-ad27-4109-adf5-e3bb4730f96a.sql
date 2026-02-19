
-- ============================================================
-- Server-side aggregation RPCs for board report generation
-- Bypasses Supabase PostgREST 1000-row limit
-- ============================================================

-- 1. Industry breakdown with score JOIN
CREATE OR REPLACE FUNCTION public.get_industry_breakdown(
  p_org_id uuid,
  p_score_org_id uuid
)
RETURNS TABLE(
  industry_name text,
  account_count bigint,
  high_fit_count bigint,
  total_score bigint,
  scored_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(a.industry_norm, 'Unknown') AS industry_name,
    COUNT(*)::bigint AS account_count,
    COUNT(*) FILTER (WHERE s.fit >= 60)::bigint AS high_fit_count,
    COALESCE(SUM(s.overall), 0)::bigint AS total_score,
    COUNT(s.id)::bigint AS scored_count
  FROM accounts a
  LEFT JOIN scores s
    ON s.account_external_id = a.external_id
    AND s.org_id = p_score_org_id
  WHERE a.org_id = p_org_id
  GROUP BY COALESCE(a.industry_norm, 'Unknown')
  ORDER BY high_fit_count DESC, account_count DESC;
$$;

-- 2. Geography breakdown with score JOIN
CREATE OR REPLACE FUNCTION public.get_geography_breakdown(
  p_org_id uuid,
  p_score_org_id uuid
)
RETURNS TABLE(
  country_name text,
  account_count bigint,
  total_score bigint,
  scored_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(a.country, 'Unknown') AS country_name,
    COUNT(*)::bigint AS account_count,
    COALESCE(SUM(s.overall), 0)::bigint AS total_score,
    COUNT(s.id)::bigint AS scored_count
  FROM accounts a
  LEFT JOIN scores s
    ON s.account_external_id = a.external_id
    AND s.org_id = p_score_org_id
  WHERE a.org_id = p_org_id
  GROUP BY COALESCE(a.country, 'Unknown')
  ORDER BY account_count DESC;
$$;

-- 3. Size (employee count) breakdown
CREATE OR REPLACE FUNCTION public.get_size_breakdown(
  p_org_id uuid
)
RETURNS TABLE(
  size_bucket text,
  account_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN employee_count IS NULL THEN 'Unknown'
      WHEN employee_count <= 10 THEN '1-10'
      WHEN employee_count <= 50 THEN '11-50'
      WHEN employee_count <= 200 THEN '51-200'
      WHEN employee_count <= 1000 THEN '201-1000'
      WHEN employee_count <= 5000 THEN '1001-5000'
      ELSE '5000+'
    END AS size_bucket,
    COUNT(*)::bigint AS account_count
  FROM accounts
  WHERE org_id = p_org_id
  GROUP BY size_bucket
  ORDER BY account_count DESC;
$$;

-- 4. Revenue range breakdown
CREATE OR REPLACE FUNCTION public.get_revenue_range_breakdown(
  p_org_id uuid
)
RETURNS TABLE(
  range_name text,
  account_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(revenue_range, 'Unknown') AS range_name,
    COUNT(*)::bigint AS account_count
  FROM accounts
  WHERE org_id = p_org_id
  GROUP BY COALESCE(revenue_range, 'Unknown')
  ORDER BY account_count DESC;
$$;

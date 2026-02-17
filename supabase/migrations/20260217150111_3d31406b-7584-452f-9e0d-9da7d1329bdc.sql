
-- 1. Fix get_enriched_leads_metrics: rename output alias to avoid ambiguity with column name
CREATE OR REPLACE FUNCTION public.get_enriched_leads_metrics(p_org_id text)
RETURNS TABLE(
  total_enriched bigint,
  high_confidence bigint,
  phone_discovered bigint,
  email_verified_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_enriched,
    COUNT(*) FILTER (WHERE "Leads".enrichment_confidence >= 80)::bigint AS high_confidence,
    COUNT(*) FILTER (WHERE "Leads".direct_phone IS NOT NULL OR "Leads".phone IS NOT NULL OR "Leads".mobile IS NOT NULL)::bigint AS phone_discovered,
    COUNT(*) FILTER (WHERE "Leads".email_verified = true)::bigint AS email_verified_count
  FROM "Leads"
  WHERE "Leads".org_id = p_org_id
    AND "Leads".enriched_at IS NOT NULL;
END;
$$;

-- 2. Fix get_filtered_accounts: change %I column references to remove table alias prefixes
CREATE OR REPLACE FUNCTION public.get_filtered_accounts(
  p_org_id text,
  p_search text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_icp_qualified boolean DEFAULT NULL,
  p_min_score numeric DEFAULT NULL,
  p_max_score numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'updated_at',
  p_sort_direction text DEFAULT 'desc',
  p_cursor_id text DEFAULT NULL,
  p_cursor_value text DEFAULT NULL,
  p_page_size integer DEFAULT 25
)
RETURNS TABLE(
  id text,
  external_id text,
  name text,
  domain text,
  industry_norm text,
  employee_count integer,
  revenue_range text,
  country text,
  icp_qualified boolean,
  enriched_at timestamptz,
  updated_at timestamptz,
  propensity_score numeric,
  enrichment_confidence numeric,
  overall_score numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_col text;
  v_sort_dir text;
  v_query text;
BEGIN
  -- Validate sort direction
  v_sort_dir := CASE WHEN lower(p_sort_direction) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  
  -- Map sort field to actual column (no table alias - will be added in query template)
  v_sort_col := CASE lower(p_sort_field)
    WHEN 'name' THEN 'name'
    WHEN 'industry' THEN 'industry_norm'
    WHEN 'employee_count' THEN 'employee_count'
    WHEN 'propensity_score' THEN 'propensity_score'
    WHEN 'enrichment_confidence' THEN 'enrichment_confidence'
    WHEN 'enriched_at' THEN 'enriched_at'
    WHEN 'overall_score' THEN 'overall_score'
    ELSE 'updated_at'
  END;

  v_query := format(
    'SELECT 
      a.id::text,
      a.external_id::text,
      a.name::text,
      a.domain::text,
      a.industry_norm::text,
      a.employee_count::integer,
      a.revenue_range::text,
      a.country::text,
      a.icp_qualified::boolean,
      a.enriched_at::timestamptz,
      a.updated_at::timestamptz,
      a.propensity_score::numeric,
      a.enrichment_confidence::numeric,
      COALESCE(s.overall, 0)::numeric AS overall_score,
      COUNT(*) OVER()::bigint AS total_count
    FROM accounts a
    LEFT JOIN LATERAL (
      SELECT (content->>''overall'')::numeric AS overall
      FROM account_insights
      WHERE account_insights.account_external_id = a.external_id
        AND account_insights.org_id = a.org_id
        AND account_insights.insight_type = ''propensity''
      ORDER BY generated_at DESC
      LIMIT 1
    ) s ON true
    WHERE a.org_id = %L',
    p_org_id
  );

  -- Add filters
  IF p_search IS NOT NULL AND p_search != '' THEN
    v_query := v_query || format(' AND (a.name ILIKE %L OR a.domain ILIKE %L OR a.external_id ILIKE %L)',
      '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
  END IF;

  IF p_industry IS NOT NULL AND p_industry != '' AND p_industry != 'all' THEN
    v_query := v_query || format(' AND a.industry_norm = %L', p_industry);
  END IF;

  IF p_icp_qualified IS NOT NULL THEN
    v_query := v_query || format(' AND a.icp_qualified = %L', p_icp_qualified);
  END IF;

  IF p_min_score IS NOT NULL THEN
    v_query := v_query || format(' AND COALESCE(a.propensity_score, 0) >= %L', p_min_score);
  END IF;

  IF p_max_score IS NOT NULL THEN
    v_query := v_query || format(' AND COALESCE(a.propensity_score, 0) <= %L', p_max_score);
  END IF;

  -- Cursor-based pagination
  IF p_cursor_id IS NOT NULL AND p_cursor_value IS NOT NULL THEN
    IF v_sort_col = 'overall_score' THEN
      -- For overall_score, we need to reference the lateral join
      IF v_sort_dir = 'DESC' THEN
        v_query := v_query || format(' AND (COALESCE(s.overall, 0) < %L::numeric OR (COALESCE(s.overall, 0) = %L::numeric AND a.id < %L))',
          p_cursor_value, p_cursor_value, p_cursor_id);
      ELSE
        v_query := v_query || format(' AND (COALESCE(s.overall, 0) > %L::numeric OR (COALESCE(s.overall, 0) = %L::numeric AND a.id > %L))',
          p_cursor_value, p_cursor_value, p_cursor_id);
      END IF;
    ELSE
      IF v_sort_dir = 'DESC' THEN
        v_query := v_query || format(' AND (a.%I < %L OR (a.%I = %L AND a.id < %L))',
          v_sort_col, p_cursor_value, v_sort_col, p_cursor_value, p_cursor_id);
      ELSE
        v_query := v_query || format(' AND (a.%I > %L OR (a.%I = %L AND a.id > %L))',
          v_sort_col, p_cursor_value, v_sort_col, p_cursor_value, p_cursor_id);
      END IF;
    END IF;
  END IF;

  -- Sorting
  IF v_sort_col = 'overall_score' THEN
    v_query := v_query || format(' ORDER BY COALESCE(s.overall, 0) %s NULLS LAST, a.id %s', v_sort_dir, v_sort_dir);
  ELSE
    v_query := v_query || format(' ORDER BY a.%I %s NULLS LAST, a.id %s', v_sort_col, v_sort_dir, v_sort_dir);
  END IF;

  v_query := v_query || format(' LIMIT %L', p_page_size);

  RETURN QUERY EXECUTE v_query;
END;
$$;

-- 3. Drop the old overload with text cursor that causes ambiguity (if it exists)
DROP FUNCTION IF EXISTS public.get_filtered_accounts(text, text, text, boolean, numeric, numeric, text, text, text, integer);

-- 4. Add index on Leads(org_id) for get_leads_metrics performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON "Leads"(org_id);

-- 5. Add composite index for enriched leads queries
CREATE INDEX IF NOT EXISTS idx_leads_org_enriched ON "Leads"(org_id, enriched_at) WHERE enriched_at IS NOT NULL;

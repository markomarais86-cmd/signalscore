
-- Fix estimate_icp_matches to use range-based matching for employee counts
-- and flexible matching for revenue ranges

CREATE OR REPLACE FUNCTION public.estimate_icp_matches(
  p_org_id uuid, 
  p_industries text[] DEFAULT NULL::text[], 
  p_sizes integer[] DEFAULT NULL::integer[], 
  p_revenues text[] DEFAULT NULL::text[], 
  p_countries text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_count integer;
  total_count integer;
  percentage numeric;
  min_size integer;
BEGIN
  -- Get total accounts
  SELECT COUNT(*) INTO total_count
  FROM accounts
  WHERE org_id = p_org_id;
  
  -- Get minimum size threshold if sizes provided
  IF p_sizes IS NOT NULL AND array_length(p_sizes, 1) > 0 THEN
    SELECT MIN(x) INTO min_size FROM unnest(p_sizes) AS x;
  ELSE
    min_size := NULL;
  END IF;
  
  -- Count matches based on provided criteria
  -- FIXED: Use >= for employee count (range-based matching)
  -- FIXED: Use flexible revenue matching with ILIKE patterns
  SELECT COUNT(*) INTO match_count
  FROM accounts a
  WHERE a.org_id = p_org_id
    -- Industry matching (exact or sub-industry via ILIKE)
    AND (
      p_industries IS NULL 
      OR array_length(p_industries, 1) = 0 
      OR a.industry_norm = ANY(p_industries)
      OR EXISTS (
        SELECT 1 FROM unnest(p_industries) ind 
        WHERE a.industry_norm ILIKE '%' || ind || '%'
        OR ind ILIKE '%' || a.industry_norm || '%'
      )
    )
    -- Employee count: >= minimum threshold (range-based)
    AND (
      min_size IS NULL 
      OR a.employee_count >= min_size
    )
    -- Revenue range: flexible matching to handle format differences
    AND (
      p_revenues IS NULL 
      OR array_length(p_revenues, 1) = 0 
      OR a.revenue_range = ANY(p_revenues)
      OR EXISTS (
        SELECT 1 FROM unnest(p_revenues) rev
        WHERE 
          -- Match if database value starts with ICP value (handles $10M-$25M matching $10M)
          a.revenue_range ILIKE rev || '%'
          -- Match if ICP value starts with database value
          OR rev ILIKE a.revenue_range || '%'
          -- Handle $1B+ matching $1B-$10B, $10B+
          OR (rev = '$1B+' AND (a.revenue_range ILIKE '$1B%' OR a.revenue_range ILIKE '$10B%'))
          -- Handle <$1M variations
          OR (rev = '<$1M' AND a.revenue_range IN ('<$1M', '$0-$1M', 'Under $1M'))
          -- Normalize and compare core values
          OR REPLACE(REPLACE(a.revenue_range, ' ', ''), '-', ' - ') = REPLACE(REPLACE(rev, ' ', ''), '-', ' - ')
      )
    )
    -- Country matching
    AND (
      p_countries IS NULL 
      OR array_length(p_countries, 1) = 0 
      OR a.country = ANY(p_countries)
    );
  
  -- Calculate percentage
  percentage := CASE 
    WHEN total_count > 0 THEN ROUND((match_count::numeric / total_count) * 100, 1)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'total', match_count,
    'percentage', percentage,
    'total_accounts', total_count,
    'min_employee_threshold', min_size
  );
END;
$function$;

-- Add a helper function to normalize revenue for consistent matching
CREATE OR REPLACE FUNCTION public.revenue_to_numeric(revenue_range text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF revenue_range IS NULL OR revenue_range = '' THEN
    RETURN 0;
  END IF;
  
  -- Extract the lower bound number
  RETURN CASE
    WHEN revenue_range ILIKE '%$10B%' THEN 10000000000
    WHEN revenue_range ILIKE '%$1B%' THEN 1000000000
    WHEN revenue_range ILIKE '%$500M%' THEN 500000000
    WHEN revenue_range ILIKE '%$250M%' THEN 250000000
    WHEN revenue_range ILIKE '%$100M%' THEN 100000000
    WHEN revenue_range ILIKE '%$50M%' THEN 50000000
    WHEN revenue_range ILIKE '%$25M%' THEN 25000000
    WHEN revenue_range ILIKE '%$10M%' THEN 10000000
    WHEN revenue_range ILIKE '%$5M%' THEN 5000000
    WHEN revenue_range ILIKE '%$1M%' THEN 1000000
    WHEN revenue_range ILIKE '%<$1M%' OR revenue_range ILIKE '%under%' THEN 500000
    ELSE 0
  END;
END;
$function$;

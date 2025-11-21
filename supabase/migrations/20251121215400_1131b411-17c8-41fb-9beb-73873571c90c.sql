-- Function to estimate ICP matches in real-time
CREATE OR REPLACE FUNCTION estimate_icp_matches(
  p_org_id uuid,
  p_industries text[] DEFAULT NULL,
  p_sizes integer[] DEFAULT NULL,
  p_revenues text[] DEFAULT NULL,
  p_countries text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_count integer;
  total_count integer;
  percentage numeric;
BEGIN
  -- Get total accounts
  SELECT COUNT(*) INTO total_count
  FROM accounts
  WHERE org_id = p_org_id;
  
  -- Count matches based on provided criteria
  SELECT COUNT(*) INTO match_count
  FROM accounts
  WHERE org_id = p_org_id
    AND (p_industries IS NULL OR array_length(p_industries, 1) = 0 OR industry_norm = ANY(p_industries))
    AND (p_sizes IS NULL OR array_length(p_sizes, 1) = 0 OR employee_count = ANY(p_sizes))
    AND (p_revenues IS NULL OR array_length(p_revenues, 1) = 0 OR revenue_range = ANY(p_revenues))
    AND (p_countries IS NULL OR array_length(p_countries, 1) = 0 OR country = ANY(p_countries));
  
  -- Calculate percentage
  percentage := CASE 
    WHEN total_count > 0 THEN ROUND((match_count::numeric / total_count) * 100, 1)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'total', match_count,
    'percentage', percentage,
    'total_accounts', total_count
  );
END;
$$;
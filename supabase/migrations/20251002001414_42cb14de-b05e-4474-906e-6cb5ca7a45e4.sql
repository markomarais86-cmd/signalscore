-- Drop and recreate the calculate_account_score function with improved matching logic
DROP FUNCTION IF EXISTS public.calculate_account_score(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.calculate_account_score(
  account_external_id text, 
  icp_id uuid, 
  org_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  industry_score integer := 0;
  size_score integer := 0;
  geo_score integer := 0;
  revenue_score integer := 0;
  total_score integer := 0;
  fit_score integer := 0;
  matches integer := 0;
BEGIN
  -- Validate org_id matches current user's org
  IF org_id_param != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Get account data
  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = account_external_id AND org_id = org_id_param;
  
  -- Get ICP data  
  SELECT * INTO icp_rec 
  FROM public.icp_profiles 
  WHERE id = icp_id AND org_id = org_id_param;
  
  -- Return 0 scores if no data found
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object(
      'overall', 0,
      'fit', 0,
      'intent', 0,
      'reachability', 0,
      'breakdown', jsonb_build_object(
        'industry_score', 0,
        'size_score', 0,
        'geo_score', 0,
        'revenue_score', 0
      )
    );
  END IF;
  
  -- Industry scoring (30 points) - case insensitive partial matching
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) AS icp_industry
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(icp_industry) || '%'
         OR LOWER(icp_industry) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      industry_score := 30;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Size scoring (25 points) - flexible range matching
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) 
       OR (account_rec.employee_count >= 100 AND 200 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 400 AND 500 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 800 AND 1000 = ANY(icp_rec.company_sizes)) THEN
      size_score := 25;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Geography scoring (25 points) - case insensitive
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.geographies) AS icp_geo
      WHERE LOWER(account_rec.country) = LOWER(icp_geo)
    ) THEN
      geo_score := 25;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Revenue scoring (20 points) - exact match for now
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 20;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Calculate totals
  total_score := industry_score + size_score + geo_score + revenue_score;
  
  -- Boost score if multiple criteria match (compound effect)
  IF matches >= 3 THEN
    total_score := LEAST(100, total_score + 10);
  END IF;
  
  fit_score := total_score;
  
  RETURN jsonb_build_object(
    'overall', total_score,
    'fit', fit_score,
    'intent', 50,
    'reachability', 70,
    'breakdown', jsonb_build_object(
      'industry_score', industry_score,
      'size_score', size_score,
      'geo_score', geo_score,
      'revenue_score', revenue_score,
      'matches', matches
    )
  );
END;
$$;
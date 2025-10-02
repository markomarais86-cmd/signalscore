-- Drop and recreate calculate_account_score with data-quality-aware scoring
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
  data_fields integer := 0;
  bonus_multiplier numeric := 1.0;
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
  
  -- Count available data fields
  IF account_rec.industry_norm IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.employee_count IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.country IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.revenue_range IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  
  -- Industry scoring (40 points) - PRIMARY CRITERIA
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) AS icp_industry
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(icp_industry) || '%'
         OR LOWER(icp_industry) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      industry_score := 40;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Geography scoring (35 points) - PRIMARY CRITERIA
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.geographies) AS icp_geo
      WHERE LOWER(account_rec.country) = LOWER(icp_geo)
    ) THEN
      geo_score := 35;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Size scoring (15 points) - BONUS CRITERIA
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) 
       OR (account_rec.employee_count >= 100 AND account_rec.employee_count < 300 AND 200 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 300 AND account_rec.employee_count < 700 AND 500 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 700 AND 1000 = ANY(icp_rec.company_sizes)) THEN
      size_score := 15;
      matches := matches + 1;
    END IF;
  ELSIF account_rec.employee_count IS NULL AND industry_score > 0 AND geo_score > 0 THEN
    -- Give partial credit if industry and geography match but size data is missing
    size_score := 8;
  END IF;
  
  -- Revenue scoring (10 points) - BONUS CRITERIA
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 10;
      matches := matches + 1;
    END IF;
  ELSIF account_rec.revenue_range IS NULL AND industry_score > 0 AND geo_score > 0 THEN
    -- Give partial credit if industry and geography match but revenue data is missing
    revenue_score := 5;
  END IF;
  
  -- Calculate base score
  total_score := industry_score + size_score + geo_score + revenue_score;
  
  -- Apply data quality multiplier (boost scores for accounts with complete data)
  IF data_fields >= 3 THEN
    bonus_multiplier := 1.1;
  END IF;
  
  -- Apply compound matching bonus (matching multiple criteria is worth more)
  IF matches >= 2 THEN
    total_score := LEAST(100, FLOOR(total_score * bonus_multiplier) + 5);
  ELSIF matches >= 3 THEN
    total_score := LEAST(100, FLOOR(total_score * bonus_multiplier) + 10);
  ELSE
    total_score := FLOOR(total_score * bonus_multiplier);
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
      'matches', matches,
      'data_fields', data_fields
    )
  );
END;
$$;
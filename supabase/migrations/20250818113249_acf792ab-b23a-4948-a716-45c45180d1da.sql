-- Fix critical security issues with functions and materialized views

-- 1. Fix calculate_account_score function with proper security
CREATE OR REPLACE FUNCTION public.calculate_account_score(account_external_id text, icp_id uuid, org_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  industry_score integer := 0;
  size_score integer := 0;
  geo_score integer := 0;
  revenue_score integer := 0;
  total_score integer := 0;
  fit_score integer := 0;
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
  
  -- Industry scoring
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF account_rec.industry_norm = ANY(icp_rec.industries) THEN
      industry_score := 25;
    END IF;
  END IF;
  
  -- Size scoring
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) THEN
      size_score := 25;
    END IF;
  END IF;
  
  -- Geography scoring
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF account_rec.country = ANY(icp_rec.geographies) THEN
      geo_score := 25;
    END IF;
  END IF;
  
  -- Revenue scoring
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 25;
    END IF;
  END IF;
  
  -- Calculate totals
  total_score := industry_score + size_score + geo_score + revenue_score;
  fit_score := total_score;
  
  RETURN jsonb_build_object(
    'overall', total_score,
    'fit', fit_score,
    'intent', 50, -- Default intent score
    'reachability', 70, -- Default reachability score
    'breakdown', jsonb_build_object(
      'industry_score', industry_score,
      'size_score', size_score,
      'geo_score', geo_score,
      'revenue_score', revenue_score
    )
  );
END;
$function$;

-- 2. Fix refresh_reporting_views function with proper security
CREATE OR REPLACE FUNCTION public.refresh_reporting_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins to refresh views
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  REFRESH MATERIALIZED VIEW public.mv_score_distribution;
  REFRESH MATERIALIZED VIEW public.mv_leads_by_week;
END;
$function$;

-- 3. Create secure wrapper functions for materialized views
CREATE OR REPLACE FUNCTION public.get_score_distribution()
 RETURNS TABLE(score_range text, count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.mv_score_distribution 
  WHERE org_id = get_current_user_org_id();
$function$;

CREATE OR REPLACE FUNCTION public.get_leads_by_week()
 RETURNS TABLE(week_start date, lead_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.mv_leads_by_week 
  WHERE org_id = get_current_user_org_id();
$function$;

-- 4. Add RLS policies to materialized views if they don't exist
-- Note: Materialized views can't have RLS directly, so we secure access through functions

-- 5. Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.calculate_account_score(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_reporting_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_score_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_by_week() TO authenticated;
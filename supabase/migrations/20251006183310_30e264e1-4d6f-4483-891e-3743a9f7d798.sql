-- Create function to get geography distribution for all accounts
CREATE OR REPLACE FUNCTION public.get_geography_distribution(p_org_id uuid)
RETURNS TABLE(country text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate org_id matches current user
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Return country counts for all accounts
  RETURN QUERY
  SELECT 
    normalize_country(a.country) as country,
    COUNT(*)::bigint as count
  FROM public.accounts a
  WHERE a.org_id = p_org_id
    AND a.country IS NOT NULL
    AND a.country != ''
    -- Filter out phone numbers and invalid data
    AND NOT (a.country ~ '^[\d\s\-\(\)\+\.]+$')
  GROUP BY normalize_country(a.country)
  ORDER BY count DESC;
END;
$function$;
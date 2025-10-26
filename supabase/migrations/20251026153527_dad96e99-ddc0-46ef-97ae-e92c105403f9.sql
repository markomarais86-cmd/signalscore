-- Fix search_path for get_org_enrichment_credits function
CREATE OR REPLACE FUNCTION get_org_enrichment_credits(org_uuid uuid)
RETURNS TABLE (
  total integer,
  used integer,
  remaining integer
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(o.enrichment_credits_total, 1000) as total,
    COALESCE(o.enrichment_credits_used, 0) as used,
    COALESCE(o.enrichment_credits_total, 1000) - COALESCE(o.enrichment_credits_used, 0) as remaining
  FROM public.organizations o
  WHERE o.id = org_uuid;
END;
$$;
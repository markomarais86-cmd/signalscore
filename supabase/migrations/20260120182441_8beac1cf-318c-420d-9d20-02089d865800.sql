-- Fix get_enrichment_stats function to have search_path set
DROP FUNCTION IF EXISTS get_enrichment_stats(uuid);

CREATE FUNCTION get_enrichment_stats(p_org_id uuid)
RETURNS TABLE(
  total_leads bigint,
  enriched_leads bigint,
  leads_with_email bigint,
  leads_with_phone bigint,
  leads_with_title bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL)::bigint as enriched_leads,
    COUNT(*) FILTER (WHERE email IS NOT NULL)::bigint as leads_with_email,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL)::bigint as leads_with_phone,
    COUNT(*) FILTER (WHERE title IS NOT NULL)::bigint as leads_with_title
  FROM "Leads"
  WHERE org_id = p_org_id;
END;
$$;
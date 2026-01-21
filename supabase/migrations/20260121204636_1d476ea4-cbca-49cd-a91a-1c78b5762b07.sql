-- Create optimized RPC for enriched leads metrics (replaces 4 separate queries)
CREATE OR REPLACE FUNCTION get_enriched_leads_metrics(p_org_id UUID)
RETURNS TABLE (
  total_enriched BIGINT,
  high_confidence BIGINT,
  phone_discovered BIGINT,
  email_verified BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) as total_enriched,
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL AND enrichment_confidence >= 80) as high_confidence,
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL AND (direct_phone IS NOT NULL OR phone IS NOT NULL OR mobile IS NOT NULL)) as phone_discovered,
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL AND email_verified = true) as email_verified
  FROM "Leads"
  WHERE org_id = p_org_id;
END;
$$;
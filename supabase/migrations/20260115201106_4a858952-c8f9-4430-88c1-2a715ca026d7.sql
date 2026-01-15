-- Fix the get_leads_metrics function - remove non-existent reachability_score column
CREATE OR REPLACE FUNCTION public.get_leads_metrics(p_org_id uuid)
RETURNS TABLE (
  total_leads bigint,
  icp_qualified_count bigint,
  campaign_ready_count bigint,
  enriched_count bigint,
  linked_to_accounts_count bigint,
  avg_reachability numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE l.icp_qualified = true)::bigint as icp_qualified_count,
    COUNT(*) FILTER (WHERE l.email IS NOT NULL AND l.title IS NOT NULL AND l.persona IS NOT NULL AND l.persona != 'Unknown')::bigint as campaign_ready_count,
    COUNT(*) FILTER (WHERE l.enriched_at IS NOT NULL)::bigint as enriched_count,
    COUNT(*) FILTER (WHERE l.account_external_id IS NOT NULL)::bigint as linked_to_accounts_count,
    0::numeric as avg_reachability -- Placeholder since reachability_score column doesn't exist
  FROM "Leads" l
  WHERE l.org_id = p_org_id;
END;
$$;
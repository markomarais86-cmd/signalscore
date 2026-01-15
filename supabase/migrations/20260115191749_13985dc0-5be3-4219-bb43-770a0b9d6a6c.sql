-- Create function to get leads metrics efficiently at database level
CREATE OR REPLACE FUNCTION public.get_leads_metrics(p_org_id uuid)
RETURNS TABLE (
  total_leads bigint,
  icp_qualified_count bigint,
  campaign_ready_count bigint,
  enriched_count bigint,
  linked_to_accounts_count bigint,
  avg_reachability numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE icp_qualified = true)::bigint as icp_qualified_count,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND title IS NOT NULL AND persona IS NOT NULL AND persona != 'Unknown')::bigint as campaign_ready_count,
    COUNT(*) FILTER (WHERE enriched_at IS NOT NULL)::bigint as enriched_count,
    COUNT(*) FILTER (WHERE account_external_id IS NOT NULL)::bigint as linked_to_accounts_count,
    COALESCE(AVG(reachability_score), 0)::numeric as avg_reachability
  FROM "Leads"
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
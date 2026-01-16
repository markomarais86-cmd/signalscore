-- Create get_enrichment_stats function for server-side enrichment calculations
CREATE OR REPLACE FUNCTION get_enrichment_stats(p_org_id UUID)
RETURNS TABLE(
  total_accounts BIGINT,
  completeness_percent NUMERIC,
  enriched_today BIGINT,
  with_contacts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH account_stats AS (
    SELECT 
      COUNT(*) as total,
      COALESCE(AVG(
        (CASE WHEN a.employee_count IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN a.revenue_range IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN a.industry_norm IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN a.country IS NOT NULL THEN 1 ELSE 0 END) / 4.0 * 100
      ), 0) as completeness,
      COUNT(*) FILTER (WHERE a.enriched_at::date = CURRENT_DATE) as today
    FROM accounts a 
    WHERE a.org_id = p_org_id
  ),
  contact_stats AS (
    SELECT COUNT(DISTINCT l.account_external_id) as with_contact
    FROM "Leads" l
    WHERE l.org_id = p_org_id AND l.account_external_id IS NOT NULL
  )
  SELECT 
    as_stats.total,
    ROUND(as_stats.completeness, 0),
    as_stats.today,
    cs.with_contact
  FROM account_stats as_stats, contact_stats cs;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
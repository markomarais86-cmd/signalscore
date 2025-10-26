-- Fix get_dashboard_metrics_fast function to use correct table name
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalAccounts', COUNT(DISTINCT a.id),
    'totalLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id),
    'scoredAccounts', COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END),
    'highFitAccounts', COUNT(DISTINCT CASE WHEN s.fit >= 70 THEN a.id END),
    'mediumFitAccounts', COUNT(DISTINCT CASE WHEN s.fit >= 40 AND s.fit < 70 THEN a.id END),
    'lowFitAccounts', COUNT(DISTINCT CASE WHEN s.fit < 40 THEN a.id END),
    'campaignReadyAccounts', COUNT(DISTINCT CASE 
      WHEN s.overall >= 60 
      AND EXISTS (
        SELECT 1 FROM contacts c 
        WHERE c.account_external_id = a.external_id 
        AND c.org_id = p_org_id
        AND c.email IS NOT NULL
      ) 
      THEN a.id 
    END),
    'campaignReadyLeads', (
      SELECT COUNT(*) 
      FROM "Leads" l 
      WHERE l.org_id = p_org_id 
      AND l.email IS NOT NULL
    )
  )
  INTO result
  FROM accounts a
  LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_fast(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_metrics_fast IS 'Optimized dashboard metrics query with correct table names';
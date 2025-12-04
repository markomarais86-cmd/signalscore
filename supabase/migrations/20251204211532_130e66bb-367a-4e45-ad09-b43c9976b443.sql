
-- Fix get_dashboard_metrics_fast to join leads with scores table for fit score
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid, p_source_filter text DEFAULT 'crm')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH account_stats AS (
    SELECT 
      COUNT(*)::integer as total_accounts,
      COUNT(CASE WHEN s.fit >= 70 THEN 1 END)::integer as high_fit_accounts,
      COUNT(CASE WHEN s.fit >= 40 AND s.fit < 70 THEN 1 END)::integer as medium_fit_accounts,
      COUNT(CASE WHEN s.fit < 40 THEN 1 END)::integer as low_fit_accounts,
      COUNT(s.id)::integer as scored_accounts
    FROM accounts a
    LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
    WHERE a.org_id = p_org_id
      AND (p_source_filter = 'all' OR 
           (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
           (p_source_filter = 'database' AND a.data_source = 'database'))
  ),
  lead_stats AS (
    SELECT 
      COUNT(*)::integer as total_leads,
      COUNT(CASE WHEN s.fit >= 70 THEN 1 END)::integer as high_fit_leads,
      COUNT(CASE WHEN s.fit >= 40 AND s.fit < 70 THEN 1 END)::integer as medium_fit_leads,
      COUNT(CASE WHEN s.fit < 40 THEN 1 END)::integer as low_fit_leads
    FROM "Leads" l
    LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
    LEFT JOIN scores s ON l.account_external_id = s.account_external_id AND l.org_id = s.org_id
    WHERE l.org_id = p_org_id
      AND (p_source_filter = 'all' OR 
           (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both')) OR
           (p_source_filter = 'database' AND a.data_source = 'database'))
  )
  SELECT jsonb_build_object(
    'total_accounts', COALESCE(a.total_accounts, 0),
    'scored_accounts', COALESCE(a.scored_accounts, 0),
    'high_fit_accounts', COALESCE(a.high_fit_accounts, 0),
    'medium_fit_accounts', COALESCE(a.medium_fit_accounts, 0),
    'low_fit_accounts', COALESCE(a.low_fit_accounts, 0),
    'total_leads', COALESCE(l.total_leads, 0),
    'high_fit_leads', COALESCE(l.high_fit_leads, 0),
    'medium_fit_leads', COALESCE(l.medium_fit_leads, 0),
    'low_fit_leads', COALESCE(l.low_fit_leads, 0)
  ) INTO result
  FROM account_stats a, lead_stats l;

  RETURN result;
END;
$function$;

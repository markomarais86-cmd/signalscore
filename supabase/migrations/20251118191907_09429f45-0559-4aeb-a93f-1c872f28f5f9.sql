-- Drop and recreate get_dashboard_metrics_fast with medium and low fit calculations
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid, p_source_filter text DEFAULT 'all')
RETURNS TABLE(
  total_accounts bigint,
  total_leads bigint,
  high_fit_accounts bigint,
  medium_fit_accounts bigint,
  low_fit_accounts bigint,
  campaign_ready_accounts bigint,
  campaign_ready_contacts bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_accounts AS (
    SELECT a.external_id, a.data_source
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  scored_metrics AS (
    SELECT
      COUNT(DISTINCT s.account_external_id)::bigint AS high_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall >= 40 AND s.overall < 70 THEN s.account_external_id END)::bigint AS medium_fit_accounts,
      COUNT(DISTINCT CASE WHEN s.overall < 40 THEN s.account_external_id END)::bigint AS low_fit_accounts
    FROM scores s
    INNER JOIN filtered_accounts fa ON s.account_external_id = fa.external_id
    WHERE s.org_id = p_org_id AND s.overall >= 70
    
    UNION ALL
    
    SELECT
      0::bigint,
      COUNT(DISTINCT s.account_external_id)::bigint,
      0::bigint
    FROM scores s
    INNER JOIN filtered_accounts fa ON s.account_external_id = fa.external_id
    WHERE s.org_id = p_org_id AND s.overall >= 40 AND s.overall < 70
    
    UNION ALL
    
    SELECT
      0::bigint,
      0::bigint,
      COUNT(DISTINCT s.account_external_id)::bigint
    FROM scores s
    INNER JOIN filtered_accounts fa ON s.account_external_id = fa.external_id
    WHERE s.org_id = p_org_id AND s.overall < 40
  ),
  campaign_metrics AS (
    SELECT
      COUNT(DISTINCT l.account_external_id)::bigint AS campaign_ready_accounts,
      COUNT(DISTINCT l.id)::bigint AS campaign_ready_contacts
    FROM "Leads" l
    INNER JOIN filtered_accounts fa ON l.account_external_id = fa.external_id
    INNER JOIN scores s ON l.account_external_id = s.account_external_id
    WHERE l.org_id = p_org_id
      AND s.org_id = p_org_id
      AND s.overall >= 70
      AND is_lead_campaign_ready(l.email, l.title, l.persona)
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM filtered_accounts) AS total_accounts,
    (SELECT COUNT(*)::bigint FROM "Leads" l INNER JOIN filtered_accounts fa ON l.account_external_id = fa.external_id WHERE l.org_id = p_org_id) AS total_leads,
    COALESCE((SELECT SUM(high_fit_accounts) FROM scored_metrics), 0)::bigint AS high_fit_accounts,
    COALESCE((SELECT SUM(medium_fit_accounts) FROM scored_metrics), 0)::bigint AS medium_fit_accounts,
    COALESCE((SELECT SUM(low_fit_accounts) FROM scored_metrics), 0)::bigint AS low_fit_accounts,
    COALESCE(cm.campaign_ready_accounts, 0)::bigint AS campaign_ready_accounts,
    COALESCE(cm.campaign_ready_contacts, 0)::bigint AS campaign_ready_contacts
  FROM campaign_metrics cm;
END;
$function$;
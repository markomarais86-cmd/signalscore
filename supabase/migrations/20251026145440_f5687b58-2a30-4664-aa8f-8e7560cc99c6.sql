-- Drop and recreate get_dashboard_metrics_fast with complete metrics
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  total_accts integer;
BEGIN
  -- Get total accounts count first for completeness calculation
  SELECT COUNT(*) INTO total_accts
  FROM accounts a
  WHERE a.org_id = p_org_id;

  -- Build comprehensive metrics in a single query
  SELECT jsonb_build_object(
    -- Core counts
    'totalAccounts', COUNT(DISTINCT a.id),
    'totalLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id),
    'scoredAccounts', COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.id END),
    
    -- Fit distribution
    'highFitAccounts', COUNT(DISTINCT CASE WHEN s.fit >= 70 THEN a.id END),
    'mediumFitAccounts', COUNT(DISTINCT CASE WHEN s.fit >= 40 AND s.fit < 70 THEN a.id END),
    'lowFitAccounts', COUNT(DISTINCT CASE WHEN s.fit < 40 THEN a.id END),
    
    -- Data source breakdown for accounts
    'crmAccounts', COUNT(DISTINCT CASE WHEN a.data_source IN ('crm', 'both') THEN a.id END),
    'databaseAccounts', COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN a.id END),
    'bothAccounts', COUNT(DISTINCT CASE WHEN a.data_source = 'both' THEN a.id END),
    
    -- High-fit by source
    'highFitCrmAccounts', COUNT(DISTINCT CASE 
      WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN a.id 
    END),
    'highFitDatabaseAccounts', COUNT(DISTINCT CASE 
      WHEN s.overall >= 70 AND a.data_source = 'database' THEN a.id 
    END),
    
    -- Leads breakdown
    'linkedLeads', (
      SELECT COUNT(*) 
      FROM "Leads" l 
      WHERE l.org_id = p_org_id AND l.account_external_id IS NOT NULL
    ),
    'crmLeads', (
      SELECT COUNT(DISTINCT l.id)
      FROM "Leads" l
      LEFT JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = p_org_id
      WHERE l.org_id = p_org_id
        AND (a.data_source IN ('crm', 'both') OR l.account_external_id IS NULL)
    ),
    'databaseLeads', (
      SELECT COUNT(DISTINCT l.id)
      FROM "Leads" l
      INNER JOIN accounts a ON l.account_external_id = a.external_id
      WHERE l.org_id = p_org_id
        AND a.org_id = p_org_id
        AND a.data_source = 'database'
    ),
    
    -- High-fit leads
    'highFitLeadsTotal', (
      SELECT COUNT(DISTINCT l.id)
      FROM "Leads" l
      INNER JOIN scores s ON l.account_external_id = s.account_external_id
      WHERE l.org_id = p_org_id
        AND s.org_id = p_org_id
        AND s.overall >= 70
    ),
    'highFitCrmLeads', (
      SELECT COUNT(DISTINCT l.id)
      FROM "Leads" l
      INNER JOIN accounts a ON l.account_external_id = a.external_id
      INNER JOIN scores s ON a.external_id = s.account_external_id
      WHERE l.org_id = p_org_id
        AND a.org_id = p_org_id
        AND s.org_id = p_org_id
        AND s.overall >= 70
        AND a.data_source IN ('crm', 'both')
    ),
    'highFitDatabaseLeads', (
      SELECT COUNT(DISTINCT l.id)
      FROM "Leads" l
      INNER JOIN accounts a ON l.account_external_id = a.external_id
      INNER JOIN scores s ON a.external_id = s.account_external_id
      WHERE l.org_id = p_org_id
        AND a.org_id = p_org_id
        AND s.org_id = p_org_id
        AND s.overall >= 70
        AND a.data_source = 'database'
    ),
    
    -- Campaign ready metrics
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
    ),
    
    -- Data completeness
    'dataCompleteness', CASE 
      WHEN total_accts > 0 THEN
        ROUND(
          (
            (SELECT COUNT(*) FROM accounts WHERE org_id = p_org_id AND industry_norm IS NOT NULL)::numeric / total_accts * 25 +
            (SELECT COUNT(*) FROM accounts WHERE org_id = p_org_id AND employee_count IS NOT NULL)::numeric / total_accts * 25 +
            (SELECT COUNT(*) FROM accounts WHERE org_id = p_org_id AND revenue_range IS NOT NULL)::numeric / total_accts * 25 +
            (SELECT COUNT(*) FROM accounts WHERE org_id = p_org_id AND country IS NOT NULL)::numeric / total_accts * 25
          )
        )::integer
      ELSE 0
    END
  )
  INTO result
  FROM accounts a
  LEFT JOIN scores s ON s.account_external_id = a.external_id AND s.org_id = a.org_id
  WHERE a.org_id = p_org_id;
  
  RETURN result;
END;
$function$;
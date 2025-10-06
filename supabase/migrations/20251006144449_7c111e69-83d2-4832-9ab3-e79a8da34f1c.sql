-- Fix count_campaign_ready_accounts to validate email and persona
CREATE OR REPLACE FUNCTION public.count_campaign_ready_accounts(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT a.external_id)::integer INTO v_count
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id
  INNER JOIN contacts c ON a.external_id = c.account_external_id
  WHERE a.org_id = p_org_id
    AND s.org_id = p_org_id
    AND c.org_id = p_org_id
    AND s.overall >= 70
    AND c.email IS NOT NULL
    AND c.email LIKE '%@%'
    AND c.persona IS NOT NULL
    AND c.persona != 'Unknown';
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Fix count_campaign_ready_leads to validate email and persona
CREATE OR REPLACE FUNCTION public.count_campaign_ready_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  INNER JOIN contacts c ON l.account_external_id = c.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND c.org_id = p_org_id
    AND s.overall >= 70
    AND c.email IS NOT NULL
    AND c.email LIKE '%@%'
    AND c.persona IS NOT NULL
    AND c.persona != 'Unknown';
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
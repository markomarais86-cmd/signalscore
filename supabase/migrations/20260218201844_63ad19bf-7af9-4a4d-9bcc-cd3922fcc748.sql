CREATE OR REPLACE FUNCTION public.count_campaign_ready_accounts(p_org_id uuid, p_data_source text DEFAULT NULL)
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
  INNER JOIN "Leads" l ON a.external_id = l.account_external_id
  WHERE a.org_id = p_org_id
    AND s.org_id = p_org_id
    AND l.org_id = p_org_id
    AND s.overall >= 70
    AND (p_data_source IS NULL OR a.data_source = p_data_source)
    AND is_lead_campaign_ready(l.email, l.title, l.persona);
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
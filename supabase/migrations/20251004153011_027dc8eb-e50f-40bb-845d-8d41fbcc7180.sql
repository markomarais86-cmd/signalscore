-- Create function to count leads by account data source
CREATE OR REPLACE FUNCTION public.count_leads_by_account_source(p_org_id uuid, p_data_source text)
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
  INNER JOIN accounts a ON l.account_external_id = a.external_id
  WHERE l.org_id = p_org_id
    AND a.org_id = p_org_id
    AND (
      (p_data_source = 'crm' AND a.data_source IN ('crm', 'both'))
      OR (p_data_source = 'database' AND a.data_source = 'database')
    );
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
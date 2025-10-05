-- Create function to count high-fit accounts by data source
CREATE OR REPLACE FUNCTION public.count_high_fit_accounts_by_source(p_org_id uuid, p_data_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_data_source = 'crm' THEN
    SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_count
    FROM scores s
    INNER JOIN accounts a ON s.account_external_id = a.external_id
    WHERE s.org_id = p_org_id
      AND a.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');
  
  ELSIF p_data_source = 'database' THEN
    SELECT COUNT(DISTINCT s.account_external_id)::integer INTO v_count
    FROM scores s
    INNER JOIN accounts a ON s.account_external_id = a.external_id
    WHERE s.org_id = p_org_id
      AND a.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source = 'database';
  ELSE
    v_count := 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Create function to count high-fit leads by account data source
CREATE OR REPLACE FUNCTION public.count_high_fit_leads_by_source(p_org_id uuid, p_data_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_data_source = 'crm' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_count
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id
    INNER JOIN scores s ON a.external_id = s.account_external_id
    WHERE l.org_id = p_org_id
      AND a.org_id = p_org_id
      AND s.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source IN ('crm', 'both');
  
  ELSIF p_data_source = 'database' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_count
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id
    INNER JOIN scores s ON a.external_id = s.account_external_id
    WHERE l.org_id = p_org_id
      AND a.org_id = p_org_id
      AND s.org_id = p_org_id
      AND s.overall >= 70
      AND a.data_source = 'database';
  ELSE
    v_count := 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
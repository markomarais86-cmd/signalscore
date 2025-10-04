-- Fix lead counting to include ALL leads, not just linked ones
-- Update count_leads_by_account_source to use LEFT JOIN

CREATE OR REPLACE FUNCTION public.count_leads_by_account_source(p_org_id uuid, p_data_source text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- For CRM leads: count all leads from CRM OR linked to CRM accounts
  IF p_data_source = 'crm' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_count
    FROM "Leads" l
    LEFT JOIN accounts a ON l.account_external_id = a.external_id AND a.org_id = p_org_id
    WHERE l.org_id = p_org_id
      AND (
        a.data_source IN ('crm', 'both')
        OR l.account_external_id IS NULL  -- Unlinked leads are considered CRM
      );
  
  -- For database leads: only count leads linked to database-only accounts
  ELSIF p_data_source = 'database' THEN
    SELECT COUNT(DISTINCT l.id)::integer INTO v_count
    FROM "Leads" l
    INNER JOIN accounts a ON l.account_external_id = a.external_id
    WHERE l.org_id = p_org_id
      AND a.org_id = p_org_id
      AND a.data_source = 'database';
  ELSE
    v_count := 0;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
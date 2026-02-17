
CREATE OR REPLACE FUNCTION public.count_accounts_with_leads(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT l.account_external_id)::integer
  FROM "Leads" l
  INNER JOIN accounts a ON l.account_external_id = a.external_id
  WHERE l.org_id = p_org_id
    AND a.org_id = p_org_id
    AND l.account_external_id IS NOT NULL;
$$;

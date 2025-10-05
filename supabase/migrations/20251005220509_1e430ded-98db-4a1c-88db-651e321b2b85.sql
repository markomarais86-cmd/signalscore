-- Function to count total leads linked to high-fit accounts
CREATE OR REPLACE FUNCTION public.count_high_fit_leads_total(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count all leads linked to accounts with score >= 70
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND s.overall >= 70
    AND l.account_external_id IS NOT NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
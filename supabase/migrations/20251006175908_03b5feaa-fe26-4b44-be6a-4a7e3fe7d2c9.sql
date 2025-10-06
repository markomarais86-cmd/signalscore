-- Drop old contact-based functions
DROP FUNCTION IF EXISTS public.count_campaign_ready_accounts(uuid);
DROP FUNCTION IF EXISTS public.count_campaign_ready_leads(uuid);

-- Create new lead-based campaign-ready accounts function
CREATE OR REPLACE FUNCTION public.count_campaign_ready_accounts(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Count high-fit accounts (score >= 70) that have at least one mapped lead with valid email and persona
  SELECT COUNT(DISTINCT a.external_id)::integer INTO v_count
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id
  INNER JOIN "Leads" l ON a.external_id = l.account_external_id
  WHERE a.org_id = p_org_id
    AND s.org_id = p_org_id
    AND l.org_id = p_org_id
    AND s.overall >= 70
    AND l.email IS NOT NULL
    AND l.email LIKE '%@%'
    AND l.persona IS NOT NULL
    AND l.persona != 'Unknown';
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Create new lead-based campaign-ready leads function
CREATE OR REPLACE FUNCTION public.count_campaign_ready_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Count leads linked to high-fit accounts with valid email and persona
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND s.overall >= 70
    AND l.email IS NOT NULL
    AND l.email LIKE '%@%'
    AND l.persona IS NOT NULL
    AND l.persona != 'Unknown';
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
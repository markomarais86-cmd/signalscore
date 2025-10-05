-- Create simplified function to insert a single account
CREATE OR REPLACE FUNCTION public.insert_single_account(
  p_org_id UUID,
  p_external_id TEXT,
  p_name TEXT,
  p_domain TEXT,
  p_industry_norm TEXT,
  p_employee_count INTEGER,
  p_revenue_range TEXT,
  p_country TEXT,
  p_state_province TEXT,
  p_phone TEXT,
  p_mobile TEXT,
  p_data_source TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Simple insert with RETURNING
  INSERT INTO public.accounts (
    external_id, org_id, name, domain, industry_norm,
    employee_count, revenue_range, country, state_province,
    phone, mobile, data_source
  ) VALUES (
    p_external_id, p_org_id, p_name, p_domain, p_industry_norm,
    p_employee_count, p_revenue_range, p_country, p_state_province,
    p_phone, p_mobile, p_data_source
  )
  RETURNING external_id INTO p_external_id;
  
  RETURN p_external_id;
EXCEPTION WHEN unique_violation THEN
  RETURN NULL;
END;
$function$;

-- Simplify match_leads_to_accounts_fast to remove Step 2
DROP FUNCTION IF EXISTS public.match_leads_to_accounts_fast(uuid, boolean);

CREATE OR REPLACE FUNCTION public.match_leads_to_accounts_fast(p_org_id UUID, p_is_external_db BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched_count INTEGER := 0;
  v_linked_count INTEGER := 0;
  v_total_leads INTEGER;
BEGIN
  -- Validate org_id
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  SELECT COUNT(*) INTO v_total_leads
  FROM public."Leads"
  WHERE org_id = p_org_id AND account_external_id IS NULL;

  -- Step 1: Match to existing accounts
  WITH lead_domains AS (
    SELECT 
      l.id,
      COALESCE(
        normalize_domain_text(l.website),
        normalize_domain_text(SPLIT_PART(l.email, '@', 2))
      ) AS normalized_domain
    FROM public."Leads" l
    WHERE l.org_id = p_org_id 
      AND l.account_external_id IS NULL
      AND (l.website IS NOT NULL OR l.email IS NOT NULL)
  ),
  matched_accounts AS (
    SELECT 
      ld.id AS lead_id,
      a.external_id AS account_external_id
    FROM lead_domains ld
    INNER JOIN public.accounts a ON normalize_domain_text(a.domain) = ld.normalized_domain
    WHERE a.org_id = p_org_id AND ld.normalized_domain IS NOT NULL AND ld.normalized_domain != ''
  )
  UPDATE public."Leads" l
  SET account_external_id = ma.account_external_id
  FROM matched_accounts ma
  WHERE l.id = ma.lead_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;

  -- Step 2: Link remaining leads (after accounts are created by edge function)
  WITH lead_domains AS (
    SELECT 
      l.id,
      COALESCE(
        normalize_domain_text(l.website),
        normalize_domain_text(SPLIT_PART(l.email, '@', 2))
      ) AS normalized_domain
    FROM public."Leads" l
    WHERE l.org_id = p_org_id 
      AND l.account_external_id IS NULL
      AND (l.website IS NOT NULL OR l.email IS NOT NULL)
  )
  UPDATE public."Leads" l
  SET account_external_id = a.external_id
  FROM lead_domains ld
  INNER JOIN public.accounts a ON normalize_domain_text(a.domain) = ld.normalized_domain
  WHERE l.id = ld.id
    AND a.org_id = p_org_id
    AND ld.normalized_domain IS NOT NULL
    AND ld.normalized_domain != '';

  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'matched_to_existing', v_matched_count,
    'linked_after_creation', v_linked_count
  );
END;
$function$;
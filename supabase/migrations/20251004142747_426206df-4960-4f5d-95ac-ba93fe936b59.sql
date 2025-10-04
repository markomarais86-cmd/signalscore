-- Fix match_leads_to_accounts_fast to handle unique domain constraint
CREATE OR REPLACE FUNCTION public.match_leads_to_accounts_fast(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched_count INTEGER := 0;
  v_created_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_total_leads INTEGER;
BEGIN
  -- Validate org_id
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Get count of unlinked leads
  SELECT COUNT(*) INTO v_total_leads
  FROM public."Leads"
  WHERE org_id = p_org_id AND account_external_id IS NULL;

  -- Step 1: Match leads to existing accounts by normalized domain
  WITH lead_domains AS (
    SELECT 
      l.id,
      l.external_id,
      l.website,
      l.email,
      l.company,
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
      ld.external_id AS lead_external_id,
      a.external_id AS account_external_id
    FROM lead_domains ld
    INNER JOIN public.accounts a ON normalize_domain_text(a.domain) = ld.normalized_domain
    WHERE a.org_id = p_org_id
  )
  UPDATE public."Leads" l
  SET account_external_id = ma.account_external_id
  FROM matched_accounts ma
  WHERE l.id = ma.lead_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;

  -- Step 2: Create new accounts for unmatched leads (skip domains that already exist)
  WITH new_accounts_data AS (
    SELECT DISTINCT ON (normalized_domain)
      gen_random_uuid() AS external_id,
      p_org_id AS org_id,
      l.company AS name,
      l.website AS domain,
      l.industry AS industry_norm,
      l.employee_count,
      l.revenue_range,
      l.country,
      l.state_province,
      l.phone,
      l.mobile,
      'crm'::text AS data_source,
      COALESCE(
        normalize_domain_text(l.website),
        normalize_domain_text(SPLIT_PART(l.email, '@', 2))
      ) AS normalized_domain
    FROM public."Leads" l
    WHERE l.org_id = p_org_id 
      AND l.account_external_id IS NULL
      AND (l.website IS NOT NULL OR l.email IS NOT NULL)
      AND COALESCE(
        normalize_domain_text(l.website),
        normalize_domain_text(SPLIT_PART(l.email, '@', 2))
      ) IS NOT NULL
  )
  INSERT INTO public.accounts (
    external_id, org_id, name, domain, industry_norm, 
    employee_count, revenue_range, country, state_province, 
    phone, mobile, data_source
  )
  SELECT 
    nad.external_id, nad.org_id, nad.name, nad.domain, nad.industry_norm,
    nad.employee_count, nad.revenue_range, nad.country, nad.state_province,
    nad.phone, nad.mobile, nad.data_source
  FROM new_accounts_data nad
  WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.org_id = p_org_id 
    AND normalize_domain_text(a.domain) = nad.normalized_domain
  );

  GET DIAGNOSTICS v_created_count = ROW_COUNT;

  -- Step 3: Link leads to accounts (both existing and newly created)
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
    AND a.org_id = p_org_id;

  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'matched_to_existing', v_matched_count,
    'new_accounts_created', v_created_count,
    'total_linked', v_matched_count + v_created_count,
    'failed', v_total_leads - (v_matched_count + v_created_count)
  );
END;
$function$;
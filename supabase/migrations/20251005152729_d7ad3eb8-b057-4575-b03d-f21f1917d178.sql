-- Fix duplicate key issue by handling each domain insertion with error catching
DROP FUNCTION IF EXISTS public.match_leads_to_accounts_fast(uuid, boolean);

CREATE OR REPLACE FUNCTION public.match_leads_to_accounts_fast(p_org_id uuid, p_is_external_db boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched_count INTEGER := 0;
  v_created_count INTEGER := 0;
  v_scored_count INTEGER := 0;
  v_updated_to_both INTEGER := 0;
  v_step3_linked INTEGER := 0;
  v_total_leads INTEGER;
  v_new_account_ids TEXT[];
  v_icp_id UUID;
  domain_rec RECORD;
BEGIN
  -- Validate org_id
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  v_icp_id := public.get_active_icp_id(p_org_id);

  SELECT COUNT(*) INTO v_total_leads
  FROM public."Leads"
  WHERE org_id = p_org_id AND account_external_id IS NULL;

  RAISE NOTICE 'Starting match for % unlinked leads', v_total_leads;

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
  RAISE NOTICE 'Step 1: Matched % leads', v_matched_count;

  -- Step 2: Create new accounts one domain at a time with error handling
  FOR domain_rec IN
    SELECT DISTINCT ON (normalized_domain)
      gen_random_uuid()::TEXT AS external_id,
      l.company AS name,
      normalize_domain_text(COALESCE(l.website, CASE WHEN l.email IS NOT NULL THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END)) AS domain,
      l.industry AS industry_norm,
      l.employee_count,
      l.revenue_range,
      l.country,
      l.state_province,
      l.phone,
      l.mobile,
      CASE WHEN p_is_external_db THEN 'database'::text ELSE 'crm'::text END AS data_source,
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
      AND COALESCE(
        normalize_domain_text(l.website),
        normalize_domain_text(SPLIT_PART(l.email, '@', 2))
      ) != ''
    ORDER BY normalized_domain, l.id DESC
  LOOP
    BEGIN
      -- Check if account exists
      IF NOT EXISTS (
        SELECT 1 FROM public.accounts 
        WHERE org_id = p_org_id 
        AND normalize_domain_text(domain) = domain_rec.normalized_domain
      ) THEN
        -- Insert new account
        INSERT INTO public.accounts (
          external_id, org_id, name, domain, industry_norm, 
          employee_count, revenue_range, country, state_province, 
          phone, mobile, data_source
        ) VALUES (
          domain_rec.external_id, p_org_id, domain_rec.name, domain_rec.domain, domain_rec.industry_norm,
          domain_rec.employee_count, domain_rec.revenue_range, domain_rec.country, domain_rec.state_province,
          domain_rec.phone, domain_rec.mobile, domain_rec.data_source
        );
        
        v_new_account_ids := array_append(v_new_account_ids, domain_rec.external_id);
        v_created_count := v_created_count + 1;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- Domain was inserted by another concurrent process, skip it
      RAISE NOTICE 'Skipping duplicate domain: %', domain_rec.normalized_domain;
      CONTINUE;
    END;
  END LOOP;

  RAISE NOTICE 'Step 2: Created % new accounts', v_created_count;

  -- Step 3: Link remaining leads
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

  GET DIAGNOSTICS v_step3_linked = ROW_COUNT;
  RAISE NOTICE 'Step 3: Linked % remaining leads', v_step3_linked;

  -- Step 4: Auto-score new accounts
  IF v_new_account_ids IS NOT NULL AND v_icp_id IS NOT NULL THEN
    FOR i IN 1..array_length(v_new_account_ids, 1) LOOP
      BEGIN
        PERFORM public.auto_score_account(v_new_account_ids[i], p_org_id);
        v_scored_count := v_scored_count + 1;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'matched_to_existing', v_matched_count,
    'new_accounts_created', v_created_count,
    'step3_linked', v_step3_linked,
    'accounts_scored', v_scored_count,
    'total_linked', v_matched_count + v_step3_linked,
    'failed', v_total_leads - (v_matched_count + v_created_count + v_step3_linked)
  );
END;
$function$;
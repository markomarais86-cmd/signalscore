-- Phase 4: Auto-trigger ICP scoring for new accounts

-- Step 1: Create helper function to get active ICP
CREATE OR REPLACE FUNCTION public.get_active_icp_id(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_icp_id UUID;
BEGIN
  -- Get the first active ICP profile for the org
  SELECT id INTO v_icp_id
  FROM public.icp_profiles
  WHERE org_id = p_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no active ICP, get the most recent one
  IF v_icp_id IS NULL THEN
    SELECT id INTO v_icp_id
    FROM public.icp_profiles
    WHERE org_id = p_org_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN v_icp_id;
END;
$function$;

-- Step 2: Create function to auto-score an account
CREATE OR REPLACE FUNCTION public.auto_score_account(p_account_external_id TEXT, p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_icp_id UUID;
  v_score_result JSONB;
BEGIN
  -- Get active ICP
  v_icp_id := public.get_active_icp_id(p_org_id);
  
  -- Skip if no ICP is configured
  IF v_icp_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate score
  v_score_result := public.calculate_account_score(p_account_external_id, v_icp_id, p_org_id);
  
  -- Insert or update score
  INSERT INTO public.scores (
    org_id,
    account_external_id,
    overall,
    fit,
    intent,
    reachability,
    reasons,
    scoring_version
  ) VALUES (
    p_org_id,
    p_account_external_id,
    (v_score_result->>'overall')::INTEGER,
    (v_score_result->>'fit')::INTEGER,
    (v_score_result->>'intent')::INTEGER,
    (v_score_result->>'reachability')::INTEGER,
    v_score_result->'breakdown',
    'auto_v1.0'
  )
  ON CONFLICT (org_id, account_external_id)
  DO UPDATE SET
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = now();
END;
$function$;

-- Step 3: Update lead matching function to auto-score new accounts
CREATE OR REPLACE FUNCTION public.match_leads_to_accounts_fast(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched_count INTEGER := 0;
  v_created_count INTEGER := 0;
  v_scored_count INTEGER := 0;
  v_total_leads INTEGER;
  v_new_account_ids TEXT[];
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
      gen_random_uuid()::TEXT AS external_id,
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
  ),
  inserted_accounts AS (
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
    )
    RETURNING external_id
  )
  SELECT ARRAY_AGG(external_id) INTO v_new_account_ids FROM inserted_accounts;

  v_created_count := COALESCE(array_length(v_new_account_ids, 1), 0);

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

  -- Step 4: Auto-score newly created accounts
  IF v_new_account_ids IS NOT NULL THEN
    FOR i IN 1..array_length(v_new_account_ids, 1) LOOP
      BEGIN
        PERFORM public.auto_score_account(v_new_account_ids[i], p_org_id);
        v_scored_count := v_scored_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Continue on error, don't fail the whole process
        CONTINUE;
      END;
    END LOOP;
  END IF;

  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'matched_to_existing', v_matched_count,
    'new_accounts_created', v_created_count,
    'accounts_scored', v_scored_count,
    'total_linked', v_matched_count + v_created_count,
    'failed', v_total_leads - (v_matched_count + v_created_count)
  );
END;
$function$;
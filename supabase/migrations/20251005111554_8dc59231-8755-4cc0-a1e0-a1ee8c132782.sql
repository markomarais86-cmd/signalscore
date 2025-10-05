-- Fix match_leads_to_accounts_fast function to prevent duplicate key violations
-- Add pre-filtering before INSERT to avoid race conditions

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
  v_total_leads INTEGER;
  v_new_account_ids TEXT[];
  v_icp_id UUID;
BEGIN
  -- Validate org_id belongs to the calling user
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Get active ICP for auto-scoring
  v_icp_id := public.get_active_icp_id(p_org_id);

  -- Get count of unlinked leads
  SELECT COUNT(*) INTO v_total_leads
  FROM public."Leads"
  WHERE org_id = p_org_id AND account_external_id IS NULL;

  RAISE NOTICE 'Starting match for % unlinked leads (External DB: %)', v_total_leads, p_is_external_db;

  -- Step 1: Match leads to existing accounts by normalized domain
  WITH lead_domains AS (
    SELECT 
      l.id,
      l.external_id,
      l.website,
      l.email,
      l.company,
      l.industry,
      l.employee_count,
      l.revenue_range,
      l.country,
      l.state_province,
      l.phone,
      l.mobile,
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
      a.external_id AS account_external_id,
      a.data_source AS current_source
    FROM lead_domains ld
    INNER JOIN public.accounts a ON normalize_domain_text(a.domain) = ld.normalized_domain
    WHERE a.org_id = p_org_id AND ld.normalized_domain IS NOT NULL AND ld.normalized_domain != ''
  )
  UPDATE public."Leads" l
  SET account_external_id = ma.account_external_id
  FROM matched_accounts ma
  WHERE l.id = ma.lead_id;

  GET DIAGNOSTICS v_matched_count = ROW_COUNT;
  RAISE NOTICE 'Matched % leads to existing accounts', v_matched_count;

  -- Step 1b: If external database, update matched accounts to 'both'
  IF p_is_external_db THEN
    WITH lead_domains AS (
      SELECT 
        COALESCE(
          normalize_domain_text(l.website),
          normalize_domain_text(SPLIT_PART(l.email, '@', 2))
        ) AS normalized_domain
      FROM public."Leads" l
      WHERE l.org_id = p_org_id 
        AND l.account_external_id IS NOT NULL
        AND (l.website IS NOT NULL OR l.email IS NOT NULL)
    ),
    matched_accounts_for_update AS (
      SELECT DISTINCT a.external_id
      FROM lead_domains ld
      INNER JOIN public.accounts a ON normalize_domain_text(a.domain) = ld.normalized_domain
      WHERE a.org_id = p_org_id 
        AND a.data_source = 'crm'
        AND ld.normalized_domain IS NOT NULL 
        AND ld.normalized_domain != ''
    )
    UPDATE public.accounts
    SET data_source = 'both', updated_at = now()
    WHERE org_id = p_org_id 
      AND external_id IN (SELECT external_id FROM matched_accounts_for_update);
    
    GET DIAGNOSTICS v_updated_to_both = ROW_COUNT;
    RAISE NOTICE 'Updated % accounts from CRM to BOTH (CRM + Database)', v_updated_to_both;
  END IF;

  -- Step 2: Create new accounts with PRE-FILTERING (THE FIX)
  WITH new_accounts_data AS (
    SELECT DISTINCT ON (normalized_domain)
      gen_random_uuid()::TEXT AS external_id,
      p_org_id AS org_id,
      l.company AS name,
      COALESCE(l.website, CASE WHEN l.email IS NOT NULL THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END) AS domain,
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
  ),
  -- PRE-FILTER: Remove domains that already exist BEFORE inserting
  filtered_accounts AS (
    SELECT nad.*
    FROM new_accounts_data nad
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts a 
      WHERE a.org_id = p_org_id 
      AND normalize_domain_text(a.domain) = nad.normalized_domain
    )
  ),
  inserted_accounts AS (
    INSERT INTO public.accounts (
      external_id, org_id, name, domain, industry_norm, 
      employee_count, revenue_range, country, state_province, 
      phone, mobile, data_source
    )
    SELECT 
      fna.external_id, fna.org_id, fna.name, fna.domain, fna.industry_norm,
      fna.employee_count, fna.revenue_range, fna.country, fna.state_province,
      fna.phone, fna.mobile, fna.data_source
    FROM filtered_accounts fna
    ON CONFLICT (org_id, external_id) DO NOTHING
    RETURNING external_id
  )
  SELECT ARRAY_AGG(external_id) INTO v_new_account_ids FROM inserted_accounts;

  v_created_count := COALESCE(array_length(v_new_account_ids, 1), 0);
  RAISE NOTICE 'Created % new accounts (Source: %)', v_created_count, CASE WHEN p_is_external_db THEN 'database' ELSE 'crm' END;

  -- Step 3: Link ALL remaining unlinked leads to their accounts
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

  RAISE NOTICE 'Linked all remaining leads to accounts';

  -- Step 4: Auto-score newly created accounts (if ICP exists)
  IF v_new_account_ids IS NOT NULL AND v_icp_id IS NOT NULL THEN
    RAISE NOTICE 'Auto-scoring % new accounts with ICP %', array_length(v_new_account_ids, 1), v_icp_id;
    
    FOR i IN 1..array_length(v_new_account_ids, 1) LOOP
      BEGIN
        PERFORM public.auto_score_account(v_new_account_ids[i], p_org_id);
        v_scored_count := v_scored_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to score account %: %', v_new_account_ids[i], SQLERRM;
        CONTINUE;
      END;
    END LOOP;
  ELSE
    IF v_icp_id IS NULL THEN
      RAISE NOTICE 'No ICP profile found - skipping auto-scoring';
    END IF;
  END IF;

  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'matched_to_existing', v_matched_count,
    'new_accounts_created', v_created_count,
    'accounts_scored', v_scored_count,
    'accounts_updated_to_both', v_updated_to_both,
    'total_linked', v_matched_count + v_created_count,
    'failed', v_total_leads - (v_matched_count + v_created_count),
    'is_external_database', p_is_external_db
  );
END;
$function$;
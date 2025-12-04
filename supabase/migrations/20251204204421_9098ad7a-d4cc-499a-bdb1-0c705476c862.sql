-- Fix the function to use correct column name: account_external_id
DROP FUNCTION IF EXISTS public.bulk_match_all_leads(UUID, INT);

CREATE OR REPLACE FUNCTION public.bulk_match_all_leads(p_org_id UUID, p_batch_size INT DEFAULT 2000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
AS $$
DECLARE
  v_matched_to_existing INT := 0;
  v_accounts_created INT := 0;
  v_linked_to_new INT := 0;
  v_total_unlinked INT := 0;
  v_domains_to_create TEXT[];
BEGIN
  -- Count unlinked leads
  SELECT COUNT(*) INTO v_total_unlinked
  FROM "Leads" l
  WHERE l.org_id = p_org_id 
    AND (l.account_external_id IS NULL OR l.account_external_id = '');

  IF v_total_unlinked = 0 THEN
    RETURN jsonb_build_object(
      'matched_to_existing', 0,
      'accounts_created', 0,
      'linked_to_new', 0,
      'total_processed', 0,
      'has_more', false
    );
  END IF;

  -- Phase 1: Match leads to EXISTING accounts by domain
  WITH leads_to_match AS (
    SELECT l.id, 
           LOWER(REGEXP_REPLACE(
             COALESCE(
               l.website,
               CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
             ),
             '^(https?://)?(www\.)?', '', 'i'
           )) as lead_domain
    FROM "Leads" l
    WHERE l.org_id = p_org_id 
      AND (l.account_external_id IS NULL OR l.account_external_id = '')
    LIMIT p_batch_size
  ),
  matched AS (
    UPDATE "Leads" l
    SET account_external_id = a.external_id,
        updated_at = NOW()
    FROM leads_to_match ltm
    JOIN accounts a ON a.org_id = p_org_id 
      AND LOWER(a.domain) = ltm.lead_domain
      AND ltm.lead_domain IS NOT NULL
      AND ltm.lead_domain != ''
    WHERE l.id = ltm.id
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_matched_to_existing FROM matched;

  -- Phase 2: Get distinct domains that need new accounts
  SELECT ARRAY_AGG(DISTINCT domain) INTO v_domains_to_create
  FROM (
    SELECT LOWER(REGEXP_REPLACE(
             COALESCE(
               l.website,
               CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
             ),
             '^(https?://)?(www\.)?', '', 'i'
           )) as domain
    FROM "Leads" l
    WHERE l.org_id = p_org_id 
      AND (l.account_external_id IS NULL OR l.account_external_id = '')
      AND (l.website IS NOT NULL OR l.email LIKE '%@%')
    LIMIT p_batch_size
  ) domains
  WHERE domain IS NOT NULL 
    AND domain != ''
    AND NOT EXISTS (
      SELECT 1 FROM accounts a 
      WHERE a.org_id = p_org_id 
        AND LOWER(a.domain) = domains.domain
    );

  -- Phase 3: Create accounts for new domains
  IF v_domains_to_create IS NOT NULL AND array_length(v_domains_to_create, 1) > 0 THEN
    INSERT INTO accounts (org_id, external_id, domain, name, data_source)
    SELECT 
      p_org_id,
      'auto_' || md5(d || p_org_id::text),
      d,
      INITCAP(SPLIT_PART(d, '.', 1)),
      'crm'
    FROM unnest(v_domains_to_create) AS d
    ON CONFLICT (org_id, external_id) DO NOTHING;
    
    GET DIAGNOSTICS v_accounts_created = ROW_COUNT;
  END IF;

  -- Phase 4: Link remaining unlinked leads to accounts
  WITH leads_to_link AS (
    SELECT l.id,
           LOWER(REGEXP_REPLACE(
             COALESCE(
               l.website,
               CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
             ),
             '^(https?://)?(www\.)?', '', 'i'
           )) as lead_domain
    FROM "Leads" l
    WHERE l.org_id = p_org_id 
      AND (l.account_external_id IS NULL OR l.account_external_id = '')
    LIMIT p_batch_size
  ),
  linked AS (
    UPDATE "Leads" l
    SET account_external_id = a.external_id,
        updated_at = NOW()
    FROM leads_to_link ltl
    JOIN accounts a ON a.org_id = p_org_id 
      AND LOWER(a.domain) = ltl.lead_domain
    WHERE l.id = ltl.id
      AND ltl.lead_domain IS NOT NULL
      AND ltl.lead_domain != ''
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_linked_to_new FROM linked;

  -- Check if there are more unlinked leads
  RETURN jsonb_build_object(
    'matched_to_existing', v_matched_to_existing,
    'accounts_created', v_accounts_created,
    'linked_to_new', v_linked_to_new,
    'total_processed', v_matched_to_existing + v_linked_to_new,
    'has_more', EXISTS (
      SELECT 1 FROM "Leads" 
      WHERE org_id = p_org_id 
        AND (account_external_id IS NULL OR account_external_id = '')
      LIMIT 1
    )
  );
END;
$$;
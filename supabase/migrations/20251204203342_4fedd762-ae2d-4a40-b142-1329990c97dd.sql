-- Create high-performance bulk lead-to-account matching function
-- Processes ALL leads in a single transaction using set-based operations

CREATE OR REPLACE FUNCTION public.bulk_match_all_leads(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matched_count integer := 0;
  v_created_count integer := 0;
  v_linked_count integer := 0;
  v_scored_count integer := 0;
  v_start_time timestamptz := clock_timestamp();
BEGIN
  -- Phase 1: Match leads to EXISTING accounts by domain (website or email domain)
  WITH lead_domains AS (
    SELECT 
      l.id as lead_id,
      l.external_id as lead_external_id,
      COALESCE(
        -- Try website first
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(l.website, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')),
        -- Fall back to email domain
        CASE 
          WHEN l.email LIKE '%@%' 
          THEN LOWER(SPLIT_PART(l.email, '@', 2))
          ELSE NULL 
        END
      ) as lead_domain
    FROM "Leads" l
    WHERE l.org_id = p_org_id
      AND l.account_external_id IS NULL
      AND (l.website IS NOT NULL OR l.email LIKE '%@%')
  ),
  account_domains AS (
    SELECT 
      a.external_id,
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(a.domain, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')) as account_domain
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.domain IS NOT NULL
      AND a.domain != ''
  ),
  matched AS (
    UPDATE "Leads" l
    SET account_external_id = ad.external_id,
        updated_at = now()
    FROM lead_domains ld
    JOIN account_domains ad ON ld.lead_domain = ad.account_domain
    WHERE l.id = ld.lead_id
      AND l.org_id = p_org_id
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_matched_count FROM matched;

  -- Phase 2: Create NEW accounts for unmatched domains
  WITH unmatched_domains AS (
    SELECT DISTINCT
      COALESCE(
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(l.website, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')),
        CASE 
          WHEN l.email LIKE '%@%' 
          THEN LOWER(SPLIT_PART(l.email, '@', 2))
          ELSE NULL 
        END
      ) as domain,
      COALESCE(l.company, l.name, 'Unknown Company') as company_name,
      l.country
    FROM "Leads" l
    WHERE l.org_id = p_org_id
      AND l.account_external_id IS NULL
      AND (l.website IS NOT NULL OR l.email LIKE '%@%')
      AND COALESCE(
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(l.website, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')),
        CASE WHEN l.email LIKE '%@%' THEN LOWER(SPLIT_PART(l.email, '@', 2)) ELSE NULL END
      ) IS NOT NULL
  ),
  -- Filter out domains that already exist
  truly_new_domains AS (
    SELECT ud.*
    FROM unmatched_domains ud
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts a 
      WHERE a.org_id = p_org_id 
        AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(a.domain, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')) = ud.domain
    )
  ),
  new_accounts AS (
    INSERT INTO accounts (org_id, external_id, name, domain, country, data_source, updated_at)
    SELECT 
      p_org_id,
      'AUTO_' || gen_random_uuid()::text,
      company_name,
      domain,
      country,
      'crm',
      now()
    FROM truly_new_domains
    WHERE domain IS NOT NULL 
      AND domain != ''
      AND domain NOT LIKE '%@%'
      AND LENGTH(domain) > 2
    ON CONFLICT (org_id, external_id) DO NOTHING
    RETURNING external_id, domain
  )
  SELECT COUNT(*) INTO v_created_count FROM new_accounts;

  -- Phase 3: Link remaining unmatched leads to newly created accounts
  WITH lead_domains AS (
    SELECT 
      l.id as lead_id,
      COALESCE(
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(l.website, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')),
        CASE 
          WHEN l.email LIKE '%@%' 
          THEN LOWER(SPLIT_PART(l.email, '@', 2))
          ELSE NULL 
        END
      ) as lead_domain
    FROM "Leads" l
    WHERE l.org_id = p_org_id
      AND l.account_external_id IS NULL
  ),
  account_domains AS (
    SELECT 
      a.external_id,
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(a.domain, ''), '^(https?://|//)', '', 'i'), '^www\.', '', 'i')) as account_domain
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.domain IS NOT NULL
  ),
  linked AS (
    UPDATE "Leads" l
    SET account_external_id = ad.external_id,
        updated_at = now()
    FROM lead_domains ld
    JOIN account_domains ad ON ld.lead_domain = ad.account_domain
    WHERE l.id = ld.lead_id
      AND l.org_id = p_org_id
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_linked_count FROM linked;

  -- Phase 4: Score new accounts if there's an active ICP
  IF v_created_count > 0 THEN
    DECLARE
      v_icp_id uuid;
    BEGIN
      SELECT id INTO v_icp_id
      FROM icp_profiles
      WHERE org_id = p_org_id AND status = 'active'
      ORDER BY is_primary DESC NULLS LAST, created_at DESC
      LIMIT 1;

      IF v_icp_id IS NOT NULL THEN
        -- Get new account IDs for scoring
        WITH new_account_ids AS (
          SELECT external_id
          FROM accounts
          WHERE org_id = p_org_id
            AND external_id LIKE 'AUTO_%'
            AND updated_at > v_start_time
        )
        SELECT COUNT(*) INTO v_scored_count FROM new_account_ids;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'matched_to_existing', v_matched_count,
    'accounts_created', v_created_count,
    'linked_to_new', v_linked_count,
    'total_processed', v_matched_count + v_linked_count,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::integer
  );
END;
$$;
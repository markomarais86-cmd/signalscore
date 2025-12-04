-- Phase 1: Update bulk_match_all_leads function to include firmographic data when creating accounts
CREATE OR REPLACE FUNCTION public.bulk_match_all_leads(p_org_id uuid, p_batch_size integer DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_matched_to_existing INT := 0;
  v_accounts_created INT := 0;
  v_linked_to_new INT := 0;
  v_total_unlinked INT := 0;
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
           LOWER(TRIM(REGEXP_REPLACE(
             COALESCE(
               l.website,
               CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
             ),
             '^(https?://)?(www\.)+|/$', '', 'gi'
           ))) as lead_domain
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
      AND LOWER(TRIM(a.domain)) = ltm.lead_domain
      AND ltm.lead_domain IS NOT NULL
      AND ltm.lead_domain != ''
    WHERE l.id = ltm.id
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_matched_to_existing FROM matched;

  -- Phase 2: Create accounts WITH firmographic data from leads
  WITH domains_to_create AS (
    SELECT 
      domain,
      MODE() WITHIN GROUP (ORDER BY company) FILTER (WHERE company IS NOT NULL AND company != '') as best_name,
      MODE() WITHIN GROUP (ORDER BY revenue_range) FILTER (WHERE revenue_range IS NOT NULL) as best_revenue,
      MODE() WITHIN GROUP (ORDER BY employee_count) FILTER (WHERE employee_count IS NOT NULL) as best_employee_count,
      MODE() WITHIN GROUP (ORDER BY country) FILTER (WHERE country IS NOT NULL) as best_country,
      MODE() WITHIN GROUP (ORDER BY industry) FILTER (WHERE industry IS NOT NULL) as best_industry,
      MODE() WITHIN GROUP (ORDER BY state_province) FILTER (WHERE state_province IS NOT NULL) as best_state
    FROM (
      SELECT 
        LOWER(TRIM(REGEXP_REPLACE(
          COALESCE(
            l.website,
            CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
          ),
          '^(https?://)?(www\.)+|/$', '', 'gi'
        ))) as domain,
        l.company,
        l.revenue_range,
        l.employee_count,
        l.country,
        l.industry,
        l.state_province
      FROM "Leads" l
      WHERE l.org_id = p_org_id 
        AND (l.account_external_id IS NULL OR l.account_external_id = '')
        AND (l.website IS NOT NULL OR l.email LIKE '%@%')
      LIMIT p_batch_size
    ) lead_domains
    WHERE domain IS NOT NULL 
      AND domain != ''
    GROUP BY domain
  ),
  new_accounts AS (
    INSERT INTO accounts (org_id, external_id, domain, name, data_source, 
                          revenue_range, employee_count, country, industry_raw, state_province)
    SELECT 
      p_org_id,
      'auto_' || md5(d.domain || p_org_id::text),
      d.domain,
      COALESCE(d.best_name, INITCAP(SPLIT_PART(d.domain, '.', 1))),
      'crm',
      d.best_revenue,
      d.best_employee_count,
      d.best_country,
      d.best_industry,
      d.best_state
    FROM domains_to_create d
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts a 
      WHERE a.org_id = p_org_id 
        AND LOWER(TRIM(a.domain)) = d.domain
    )
    ON CONFLICT DO NOTHING
    RETURNING external_id
  )
  SELECT COUNT(*) INTO v_accounts_created FROM new_accounts;

  -- Phase 3: Link remaining unlinked leads to accounts
  WITH leads_to_link AS (
    SELECT l.id,
           LOWER(TRIM(REGEXP_REPLACE(
             COALESCE(
               l.website,
               CASE WHEN l.email LIKE '%@%' THEN SPLIT_PART(l.email, '@', 2) ELSE NULL END
             ),
             '^(https?://)?(www\.)+|/$', '', 'gi'
           ))) as lead_domain
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
      AND LOWER(TRIM(a.domain)) = ltl.lead_domain
    WHERE l.id = ltl.id
      AND ltl.lead_domain IS NOT NULL
      AND ltl.lead_domain != ''
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_linked_to_new FROM linked;

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
$function$;

-- Phase 2: Create a standalone sync function for manual/future use
CREATE OR REPLACE FUNCTION public.sync_accounts_from_leads(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count INT := 0;
BEGIN
  WITH lead_aggregates AS (
    SELECT 
      account_external_id,
      MODE() WITHIN GROUP (ORDER BY revenue_range) FILTER (WHERE revenue_range IS NOT NULL) as best_revenue,
      MODE() WITHIN GROUP (ORDER BY employee_count) FILTER (WHERE employee_count IS NOT NULL) as best_employee_count,
      MODE() WITHIN GROUP (ORDER BY country) FILTER (WHERE country IS NOT NULL) as best_country,
      MODE() WITHIN GROUP (ORDER BY industry) FILTER (WHERE industry IS NOT NULL) as best_industry,
      MODE() WITHIN GROUP (ORDER BY state_province) FILTER (WHERE state_province IS NOT NULL) as best_state
    FROM "Leads"
    WHERE org_id = p_org_id
      AND account_external_id IS NOT NULL
      AND account_external_id != ''
    GROUP BY account_external_id
  ),
  updated AS (
    UPDATE accounts a
    SET 
      revenue_range = COALESCE(a.revenue_range, la.best_revenue),
      employee_count = COALESCE(a.employee_count, la.best_employee_count),
      country = COALESCE(a.country, la.best_country),
      industry_raw = COALESCE(a.industry_raw, la.best_industry),
      state_province = COALESCE(a.state_province, la.best_state),
      updated_at = NOW()
    FROM lead_aggregates la
    WHERE a.external_id = la.account_external_id
      AND a.org_id = p_org_id
      AND (
        (a.revenue_range IS NULL AND la.best_revenue IS NOT NULL) OR
        (a.employee_count IS NULL AND la.best_employee_count IS NOT NULL) OR
        (a.country IS NULL AND la.best_country IS NOT NULL) OR
        (a.industry_raw IS NULL AND la.best_industry IS NOT NULL) OR
        (a.state_province IS NULL AND la.best_state IS NOT NULL)
      )
    RETURNING a.external_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_updated', v_updated_count
  );
END;
$function$;
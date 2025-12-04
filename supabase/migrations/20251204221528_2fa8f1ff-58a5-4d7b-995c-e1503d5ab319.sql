-- Run enrichment for the organization
DO $$
DECLARE
  v_result jsonb;
  v_org_id uuid := 'd6b18474-150b-4a69-93ed-540e0e7c7efb';
  v_matched INT := 0;
  v_enriched INT := 0;
BEGIN
  -- Count matches first
  SELECT COUNT(*) INTO v_matched
  FROM accounts a
  INNER JOIN master_account_data m ON LOWER(TRIM(a.domain)) = m.domain_normalized
  WHERE a.org_id = v_org_id
    AND m.domain_normalized IS NOT NULL;

  RAISE NOTICE 'Matched accounts: %', v_matched;

  -- Update accounts with master data
  WITH enriched AS (
    UPDATE accounts a
    SET 
      employee_count = COALESCE(a.employee_count, m.employee_count_int),
      revenue_range = COALESCE(a.revenue_range, m.revenue_range),
      industry_norm = COALESCE(a.industry_norm, m."Industry"),
      sub_industry = COALESCE(a.sub_industry, m."Secondary Industry"),
      country = COALESCE(a.country, m."HQ Country"),
      state_province = COALESCE(a.state_province, m."HQ State"),
      city = COALESCE(a.city, m."HQ City"),
      phone = COALESCE(a.phone, m."HQ Phone"),
      naics = COALESCE(a.naics, m."NAICS 1"),
      founded_year = COALESCE(a.founded_year, m.founded_year_int),
      business_model = COALESCE(a.business_model, m."Business Model"),
      enriched_from = CASE 
        WHEN a.enriched_from IS NULL THEN 'master_data'
        WHEN a.enriched_from NOT LIKE '%master_data%' THEN a.enriched_from || ',master_data'
        ELSE a.enriched_from
      END,
      enriched_at = NOW(),
      updated_at = NOW()
    FROM master_account_data m
    WHERE a.org_id = v_org_id
      AND LOWER(TRIM(a.domain)) = m.domain_normalized
      AND m.domain_normalized IS NOT NULL
      AND (
        (a.employee_count IS NULL AND m.employee_count_int IS NOT NULL) OR
        (a.revenue_range IS NULL AND m.revenue_range IS NOT NULL) OR
        (a.industry_norm IS NULL AND m."Industry" IS NOT NULL) OR
        (a.sub_industry IS NULL AND m."Secondary Industry" IS NOT NULL) OR
        (a.country IS NULL AND m."HQ Country" IS NOT NULL) OR
        (a.state_province IS NULL AND m."HQ State" IS NOT NULL) OR
        (a.city IS NULL AND m."HQ City" IS NOT NULL) OR
        (a.phone IS NULL AND m."HQ Phone" IS NOT NULL) OR
        (a.naics IS NULL AND m."NAICS 1" IS NOT NULL) OR
        (a.founded_year IS NULL AND m.founded_year_int IS NOT NULL) OR
        (a.business_model IS NULL AND m."Business Model" IS NOT NULL)
      )
    RETURNING a.external_id
  )
  SELECT COUNT(*) INTO v_enriched FROM enriched;

  RAISE NOTICE 'Enriched accounts: %', v_enriched;
END $$;

-- Also sync from leads
DO $$
DECLARE
  v_org_id uuid := 'd6b18474-150b-4a69-93ed-540e0e7c7efb';
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
    WHERE org_id = v_org_id
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
      AND a.org_id = v_org_id
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

  RAISE NOTICE 'Updated from leads: %', v_updated_count;
END $$;
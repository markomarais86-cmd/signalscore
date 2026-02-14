
-- Disable all insert triggers during bulk insert
ALTER TABLE accounts DISABLE TRIGGER auto_enrich_account_on_insert;
ALTER TABLE accounts DISABLE TRIGGER auto_score_on_account_insert;
ALTER TABLE accounts DISABLE TRIGGER auto_rescore_on_account_update;
ALTER TABLE accounts DISABLE TRIGGER normalize_account_domain_trigger;
ALTER TABLE accounts DISABLE TRIGGER normalize_account_country_trigger;
ALTER TABLE accounts DISABLE TRIGGER normalize_country_trigger;
ALTER TABLE accounts DISABLE TRIGGER trg_sync_account_firmographics;
ALTER TABLE accounts DISABLE TRIGGER validate_accounts_phone_fields;
ALTER TABLE accounts DISABLE TRIGGER validate_accounts_phones;

DO $$
DECLARE
  target_org_id UUID := '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
  rec RECORD;
  inserted_count INT := 0;
  skipped_count INT := 0;
BEGIN
  -- Step 1: Update existing accounts - fill NULL fields only
  UPDATE accounts a
  SET
    name = COALESCE(a.name, m."Company"),
    industry_norm = COALESCE(a.industry_norm, m."Industry"),
    sub_industry = COALESCE(a.sub_industry, m."Secondary Industry"),
    employee_count = COALESCE(a.employee_count, m.employee_count_int),
    revenue_range = COALESCE(a.revenue_range, m.revenue_range),
    country = COALESCE(a.country, m."HQ Country"),
    city = COALESCE(a.city, m."HQ City"),
    hq_city = COALESCE(a.hq_city, m."HQ City"),
    state_province = COALESCE(a.state_province, m."HQ State"),
    hq_state = COALESCE(a.hq_state, m."HQ State"),
    hq_address = COALESCE(a.hq_address, m."HQ Address"),
    hq_postal_code = COALESCE(a.hq_postal_code, m."HQ Postal Code"),
    company_main_phone = COALESCE(a.company_main_phone, m."HQ Phone"),
    business_model = COALESCE(a.business_model, m."Business Model"),
    founded_year = COALESCE(a.founded_year, m.founded_year_int),
    naics = COALESCE(a.naics, m."NAICS 1"),
    updated_at = now()
  FROM master_account_data m
  WHERE normalize_domain_text(a.domain) = m.domain_normalized
    AND m.domain_normalized IS NOT NULL AND m.domain_normalized <> ''
    AND a.org_id = target_org_id;

  -- Step 2: Insert new accounts, skipping duplicates
  FOR rec IN
    SELECT m.*
    FROM master_account_data m
    WHERE m.domain_normalized IS NOT NULL AND m.domain_normalized <> ''
      AND NOT EXISTS (
        SELECT 1 FROM accounts a
        WHERE normalize_domain_text(a.domain) = m.domain_normalized
          AND a.org_id = target_org_id
      )
  LOOP
    BEGIN
      INSERT INTO accounts (
        external_id, org_id, name, domain, industry_norm, sub_industry,
        employee_count, revenue_range, country, city, hq_city,
        state_province, hq_state, hq_address, hq_postal_code,
        company_main_phone, business_model, founded_year, naics,
        data_source, updated_at
      ) VALUES (
        'lp-' || rec.domain_normalized, target_org_id,
        rec."Company", rec.domain_normalized,
        rec."Industry", rec."Secondary Industry",
        rec.employee_count_int, rec.revenue_range,
        rec."HQ Country", rec."HQ City", rec."HQ City",
        rec."HQ State", rec."HQ State",
        rec."HQ Address", rec."HQ Postal Code", rec."HQ Phone",
        rec."Business Model", rec.founded_year_int, rec."NAICS 1",
        'crm', now()
      );
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Inserted %, skipped %', inserted_count, skipped_count;
END;
$$;

-- Re-enable all triggers
ALTER TABLE accounts ENABLE TRIGGER auto_enrich_account_on_insert;
ALTER TABLE accounts ENABLE TRIGGER auto_score_on_account_insert;
ALTER TABLE accounts ENABLE TRIGGER auto_rescore_on_account_update;
ALTER TABLE accounts ENABLE TRIGGER normalize_account_domain_trigger;
ALTER TABLE accounts ENABLE TRIGGER normalize_account_country_trigger;
ALTER TABLE accounts ENABLE TRIGGER normalize_country_trigger;
ALTER TABLE accounts ENABLE TRIGGER trg_sync_account_firmographics;
ALTER TABLE accounts ENABLE TRIGGER validate_accounts_phone_fields;
ALTER TABLE accounts ENABLE TRIGGER validate_accounts_phones;

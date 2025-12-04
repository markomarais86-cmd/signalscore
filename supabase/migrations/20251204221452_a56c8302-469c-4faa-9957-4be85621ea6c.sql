-- Step 1: Populate revenue_range from "Annual Revenue" (cast text to numeric)
UPDATE master_account_data
SET revenue_range = public.normalize_revenue_to_range(
  NULLIF(REGEXP_REPLACE("Annual Revenue", '[^0-9.]', '', 'g'), '')::NUMERIC
)
WHERE "Annual Revenue" IS NOT NULL 
  AND "Annual Revenue" != ''
  AND revenue_range IS NULL;

-- Step 2: Recreate the enrichment function with correct column names
CREATE OR REPLACE FUNCTION public.enrich_accounts_from_master(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched INT := 0;
  v_enriched INT := 0;
BEGIN
  -- Count matches first
  SELECT COUNT(*) INTO v_matched
  FROM accounts a
  INNER JOIN master_account_data m ON LOWER(TRIM(a.domain)) = m.domain_normalized
  WHERE a.org_id = p_org_id
    AND m.domain_normalized IS NOT NULL;

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
    WHERE a.org_id = p_org_id
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

  RETURN jsonb_build_object(
    'success', true,
    'matched_accounts', v_matched,
    'enriched_accounts', v_enriched
  );
END;
$function$;
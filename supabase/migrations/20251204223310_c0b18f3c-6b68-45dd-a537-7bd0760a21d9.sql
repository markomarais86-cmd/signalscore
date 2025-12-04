-- Step 2: Create function to normalize account industries
CREATE OR REPLACE FUNCTION public.normalize_account_industries(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_industry INT := 0;
  v_updated_sub INT := 0;
BEGIN
  -- Update industry_norm based on mapping table
  WITH mapped AS (
    UPDATE accounts a
    SET industry_norm = im.zoominfo_primary,
        sub_industry = COALESCE(a.sub_industry, im.zoominfo_sub),
        updated_at = NOW()
    FROM industry_mapping im
    WHERE a.org_id = p_org_id
      AND (LOWER(TRIM(a.industry_norm)) = LOWER(TRIM(im.raw_industry))
           OR LOWER(TRIM(a.industry_raw)) = LOWER(TRIM(im.raw_industry)))
      AND (a.industry_norm != im.zoominfo_primary OR a.sub_industry IS NULL)
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_updated_industry FROM mapped;

  -- Also try to map from master_account_data secondary industry
  WITH master_sub AS (
    UPDATE accounts a
    SET sub_industry = m."Secondary Industry",
        updated_at = NOW()
    FROM master_account_data m
    WHERE a.org_id = p_org_id
      AND a.sub_industry IS NULL
      AND LOWER(TRIM(a.domain)) = LOWER(TRIM(m."Company Website"))
      AND m."Secondary Industry" IS NOT NULL
      AND m."Secondary Industry" != ''
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_updated_sub FROM master_sub;

  RETURN jsonb_build_object(
    'accounts_industry_normalized', v_updated_industry,
    'accounts_sub_from_master', v_updated_sub,
    'total_updated', v_updated_industry + v_updated_sub
  );
END;
$function$;

-- Step 3: Create function to sync industry to leads
CREATE OR REPLACE FUNCTION public.sync_industry_to_leads(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count INT := 0;
BEGIN
  -- Update leads with industry and sub_industry from linked accounts
  WITH updated AS (
    UPDATE "Leads" l
    SET 
      industry = COALESCE(a.industry_norm, l.industry),
      sub_industry = COALESCE(a.sub_industry, l.sub_industry),
      updated_at = NOW()
    FROM accounts a
    WHERE l.org_id = p_org_id
      AND l.account_external_id = a.external_id
      AND a.org_id = p_org_id
      AND (
        (a.industry_norm IS NOT NULL AND (l.industry IS NULL OR l.industry != a.industry_norm))
        OR (a.sub_industry IS NOT NULL AND l.sub_industry IS NULL)
      )
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'leads_updated', v_updated_count
  );
END;
$function$;
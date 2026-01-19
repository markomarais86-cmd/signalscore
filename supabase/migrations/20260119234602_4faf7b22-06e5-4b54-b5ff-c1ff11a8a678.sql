-- Fix the auto_enrich_from_master trigger to use correct column names
-- The master_account_data table has columns with quoted names like "Industry", "HQ City", etc.

CREATE OR REPLACE FUNCTION public.auto_enrich_from_master()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_master RECORD;
BEGIN
  -- Only process if domain exists
  IF NEW.domain IS NULL OR NEW.domain = '' THEN
    RETURN NEW;
  END IF;

  -- Look up master data by domain_normalized (correct column name!)
  SELECT * INTO v_master
  FROM master_account_data
  WHERE domain_normalized = normalize_domain_text(NEW.domain)
  LIMIT 1;

  -- If found, fill missing fields using correct column names
  IF v_master IS NOT NULL THEN
    NEW.employee_count := COALESCE(NEW.employee_count, v_master.employee_count_int);
    NEW.revenue_range := COALESCE(NEW.revenue_range, v_master.revenue_range);
    NEW.industry_norm := COALESCE(NEW.industry_norm, v_master."Industry");
    NEW.sub_industry := COALESCE(NEW.sub_industry, v_master."Secondary Industry");
    NEW.country := COALESCE(NEW.country, v_master."HQ Country");
    NEW.state_province := COALESCE(NEW.state_province, v_master."HQ State");
    NEW.city := COALESCE(NEW.city, v_master."HQ City");
    NEW.hq_city := COALESCE(NEW.hq_city, v_master."HQ City");
    NEW.hq_state := COALESCE(NEW.hq_state, v_master."HQ State");
    NEW.hq_postal_code := COALESCE(NEW.hq_postal_code, v_master."HQ Postal Code");
    NEW.hq_address := COALESCE(NEW.hq_address, v_master."HQ Address");
    NEW.phone := COALESCE(NEW.phone, v_master."HQ Phone");
    NEW.company_main_phone := COALESCE(NEW.company_main_phone, v_master."HQ Phone");
    NEW.naics := COALESCE(NEW.naics, v_master."NAICS 1");
    NEW.founded_year := COALESCE(NEW.founded_year, v_master.founded_year_int);
    NEW.business_model := COALESCE(NEW.business_model, v_master."Business Model");
    
    IF NEW.enriched_from IS NULL THEN
      NEW.enriched_from := 'master_data';
    ELSIF NEW.enriched_from NOT LIKE '%master_data%' THEN
      NEW.enriched_from := NEW.enriched_from || ',master_data';
    END IF;
    
    NEW.enriched_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;
-- Drop and recreate master_account_data with CSV-compatible column names
DROP TABLE IF EXISTS public.master_account_data CASCADE;

CREATE TABLE public.master_account_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Company" TEXT,
  "Website" TEXT,
  "Founded Year" TEXT,
  "HQ Phone" TEXT,
  "Annual Revenue" TEXT,
  "No. of Employees" TEXT,
  "NAICS 1" TEXT,
  "NAICS 2" TEXT,
  "NAICS 3" TEXT,
  "NAICS 4" TEXT,
  "Industry" TEXT,
  "Secondary Industry" TEXT,
  "Business Model" TEXT,
  "HQ Address" TEXT,
  "HQ City" TEXT,
  "HQ State" TEXT,
  "HQ Postal Code" TEXT,
  "HQ Country" TEXT,
  "Lead Source" TEXT,
  "Lead Source Details" TEXT,
  
  -- Normalized columns for enrichment
  domain_normalized TEXT,
  revenue_range TEXT,
  employee_count_int INTEGER,
  founded_year_int INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on normalized domain for fast lookups
CREATE INDEX idx_master_domain_normalized ON public.master_account_data(domain_normalized);
CREATE INDEX idx_master_company ON public.master_account_data("Company");

-- Update the enrichment function to use new column names
CREATE OR REPLACE FUNCTION public.enrich_accounts_from_master(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matched INT := 0;
  v_updated INT := 0;
BEGIN
  -- Update accounts with matching domains from master data
  WITH matched_accounts AS (
    UPDATE accounts a
    SET 
      employee_count = COALESCE(a.employee_count, m.employee_count_int),
      revenue_range = COALESCE(a.revenue_range, m.revenue_range),
      industry_norm = COALESCE(a.industry_norm, m."Industry"),
      sub_industry = COALESCE(a.sub_industry, m."Secondary Industry"),
      naics = COALESCE(a.naics, m."NAICS 1"),
      business_model = COALESCE(a.business_model, m."Business Model"),
      founded_year = COALESCE(a.founded_year, m.founded_year_int),
      city = COALESCE(a.city, m."HQ City"),
      state_province = COALESCE(a.state_province, m."HQ State"),
      country = COALESCE(a.country, m."HQ Country"),
      phone = COALESCE(a.phone, m."HQ Phone"),
      enriched_from = COALESCE(a.enriched_from || ',master_data', 'master_data'),
      enriched_at = NOW(),
      updated_at = NOW()
    FROM master_account_data m
    WHERE a.org_id = p_org_id
      AND m.domain_normalized IS NOT NULL
      AND m.domain_normalized != ''
      AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(a.domain, '^(https?://)?', ''), '^www\.', '')) = m.domain_normalized
      AND (
        a.employee_count IS NULL OR
        a.revenue_range IS NULL OR
        a.industry_norm IS NULL OR
        a.naics IS NULL
      )
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_updated FROM matched_accounts;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_enriched', v_updated,
    'org_id', p_org_id
  );
END;
$$;
-- Create master_account_data table for reference data
CREATE TABLE IF NOT EXISTS public.master_account_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  company_name TEXT,
  founded_year INTEGER,
  phone TEXT,
  annual_revenue NUMERIC,
  revenue_range TEXT,
  employee_count INTEGER,
  naics_code TEXT,
  industry_primary TEXT,
  industry_secondary TEXT,
  business_model TEXT,
  address TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast domain lookups
CREATE INDEX IF NOT EXISTS idx_master_account_data_domain ON public.master_account_data(domain);

-- Add missing columns to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sub_industry TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS business_model TEXT;

-- Create revenue range normalization function
CREATE OR REPLACE FUNCTION public.normalize_revenue_to_range(revenue_raw NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF revenue_raw IS NULL THEN RETURN NULL; END IF;
  
  RETURN CASE
    WHEN revenue_raw < 1000000 THEN '<$1M'
    WHEN revenue_raw < 5000000 THEN '$1M-$5M'
    WHEN revenue_raw < 10000000 THEN '$5M-$10M'
    WHEN revenue_raw < 25000000 THEN '$10M-$25M'
    WHEN revenue_raw < 50000000 THEN '$25M-$50M'
    WHEN revenue_raw < 100000000 THEN '$50M-$100M'
    WHEN revenue_raw < 250000000 THEN '$100M-$250M'
    WHEN revenue_raw < 500000000 THEN '$250M-$500M'
    WHEN revenue_raw < 1000000000 THEN '$500M-$1B'
    ELSE '$1B+'
  END;
END;
$$;

-- Create enrichment function that fills missing fields from master data
CREATE OR REPLACE FUNCTION public.enrich_accounts_from_master(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enriched INTEGER := 0;
  v_total_matched INTEGER := 0;
BEGIN
  -- Update accounts with missing data from master_account_data
  WITH enriched AS (
    UPDATE accounts a
    SET
      employee_count = COALESCE(a.employee_count, m.employee_count),
      revenue_range = COALESCE(a.revenue_range, m.revenue_range),
      industry_norm = COALESCE(a.industry_norm, m.industry_primary),
      sub_industry = COALESCE(a.sub_industry, m.industry_secondary),
      country = COALESCE(a.country, m.country),
      state_province = COALESCE(a.state_province, m.state_province),
      city = COALESCE(a.city, m.city),
      phone = COALESCE(a.phone, m.phone),
      naics = COALESCE(a.naics, m.naics_code),
      founded_year = COALESCE(a.founded_year, m.founded_year),
      business_model = COALESCE(a.business_model, m.business_model),
      enriched_from = CASE 
        WHEN a.enriched_from IS NULL THEN 'master_data'
        WHEN a.enriched_from NOT LIKE '%master_data%' THEN a.enriched_from || ',master_data'
        ELSE a.enriched_from
      END,
      enriched_at = NOW(),
      updated_at = NOW()
    FROM master_account_data m
    WHERE 
      a.org_id = p_org_id
      AND normalize_domain_text(a.domain) = m.domain
      AND a.domain IS NOT NULL
      AND (
        a.employee_count IS NULL
        OR a.revenue_range IS NULL
        OR a.industry_norm IS NULL
        OR a.sub_industry IS NULL
        OR a.naics IS NULL
        OR a.country IS NULL
        OR a.phone IS NULL
      )
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_enriched FROM enriched;

  -- Count total accounts that have a match in master data
  SELECT COUNT(*) INTO v_total_matched
  FROM accounts a
  INNER JOIN master_account_data m ON normalize_domain_text(a.domain) = m.domain
  WHERE a.org_id = p_org_id AND a.domain IS NOT NULL;

  RETURN jsonb_build_object(
    'accounts_enriched', v_enriched,
    'total_matched', v_total_matched,
    'status', 'completed'
  );
END;
$$;

-- Create trigger function for auto-enrichment on account insert
CREATE OR REPLACE FUNCTION public.auto_enrich_from_master()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_master RECORD;
BEGIN
  -- Only process if domain exists
  IF NEW.domain IS NULL OR NEW.domain = '' THEN
    RETURN NEW;
  END IF;

  -- Look up master data by normalized domain
  SELECT * INTO v_master
  FROM master_account_data
  WHERE domain = normalize_domain_text(NEW.domain)
  LIMIT 1;

  -- If found, fill missing fields
  IF v_master IS NOT NULL THEN
    NEW.employee_count := COALESCE(NEW.employee_count, v_master.employee_count);
    NEW.revenue_range := COALESCE(NEW.revenue_range, v_master.revenue_range);
    NEW.industry_norm := COALESCE(NEW.industry_norm, v_master.industry_primary);
    NEW.sub_industry := COALESCE(NEW.sub_industry, v_master.industry_secondary);
    NEW.country := COALESCE(NEW.country, v_master.country);
    NEW.state_province := COALESCE(NEW.state_province, v_master.state_province);
    NEW.city := COALESCE(NEW.city, v_master.city);
    NEW.phone := COALESCE(NEW.phone, v_master.phone);
    NEW.naics := COALESCE(NEW.naics, v_master.naics_code);
    NEW.founded_year := COALESCE(NEW.founded_year, v_master.founded_year);
    NEW.business_model := COALESCE(NEW.business_model, v_master.business_model);
    
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

-- Create trigger for auto-enrichment on insert
DROP TRIGGER IF EXISTS auto_enrich_account_on_insert ON accounts;
CREATE TRIGGER auto_enrich_account_on_insert
BEFORE INSERT ON accounts
FOR EACH ROW
EXECUTE FUNCTION auto_enrich_from_master();

-- Enable RLS on master_account_data (public read for all authenticated users)
ALTER TABLE public.master_account_data ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read master data
CREATE POLICY "Authenticated users can read master data"
ON public.master_account_data
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only allow system/service role to insert/update/delete
CREATE POLICY "Service role can manage master data"
ON public.master_account_data
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
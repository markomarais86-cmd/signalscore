-- Phase 4: Enhanced Enrichment Schema
-- Adds fields for Eugene's 48-column enrichment format

-- =============================================
-- ACCOUNTS TABLE ENHANCEMENTS
-- =============================================

-- SIC/NAICS codes
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS sic_code text;

-- HQ address details (some may exist, adding if not)
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS hq_address text;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS hq_city text;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS hq_state text;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS hq_postal_code text;

-- Company main phone
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS company_main_phone text;

-- Social URLs
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS facebook_url text;

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS twitter_url text;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_accounts_sic_code ON public.accounts(sic_code);
CREATE INDEX IF NOT EXISTS idx_accounts_naics ON public.accounts(naics);

-- =============================================
-- LEADS TABLE ENHANCEMENTS  
-- =============================================

-- Additional phone fields
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS phone_extension text;

-- Social URLs
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS facebook_url text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS twitter_url text;

-- Employment tracking
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS still_at_company text DEFAULT 'unknown';

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS previous_company text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS previous_title text;

-- Email verification status
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'unknown';

-- Phone type tracking
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS phone_type text;

-- Enhanced enrichment scoring (Eugene's 0/1/2 system)
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS enrichment_total_score integer;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS enrichment_max_score integer;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS enrichment_pass boolean;

-- Discovery tracking (for contacts found via agent-discover-contacts)
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS discovered_from_account text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS discovered_at timestamp with time zone;

-- Company details from enrichment
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_main_phone text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_hq_address text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_hq_city text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_hq_state text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_hq_country text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_hq_postal_code text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_sic_code text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_naics_code text;

ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS company_facebook_url text;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_leads_still_at_company ON public."Leads"(still_at_company);
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_pass ON public."Leads"(enrichment_pass);
CREATE INDEX IF NOT EXISTS idx_leads_discovered_from ON public."Leads"(discovered_from_account);
CREATE INDEX IF NOT EXISTS idx_leads_email_status ON public."Leads"(email_status);

-- =============================================
-- ENRICHMENT_ROWS TABLE ENHANCEMENTS
-- =============================================

-- Add ICP criteria used for scoring
ALTER TABLE public.enrichment_rows 
ADD COLUMN IF NOT EXISTS icp_criteria_used jsonb;

-- Add total score tracking
ALTER TABLE public.enrichment_rows 
ADD COLUMN IF NOT EXISTS total_score integer;

ALTER TABLE public.enrichment_rows 
ADD COLUMN IF NOT EXISTS max_possible_score integer;

-- Add discovered contacts count
ALTER TABLE public.enrichment_rows 
ADD COLUMN IF NOT EXISTS extra_contacts_found integer DEFAULT 0;

-- =============================================
-- ENRICHMENT_JOBS TABLE ENHANCEMENTS
-- =============================================

-- Add target titles configuration
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS target_titles text[] DEFAULT ARRAY['CEO', 'CTO', 'CFO', 'VP', 'Director'];

-- Add flag for extra contacts discovery
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS enable_contact_discovery boolean DEFAULT false;

-- Add counts for discovered contacts
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS contacts_discovered integer DEFAULT 0;

-- Add ICP criteria for the job
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS icp_criteria jsonb;

-- Comments for documentation
COMMENT ON COLUMN public."Leads".still_at_company IS 'Whether person is still at company: yes, no, unknown';
COMMENT ON COLUMN public."Leads".email_status IS 'Email verification: verified, unverified, not_found, pattern_derived';
COMMENT ON COLUMN public."Leads".phone_type IS 'Type of phone: company_main, direct, mobile, unknown';
COMMENT ON COLUMN public."Leads".enrichment_total_score IS 'Sum of field scores using 0/1/2 system';
COMMENT ON COLUMN public."Leads".enrichment_pass IS 'Whether record passes ICP criteria';
COMMENT ON COLUMN public."Leads".discovered_from_account IS 'Account external_id if this lead was auto-discovered';
COMMENT ON COLUMN public.accounts.sic_code IS 'Standard Industrial Classification code';
COMMENT ON COLUMN public.enrichment_jobs.target_titles IS 'Titles to search for when discovering contacts';
COMMENT ON COLUMN public.enrichment_jobs.enable_contact_discovery IS 'Whether to auto-discover additional contacts at enriched companies';
-- Phase 1: Database Schema Enhancement
-- Add data source tracking to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'crm' CHECK (data_source IN ('crm', 'database', 'both')),
ADD COLUMN IF NOT EXISTS external_database_match boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enriched_from text,
ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone;

-- Add data source tracking to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'crm' CHECK (data_source IN ('crm', 'database', 'both')),
ADD COLUMN IF NOT EXISTS external_database_match boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enriched_from text,
ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone;

-- Create external_data_sources table to track provider connections
CREATE TABLE IF NOT EXISTS public.external_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('zoominfo', 'apollo', 'cognism')),
  api_key_configured boolean DEFAULT false,
  is_active boolean DEFAULT false,
  total_accounts bigint DEFAULT 0,
  total_contacts bigint DEFAULT 0,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- Create enrichment_jobs table for bulk enrichment tracking
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('accounts', 'contacts')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  enriched_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  error_message text,
  filter_criteria jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.external_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for external_data_sources
CREATE POLICY "Users can view data sources in their org"
  ON public.external_data_sources FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert data sources"
  ON public.external_data_sources FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update data sources"
  ON public.external_data_sources FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete data sources"
  ON public.external_data_sources FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS policies for enrichment_jobs
CREATE POLICY "Users can view enrichment jobs in their org"
  ON public.enrichment_jobs FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can create enrichment jobs"
  ON public.enrichment_jobs FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update their enrichment jobs"
  ON public.enrichment_jobs FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete enrichment jobs"
  ON public.enrichment_jobs FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_data_source ON public.accounts(org_id, data_source);
CREATE INDEX IF NOT EXISTS idx_accounts_external_match ON public.accounts(org_id, external_database_match);
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(org_id, data_source);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON public.enrichment_jobs(org_id, status);

-- Update existing records to default 'crm' source
UPDATE public.accounts SET data_source = 'crm' WHERE data_source IS NULL;
UPDATE public.contacts SET data_source = 'crm' WHERE data_source IS NULL;
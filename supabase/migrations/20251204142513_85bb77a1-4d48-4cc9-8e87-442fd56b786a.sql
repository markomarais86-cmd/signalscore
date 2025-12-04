-- Create enrichment_rows table for per-record state tracking
CREATE TABLE IF NOT EXISTS public.enrichment_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('account', 'lead')),
  record_id TEXT NOT NULL,
  external_id TEXT,
  source_type TEXT CHECK (source_type IN ('crm', 'csv', 'google_sheet', 'database', 'manual')),
  
  -- Processing state
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  current_agent TEXT,
  
  -- Raw data snapshots
  raw_input JSONB,
  search_payload JSONB,
  enriched_raw JSONB,
  validated_data JSONB,
  
  -- Per-field confidence scores (0-2)
  field_scores JSONB DEFAULT '{}',
  overall_score INTEGER,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  validation_summary TEXT,
  
  -- ICP results
  icp_pass BOOLEAN,
  icp_fail_reasons TEXT[],
  
  -- Agent execution tracking
  search_agent_completed_at TIMESTAMPTZ,
  validation_agent_completed_at TIMESTAMPTZ,
  icp_agent_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for enrichment_rows
CREATE INDEX IF NOT EXISTS idx_enrichment_rows_job_id ON enrichment_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_rows_org_id ON enrichment_rows(org_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_rows_status ON enrichment_rows(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_rows_record ON enrichment_rows(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_rows_icp_pass ON enrichment_rows(icp_pass) WHERE icp_pass IS NOT NULL;

-- Enable RLS on enrichment_rows
ALTER TABLE enrichment_rows ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment_rows
CREATE POLICY "Users can view enrichment rows for their org"
  ON enrichment_rows FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert enrichment rows for their org"
  ON enrichment_rows FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update enrichment rows for their org"
  ON enrichment_rows FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

-- Extend enrichment_jobs table with new columns
ALTER TABLE enrichment_jobs 
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS config_icp_id UUID REFERENCES icp_profiles(id),
  ADD COLUMN IF NOT EXISTS concurrency INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS agent_config JSONB DEFAULT '{"search": true, "validation": true, "icp": true}',
  ADD COLUMN IF NOT EXISTS rows_pending INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_failed INTEGER DEFAULT 0;

-- Add icp_qualified column to accounts if not exists
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS icp_qualified BOOLEAN,
  ADD COLUMN IF NOT EXISTS icp_fail_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS enrichment_overall_score INTEGER,
  ADD COLUMN IF NOT EXISTS enrichment_field_scores JSONB;

-- Add enrichment columns to Leads if not exists
ALTER TABLE "Leads"
  ADD COLUMN IF NOT EXISTS icp_qualified BOOLEAN,
  ADD COLUMN IF NOT EXISTS icp_fail_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS enrichment_overall_score INTEGER,
  ADD COLUMN IF NOT EXISTS enrichment_field_scores JSONB,
  ADD COLUMN IF NOT EXISTS verified_email BOOLEAN,
  ADD COLUMN IF NOT EXISTS verified_phone BOOLEAN,
  ADD COLUMN IF NOT EXISTS direct_phone TEXT,
  ADD COLUMN IF NOT EXISTS cell_phone TEXT,
  ADD COLUMN IF NOT EXISTS still_at_company TEXT CHECK (still_at_company IN ('yes', 'no', 'unknown')),
  ADD COLUMN IF NOT EXISTS previous_company TEXT,
  ADD COLUMN IF NOT EXISTS previous_title TEXT;

-- Create trigger to update enrichment_rows updated_at
CREATE OR REPLACE FUNCTION update_enrichment_rows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enrichment_rows_updated_at ON enrichment_rows;
CREATE TRIGGER trigger_enrichment_rows_updated_at
  BEFORE UPDATE ON enrichment_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_rows_updated_at();
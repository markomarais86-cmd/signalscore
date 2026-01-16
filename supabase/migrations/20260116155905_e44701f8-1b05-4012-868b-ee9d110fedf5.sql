-- Add lead_source_type to track where leads came from
DO $$ BEGIN
  CREATE TYPE lead_source_type AS ENUM (
    'webinar',
    'website_visitor', 
    'event_attendee',
    'linkedin',
    'manual',
    'csv_import',
    'crm_sync',
    'apollo',
    'pdl',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add source_type column to Leads table
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS source_type lead_source_type DEFAULT 'unknown';

-- Create enrichment_validations table for accuracy tracking
CREATE TABLE IF NOT EXISTS public.enrichment_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  lead_id INTEGER REFERENCES public."Leads"(id) ON DELETE SET NULL,
  enrichment_job_id UUID REFERENCES public.enrichment_jobs(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  enriched_value TEXT,
  validated_value TEXT,
  validation_source TEXT CHECK (validation_source IN ('manual', 'crm_sync', 'verified_external', 'user_feedback')),
  is_accurate BOOLEAN,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_enrichment_validations_org ON public.enrichment_validations(org_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_validations_provider ON public.enrichment_validations(provider);
CREATE INDEX IF NOT EXISTS idx_enrichment_validations_field ON public.enrichment_validations(field_name);
CREATE INDEX IF NOT EXISTS idx_enrichment_validations_accuracy ON public.enrichment_validations(is_accurate) WHERE is_accurate IS NOT NULL;

-- Enable RLS
ALTER TABLE public.enrichment_validations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org validations" 
ON public.enrichment_validations 
FOR SELECT 
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create validations for their org" 
ON public.enrichment_validations 
FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org validations" 
ON public.enrichment_validations 
FOR UPDATE 
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Create enrichment_source_rules table for configurable enrichment behavior
CREATE TABLE IF NOT EXISTS public.enrichment_source_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  priority_fields TEXT[] DEFAULT ARRAY['employee_count', 'revenue_range', 'industry_norm'],
  skip_external_if JSONB DEFAULT '{}',
  require_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  max_api_cost_per_record NUMERIC(10,4) DEFAULT 0.10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, source_type)
);

-- Enable RLS for source rules
ALTER TABLE public.enrichment_source_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org source rules" 
ON public.enrichment_source_rules 
FOR SELECT 
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage source rules" 
ON public.enrichment_source_rules 
FOR ALL 
USING (org_id IN (
  SELECT org_id FROM public.user_profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('super_admin', 'org_admin')
));

-- Insert default source rules
INSERT INTO public.enrichment_source_rules (org_id, source_type, priority_fields, skip_external_if)
SELECT 
  id as org_id,
  'webinar' as source_type,
  ARRAY['employee_count', 'revenue_range', 'industry_norm'] as priority_fields,
  '{"has_company": true, "email_verified": true}' as skip_external_if
FROM public.organizations
ON CONFLICT (org_id, source_type) DO NOTHING;

INSERT INTO public.enrichment_source_rules (org_id, source_type, priority_fields, skip_external_if)
SELECT 
  id as org_id,
  'website_visitor' as source_type,
  ARRAY['employee_count', 'industry_norm', 'country'] as priority_fields,
  '{"domain_enriched": true}' as skip_external_if
FROM public.organizations
ON CONFLICT (org_id, source_type) DO NOTHING;

INSERT INTO public.enrichment_source_rules (org_id, source_type, priority_fields, skip_external_if)
SELECT 
  id as org_id,
  'crm_sync' as source_type,
  ARRAY['industry_norm', 'country'] as priority_fields,
  '{"crm_is_source_of_truth": true}' as skip_external_if
FROM public.organizations
ON CONFLICT (org_id, source_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.enrichment_validations IS 'Tracks accuracy of enrichment data by comparing enriched values to validated/verified values';
COMMENT ON TABLE public.enrichment_source_rules IS 'Configurable rules for how to enrich leads based on their source';
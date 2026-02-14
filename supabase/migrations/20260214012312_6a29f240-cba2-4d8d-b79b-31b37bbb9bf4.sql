
-- Add custom_attributes JSONB to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS custom_attributes jsonb DEFAULT '{}';

-- Add vertical_filters JSONB to icp_profiles table  
ALTER TABLE public.icp_profiles ADD COLUMN IF NOT EXISTS vertical_filters jsonb DEFAULT '{}';

-- Create custom_attribute_definitions table
CREATE TABLE IF NOT EXISTS public.custom_attribute_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('number', 'text', 'select', 'multi_select')),
  options text[] DEFAULT '{}',
  category text DEFAULT 'General',
  enrichment_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, field_key)
);

-- Enable RLS
ALTER TABLE public.custom_attribute_definitions ENABLE ROW LEVEL SECURITY;

-- RLS policies using user_profiles
CREATE POLICY "Users can view their org custom attribute definitions"
ON public.custom_attribute_definitions FOR SELECT
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create custom attribute definitions for their org"
ON public.custom_attribute_definitions FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org custom attribute definitions"
ON public.custom_attribute_definitions FOR UPDATE
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org custom attribute definitions"
ON public.custom_attribute_definitions FOR DELETE
USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_custom_attribute_definitions_org_id ON public.custom_attribute_definitions(org_id);
CREATE INDEX idx_accounts_custom_attributes ON public.accounts USING gin(custom_attributes);

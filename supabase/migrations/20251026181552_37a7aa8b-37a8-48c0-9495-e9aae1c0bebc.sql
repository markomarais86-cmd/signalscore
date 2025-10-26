-- Phase 6: Advanced Analytics Schema

-- Custom reports table
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_id TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Report schedules table
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Segments table for advanced segmentation
CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  query_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  account_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ML models table
CREATE TABLE IF NOT EXISTS public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  model_type TEXT NOT NULL CHECK (model_type IN ('propensity', 'churn', 'ltv')),
  version INTEGER NOT NULL DEFAULT 1,
  training_data_count INTEGER,
  accuracy NUMERIC(5,4),
  precision_score NUMERIC(5,4),
  recall_score NUMERIC(5,4),
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_importance JSONB
);

-- Add propensity_score to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS propensity_score INTEGER CHECK (propensity_score >= 0 AND propensity_score <= 100),
ADD COLUMN IF NOT EXISTS propensity_computed_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_org ON public.custom_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON public.report_schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_segments_org ON public.segments(org_id);
CREATE INDEX IF NOT EXISTS idx_ml_models_org_type ON public.ml_models(org_id, model_type);
CREATE INDEX IF NOT EXISTS idx_accounts_propensity ON public.accounts(org_id, propensity_score) WHERE propensity_score IS NOT NULL;

-- Enable RLS
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_reports
CREATE POLICY "Users can view reports in their org"
  ON public.custom_reports FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can create reports"
  ON public.custom_reports FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update reports in their org"
  ON public.custom_reports FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete reports"
  ON public.custom_reports FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS Policies for report_schedules
CREATE POLICY "Users can view schedules in their org"
  ON public.report_schedules FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can manage schedules"
  ON public.report_schedules FOR ALL
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS Policies for segments
CREATE POLICY "Users can view segments in their org"
  ON public.segments FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can create segments"
  ON public.segments FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update segments in their org"
  ON public.segments FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete segments"
  ON public.segments FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS Policies for ml_models
CREATE POLICY "Users can view models in their org"
  ON public.ml_models FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can manage models"
  ON public.ml_models FOR ALL
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());
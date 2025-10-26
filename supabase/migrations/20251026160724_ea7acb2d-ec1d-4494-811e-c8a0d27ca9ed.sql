-- Create pipeline stages tracking table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id BIGINT REFERENCES public."Leads"(id) ON DELETE CASCADE,
  account_external_id TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('dial', 'connect', 'meeting', 'opportunity', 'closed_won', 'closed_lost')),
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_hours NUMERIC,
  conversion_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create capital tracking table
CREATE TABLE IF NOT EXISTS public.capital_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_investment NUMERIC NOT NULL DEFAULT 0,
  marketing_investment NUMERIC NOT NULL DEFAULT 0,
  total_investment NUMERIC GENERATED ALWAYS AS (sales_investment + marketing_investment) STORED,
  pipeline_value NUMERIC NOT NULL DEFAULT 0,
  revenue_generated NUMERIC NOT NULL DEFAULT 0,
  cac NUMERIC,
  roas NUMERIC,
  pipeline_multiplier NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pipeline_stages
CREATE POLICY "Users can view pipeline stages in their org"
  ON public.pipeline_stages FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert pipeline stages"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update pipeline stages"
  ON public.pipeline_stages FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete pipeline stages"
  ON public.pipeline_stages FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS Policies for capital_tracking
CREATE POLICY "Users can view capital tracking in their org"
  ON public.capital_tracking FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert capital tracking"
  ON public.capital_tracking FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update capital tracking"
  ON public.capital_tracking FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete capital tracking"
  ON public.capital_tracking FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes
CREATE INDEX idx_pipeline_stages_org_id ON public.pipeline_stages(org_id);
CREATE INDEX idx_pipeline_stages_lead_id ON public.pipeline_stages(lead_id);
CREATE INDEX idx_pipeline_stages_account ON public.pipeline_stages(account_external_id);
CREATE INDEX idx_pipeline_stages_stage ON public.pipeline_stages(stage);
CREATE INDEX idx_pipeline_stages_entered_at ON public.pipeline_stages(entered_at);

CREATE INDEX idx_capital_tracking_org_id ON public.capital_tracking(org_id);
CREATE INDEX idx_capital_tracking_period ON public.capital_tracking(period_start, period_end);

-- Auto-update timestamps
CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bulk_scoring_jobs_updated_at();

CREATE TRIGGER update_capital_tracking_updated_at
  BEFORE UPDATE ON public.capital_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bulk_scoring_jobs_updated_at();
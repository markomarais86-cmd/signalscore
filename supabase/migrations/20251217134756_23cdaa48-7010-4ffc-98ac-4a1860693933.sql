-- Create org_benchmarks table for storing organization-specific benchmark configurations
CREATE TABLE public.org_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'pipeline_conversion', 'capital_efficiency', 'cycle_time'
  stage TEXT NOT NULL, -- 'dial', 'connect', 'meeting', 'opportunity', 'closed_won'
  benchmark_value NUMERIC NOT NULL,
  industry TEXT DEFAULT '', -- Optional: industry-specific benchmark (empty string for default)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, metric_type, stage, industry)
);

-- Enable RLS
ALTER TABLE public.org_benchmarks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org benchmarks" ON public.org_benchmarks
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage org benchmarks" ON public.org_benchmarks
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'org_admin')
    )
  );

-- Index for faster lookups
CREATE INDEX idx_org_benchmarks_org_metric ON public.org_benchmarks(org_id, metric_type);

-- Trigger for updated_at
CREATE TRIGGER update_org_benchmarks_updated_at
  BEFORE UPDATE ON public.org_benchmarks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default benchmarks function (callable per org)
CREATE OR REPLACE FUNCTION public.seed_default_benchmarks(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Pipeline conversion benchmarks (industry standard)
  INSERT INTO org_benchmarks (org_id, metric_type, stage, benchmark_value, industry) VALUES
    (p_org_id, 'pipeline_conversion', 'dial', 100, ''),
    (p_org_id, 'pipeline_conversion', 'connect', 25, ''),
    (p_org_id, 'pipeline_conversion', 'meeting', 40, ''),
    (p_org_id, 'pipeline_conversion', 'opportunity', 50, ''),
    (p_org_id, 'pipeline_conversion', 'closed_won', 30, '')
  ON CONFLICT DO NOTHING;
  
  -- Capital efficiency benchmarks
  INSERT INTO org_benchmarks (org_id, metric_type, stage, benchmark_value, industry) VALUES
    (p_org_id, 'capital_efficiency', 'pipeline_multiplier', 3.0, ''),
    (p_org_id, 'capital_efficiency', 'revenue_multiplier', 2.0, ''),
    (p_org_id, 'capital_efficiency', 'cac_payback_months', 15, '')
  ON CONFLICT DO NOTHING;
  
  -- Cycle time benchmarks (in hours)
  INSERT INTO org_benchmarks (org_id, metric_type, stage, benchmark_value, industry) VALUES
    (p_org_id, 'cycle_time', 'dial_to_connect', 48, ''),
    (p_org_id, 'cycle_time', 'connect_to_meeting', 72, ''),
    (p_org_id, 'cycle_time', 'meeting_to_opportunity', 168, ''),
    (p_org_id, 'cycle_time', 'opportunity_to_close', 336, '')
  ON CONFLICT DO NOTHING;
END;
$$;
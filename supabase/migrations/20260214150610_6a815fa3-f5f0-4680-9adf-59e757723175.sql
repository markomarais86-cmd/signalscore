
-- Phase 1A: ICP Model Schema Changes

-- 1. Add weighting, disqualifiers, scoring_config, version_notes to icp_profiles
ALTER TABLE public.icp_profiles 
  ADD COLUMN IF NOT EXISTS weights jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disqualifiers jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scoring_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version_notes text;

-- 2. Create icp_versions table for version history
CREATE TABLE IF NOT EXISTS public.icp_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  icp_id uuid NOT NULL REFERENCES public.icp_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}',
  performance_delta jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.icp_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org icp_versions"
  ON public.icp_versions FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org icp_versions"
  ON public.icp_versions FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- 3. Create revenue_assumptions table
CREATE TABLE IF NOT EXISTS public.revenue_assumptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  acv_source text NOT NULL DEFAULT 'manual',
  acv_value numeric NOT NULL DEFAULT 75000,
  win_rate_source text NOT NULL DEFAULT 'manual',
  win_rate_value numeric NOT NULL DEFAULT 0.15,
  scenarios jsonb NOT NULL DEFAULT '{"conservative": 0.7, "base": 1.0, "aggressive": 1.5}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE public.revenue_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org revenue_assumptions"
  ON public.revenue_assumptions FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org revenue_assumptions"
  ON public.revenue_assumptions FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their org revenue_assumptions"
  ON public.revenue_assumptions FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- 4. Trigger to auto-snapshot ICP versions on update
CREATE OR REPLACE FUNCTION public.snapshot_icp_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version OR OLD.weights IS DISTINCT FROM NEW.weights OR OLD.industries IS DISTINCT FROM NEW.industries OR OLD.company_sizes IS DISTINCT FROM NEW.company_sizes THEN
    INSERT INTO public.icp_versions (icp_id, org_id, version, snapshot)
    VALUES (
      NEW.id,
      NEW.org_id,
      COALESCE(NEW.version, 1),
      jsonb_build_object(
        'name', NEW.name,
        'industries', NEW.industries,
        'sub_industries', NEW.sub_industries,
        'company_sizes', NEW.company_sizes,
        'revenue_ranges', NEW.revenue_ranges,
        'geographies', NEW.geographies,
        'weights', NEW.weights,
        'disqualifiers', NEW.disqualifiers,
        'persona_job_titles', NEW.persona_job_titles,
        'persona_seniority_levels', NEW.persona_seniority_levels,
        'persona_departments', NEW.persona_departments,
        'tech_stack', NEW.tech_stack,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_snapshot_icp_version ON public.icp_profiles;
CREATE TRIGGER trigger_snapshot_icp_version
  AFTER UPDATE ON public.icp_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_icp_version();

-- 5. Trigger for revenue_assumptions updated_at
CREATE OR REPLACE FUNCTION public.update_revenue_assumptions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_revenue_assumptions_updated
  BEFORE UPDATE ON public.revenue_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_revenue_assumptions_timestamp();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_icp_versions_icp_id ON public.icp_versions(icp_id);
CREATE INDEX IF NOT EXISTS idx_icp_versions_org_id ON public.icp_versions(org_id);

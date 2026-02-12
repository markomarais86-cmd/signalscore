
-- org_onboarding_config
CREATE TABLE public.org_onboarding_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT,
  logo_url TEXT,
  brand_primary_color TEXT DEFAULT '#6366f1',
  brand_secondary_color TEXT DEFAULT '#818cf8',
  website_url TEXT,
  value_proposition TEXT,
  target_persona_description TEXT,
  calendly_base_url TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (onboarding_status IN ('draft', 'ready', 'active', 'paused')),
  monthly_lead_target INTEGER DEFAULT 50,
  launched_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_onboarding_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super-admins manage onboarding configs"
  ON public.org_onboarding_config FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org members can view their onboarding config"
  ON public.org_onboarding_config FOR SELECT
  USING (org_id IN (SELECT up.org_id FROM public.user_profiles up WHERE up.user_id = auth.uid()));

-- org_campaign_config
CREATE TABLE public.org_campaign_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'meta', 'linkedin', 'tiktok')),
  ad_account_id TEXT,
  monthly_budget_cents INTEGER,
  landing_page_variant TEXT,
  quiz_variant TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_campaign_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super-admins manage campaign configs"
  ON public.org_campaign_config FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org members can view their campaigns"
  ON public.org_campaign_config FOR SELECT
  USING (org_id IN (SELECT up.org_id FROM public.user_profiles up WHERE up.user_id = auth.uid()));

-- Extend user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS territory TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_leads_per_day INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS calendly_url TEXT,
  ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS working_hours_end TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Updated_at triggers
CREATE TRIGGER update_org_onboarding_config_updated_at
  BEFORE UPDATE ON public.org_onboarding_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_campaign_config_updated_at
  BEFORE UPDATE ON public.org_campaign_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

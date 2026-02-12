
-- Add slug column to organizations
ALTER TABLE public.organizations ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- RPC: get branded config by slug (public/anon)
CREATE OR REPLACE FUNCTION public.get_branded_config_by_slug(p_slug TEXT)
RETURNS TABLE (
  org_id UUID,
  company_name TEXT,
  logo_url TEXT,
  brand_primary_color TEXT,
  brand_secondary_color TEXT,
  value_proposition TEXT,
  target_persona_description TEXT,
  calendly_base_url TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.org_id, c.company_name, c.logo_url, c.brand_primary_color, c.brand_secondary_color,
         c.value_proposition, c.target_persona_description, c.calendly_base_url
  FROM public.org_onboarding_config c
  JOIN public.organizations o ON o.id = c.org_id
  WHERE o.slug = p_slug AND c.onboarding_status = 'active'
  LIMIT 1;
$$;

-- RPC: get branded config by org_id (authenticated)
CREATE OR REPLACE FUNCTION public.get_branded_config_by_org_id(p_org_id UUID)
RETURNS TABLE (
  org_id UUID,
  company_name TEXT,
  logo_url TEXT,
  brand_primary_color TEXT,
  brand_secondary_color TEXT,
  value_proposition TEXT,
  target_persona_description TEXT,
  calendly_base_url TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.org_id, c.company_name, c.logo_url, c.brand_primary_color, c.brand_secondary_color,
         c.value_proposition, c.target_persona_description, c.calendly_base_url
  FROM public.org_onboarding_config c
  WHERE c.org_id = p_org_id
  LIMIT 1;
$$;

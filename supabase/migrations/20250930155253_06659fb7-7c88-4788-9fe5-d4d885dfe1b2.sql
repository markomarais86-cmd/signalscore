-- Create feature flags table for module toggles
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feature flags in their org"
  ON public.feature_flags FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert feature flags"
  ON public.feature_flags FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update feature flags"
  ON public.feature_flags FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete feature flags"
  ON public.feature_flags FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create function to initialize default feature flags for an org
CREATE OR REPLACE FUNCTION public.initialize_feature_flags(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default feature flags if they don't exist
  INSERT INTO public.feature_flags (org_id, feature_key, enabled) VALUES
    (target_org_id, 'icp_manager', true),
    (target_org_id, 'icp_tam_intelligence', true),
    (target_org_id, 'personas_segments', true),
    (target_org_id, 'pipeline_efficiency', true),
    (target_org_id, 'capital_efficiency', true),
    (target_org_id, 'ai_agents', true),
    (target_org_id, 'demo_mode', false)
  ON CONFLICT (org_id, feature_key) DO NOTHING;
END;
$$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_timestamp
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feature_flags_updated_at();
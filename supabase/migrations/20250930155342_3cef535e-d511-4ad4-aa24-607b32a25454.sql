-- Fix search_path for feature flags functions - drop trigger first
DROP TRIGGER IF EXISTS update_feature_flags_timestamp ON public.feature_flags;
DROP FUNCTION IF EXISTS public.update_feature_flags_updated_at();
DROP FUNCTION IF EXISTS public.initialize_feature_flags(uuid);

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION public.initialize_feature_flags(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.update_feature_flags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_feature_flags_timestamp
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feature_flags_updated_at();
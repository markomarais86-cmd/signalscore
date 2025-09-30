-- Update initialize_feature_flags function to set MVP-only defaults
CREATE OR REPLACE FUNCTION public.initialize_feature_flags(target_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.feature_flags (org_id, feature_key, enabled) VALUES
    -- Phase 1 - MVP (enabled by default)
    (target_org_id, 'icp_manager', true),
    (target_org_id, 'icp_tam_intelligence', true),
    -- Phase 2-4 (disabled by default, enable via Labs)
    (target_org_id, 'personas_segments', false),
    (target_org_id, 'pipeline_efficiency', false),
    (target_org_id, 'capital_efficiency', false),
    (target_org_id, 'ai_agents', false),
    (target_org_id, 'demo_mode', false)
  ON CONFLICT (org_id, feature_key) DO NOTHING;
END;
$function$;
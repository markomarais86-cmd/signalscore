-- Update initialize_feature_flags to include Phase 3 features
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
    -- Phase 2 - UX Polish (disabled by default, enable via Labs)
    (target_org_id, 'personas_segments', false),
    -- Phase 3 - Pipeline Intelligence (disabled by default, enable via Labs)
    (target_org_id, 'pipeline_efficiency', false),
    (target_org_id, 'capital_efficiency', false),
    -- Phase 4+ (disabled by default)
    (target_org_id, 'ai_agents', false),
    (target_org_id, 'demo_mode', false)
  ON CONFLICT (org_id, feature_key) DO NOTHING;
END;
$function$;
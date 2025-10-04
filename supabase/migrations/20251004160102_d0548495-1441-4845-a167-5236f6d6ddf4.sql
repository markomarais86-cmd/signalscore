-- Fix automation settings for existing organizations
-- This ensures all orgs have the required automation settings initialized

-- Initialize automation settings for all existing organizations that don't have them
INSERT INTO public.automation_settings (org_id, setting_key, enabled, schedule_frequency)
SELECT 
  o.id as org_id,
  s.setting_key,
  s.enabled,
  s.schedule_frequency
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('auto_match_on_upload', true, NULL),
    ('scheduled_match', false, 'daily'),
    ('auto_score', true, NULL),
    ('scheduled_score', false, 'daily'),
    ('auto_merge_duplicates', false, 'weekly')
) AS s(setting_key, enabled, schedule_frequency)
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_settings a
  WHERE a.org_id = o.id AND a.setting_key = s.setting_key
)
ON CONFLICT (org_id, setting_key) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_automation_settings_org_key 
ON public.automation_settings(org_id, setting_key);

-- Verify the function initializes settings correctly
CREATE OR REPLACE FUNCTION public.initialize_automation_settings(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.automation_settings (org_id, setting_key, enabled, schedule_frequency) VALUES
    (target_org_id, 'auto_match_on_upload', true, NULL),
    (target_org_id, 'scheduled_match', false, 'daily'),
    (target_org_id, 'auto_score', true, NULL),
    (target_org_id, 'scheduled_score', false, 'daily'),
    (target_org_id, 'auto_merge_duplicates', false, 'weekly')
  ON CONFLICT (org_id, setting_key) DO NOTHING;
END;
$function$;
-- Create automation_settings table
CREATE TABLE public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  schedule_frequency text,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view automation settings in their org"
  ON public.automation_settings FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert automation settings"
  ON public.automation_settings FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update automation settings"
  ON public.automation_settings FOR UPDATE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete automation settings"
  ON public.automation_settings FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create function to initialize default automation settings
CREATE OR REPLACE FUNCTION public.initialize_automation_settings(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.automation_settings (org_id, setting_key, enabled, schedule_frequency) VALUES
    (target_org_id, 'auto_match_on_upload', true, NULL),
    (target_org_id, 'scheduled_match', false, 'daily'),
    (target_org_id, 'auto_score', true, NULL),
    (target_org_id, 'scheduled_score', false, 'daily'),
    (target_org_id, 'auto_merge_duplicates', false, 'weekly')
  ON CONFLICT (org_id, setting_key) DO NOTHING;
END;
$$;

-- Update handle_new_user to initialize automation settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Create a default organization for new users
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Default Organization'))
  RETURNING id INTO default_org_id;
  
  -- Create user profile
  INSERT INTO public.user_profiles (user_id, org_id, full_name, role)
  VALUES (
    NEW.id,
    default_org_id,
    NEW.raw_user_meta_data->>'full_name',
    'admin'
  );
  
  -- Initialize feature flags
  PERFORM initialize_feature_flags(default_org_id);
  
  -- Initialize automation settings
  PERFORM initialize_automation_settings(default_org_id);
  
  RETURN NEW;
END;
$$;
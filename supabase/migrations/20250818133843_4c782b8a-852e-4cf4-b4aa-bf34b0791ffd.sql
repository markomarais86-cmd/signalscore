-- Fix function security issue by setting search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
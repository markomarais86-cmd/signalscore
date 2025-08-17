-- Drop and recreate the handle_new_user function to properly create organizations
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create a new organization for the user
  INSERT INTO public.organizations (name) 
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Personal Organization') || '''s Organization')
  RETURNING id INTO new_org_id;
  
  -- Create the user profile with the new org_id
  INSERT INTO public.user_profiles (user_id, org_id, full_name, role)
  VALUES (
    NEW.id,
    new_org_id,
    NEW.raw_user_meta_data ->> 'full_name',
    'admin'
  );
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure super_admin role exists in enum (if not already)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'org_admin', 'user');
  END IF;
END $$;

-- Assign super_admin role to current user
INSERT INTO public.user_roles (user_id, role)
VALUES ('3f522ac0-a461-4947-931b-6fa83879af93', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the insertion
SELECT user_id, role, created_at 
FROM public.user_roles 
WHERE user_id = '3f522ac0-a461-4947-931b-6fa83879af93';

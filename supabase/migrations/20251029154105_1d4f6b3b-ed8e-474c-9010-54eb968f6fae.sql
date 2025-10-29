-- Drop and recreate the function with correct types
DROP FUNCTION IF EXISTS get_users_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_users_with_emails(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  email character varying,
  full_name text,
  org_id uuid,
  org_name text,
  profile_role text,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    au.email::character varying,
    up.full_name,
    up.org_id,
    o.name as org_name,
    up.role as profile_role,
    up.created_at
  FROM user_profiles up
  LEFT JOIN organizations o ON o.id = up.org_id
  LEFT JOIN auth.users au ON au.id = up.user_id
  WHERE p_org_id IS NULL OR up.org_id = p_org_id
  ORDER BY up.created_at DESC;
END;
$$;
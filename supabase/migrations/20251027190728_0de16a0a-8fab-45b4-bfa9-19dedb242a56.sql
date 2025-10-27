-- Update generate_invitation_token to use built-in gen_random_uuid instead of pgcrypto
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a URL-safe token from UUID
  token := replace(replace(replace(gen_random_uuid()::text, '-', ''), '+', '-'), '/', '_');
  -- Add more randomness by combining two UUIDs
  token := token || replace(replace(replace(gen_random_uuid()::text, '-', ''), '+', '-'), '/', '_');
  RETURN substring(token, 1, 64);
END;
$$;
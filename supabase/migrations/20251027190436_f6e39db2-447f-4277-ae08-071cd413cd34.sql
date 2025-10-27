-- Enable pgcrypto extension for secure random token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the generate_invitation_token function to ensure it works properly
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a random token using pgcrypto
  token := encode(gen_random_bytes(32), 'base64');
  -- Make URL-safe
  token := replace(replace(replace(token, '+', '-'), '/', '_'), '=', '');
  RETURN token;
END;
$$;
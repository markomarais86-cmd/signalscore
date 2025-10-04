-- Fix security warning: Set search_path for normalize_domain_text function

DROP FUNCTION IF EXISTS public.normalize_domain_text(text);

CREATE OR REPLACE FUNCTION public.normalize_domain_text(domain_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF domain_input IS NULL OR domain_input = '' THEN
    RETURN NULL;
  END IF;
  
  normalized := LOWER(TRIM(domain_input));
  
  -- Remove protocols (http://, https://, //)
  normalized := REGEXP_REPLACE(normalized, '^(https?://|//)', '', 'i');
  
  -- Remove www. prefix
  normalized := REGEXP_REPLACE(normalized, '^www\.', '', 'i');
  
  -- Remove trailing slashes and paths
  normalized := REGEXP_REPLACE(normalized, '/.*$', '');
  
  -- Remove trailing dots
  normalized := REGEXP_REPLACE(normalized, '\.$', '');
  
  -- Return null if empty after normalization
  IF normalized = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN normalized;
END;
$$;
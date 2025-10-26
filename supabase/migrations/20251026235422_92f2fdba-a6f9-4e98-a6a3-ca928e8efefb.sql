-- Step 1: Add unique constraint on accounts (org_id, domain)
-- No duplicates found, safe to add constraint
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_org_domain_unique UNIQUE (org_id, domain);

-- Step 4: Fix security warnings - Add proper search_path to all functions
-- This prevents search_path mutable attacks

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Fix get_current_user_org_id function
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid();
$function$;

-- Fix is_current_user_admin function
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT role = 'admin' FROM public.user_profiles WHERE user_id = auth.uid();
$function$;

-- Fix normalize_domain_text function
CREATE OR REPLACE FUNCTION public.normalize_domain_text(domain_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  normalized text;
BEGIN
  IF domain_input IS NULL OR domain_input = '' THEN
    RETURN NULL;
  END IF;
  
  normalized := LOWER(TRIM(domain_input));
  normalized := REGEXP_REPLACE(normalized, '^(https?://|//)', '', 'i');
  normalized := REGEXP_REPLACE(normalized, '^www\.', '', 'i');
  normalized := REGEXP_REPLACE(normalized, '/.*$', '');
  normalized := REGEXP_REPLACE(normalized, '\.$', '');
  
  IF normalized = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN normalized;
END;
$function$;

-- Create index on domain for better performance with unique constraint
CREATE INDEX IF NOT EXISTS idx_accounts_org_domain ON public.accounts(org_id, domain) WHERE domain IS NOT NULL;
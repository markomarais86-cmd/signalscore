-- Phase 1: Emergency Cleanup - Domain Normalization & Deduplication

-- Step 1: Create domain normalization function
CREATE OR REPLACE FUNCTION public.normalize_domain_text(domain_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

-- Step 2: Normalize all existing account domains
UPDATE public.accounts
SET domain = public.normalize_domain_text(domain)
WHERE domain IS NOT NULL AND domain != '';

-- Step 3: Add index for better performance on duplicate detection
CREATE INDEX IF NOT EXISTS idx_accounts_org_domain 
ON public.accounts(org_id, domain) 
WHERE domain IS NOT NULL;

-- Note: We'll add the unique constraint AFTER running the merge utility
-- to avoid conflicts during the deduplication process
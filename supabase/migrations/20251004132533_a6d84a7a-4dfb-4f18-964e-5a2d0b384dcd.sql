-- Phase 2: Fix Root Cause - Part 1 (without unique constraint)
-- Note: Unique constraint will be added AFTER running the merge utility

-- Step 1: Create trigger to automatically normalize domains on insert/update
CREATE OR REPLACE FUNCTION public.normalize_account_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically normalize domain on insert or update
  IF NEW.domain IS NOT NULL AND NEW.domain != '' THEN
    NEW.domain := public.normalize_domain_text(NEW.domain);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to run on insert and update
DROP TRIGGER IF EXISTS normalize_account_domain_trigger ON public.accounts;
CREATE TRIGGER normalize_account_domain_trigger
BEFORE INSERT OR UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_account_domain();

-- Step 2: Add index for faster domain lookups
CREATE INDEX IF NOT EXISTS idx_accounts_domain_lookup 
ON public.accounts(domain) 
WHERE domain IS NOT NULL;
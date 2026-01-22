-- Create phone validation function that sanitizes garbage data
CREATE OR REPLACE FUNCTION public.validate_phone_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate phone field
  IF NEW.phone IS NOT NULL THEN
    IF NEW.phone IN ('true', 'false', 'null', 'undefined', '') 
       OR NEW.phone ~ '^\d+\.\d{4,}$'
       OR NEW.phone ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.phone, '\D', '', 'g')) < 7 THEN
      NEW.phone := NULL;
    END IF;
  END IF;

  -- Validate mobile field
  IF NEW.mobile IS NOT NULL THEN
    IF NEW.mobile IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.mobile ~ '^\d+\.\d{4,}$'
       OR NEW.mobile ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.mobile, '\D', '', 'g')) < 7 THEN
      NEW.mobile := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create phone validation function for Leads (has direct_phone)
CREATE OR REPLACE FUNCTION public.validate_leads_phone_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate phone field
  IF NEW.phone IS NOT NULL THEN
    IF NEW.phone IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.phone ~ '^\d+\.\d{4,}$'
       OR NEW.phone ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.phone, '\D', '', 'g')) < 7 THEN
      NEW.phone := NULL;
    END IF;
  END IF;

  -- Validate mobile field
  IF NEW.mobile IS NOT NULL THEN
    IF NEW.mobile IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.mobile ~ '^\d+\.\d{4,}$'
       OR NEW.mobile ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.mobile, '\D', '', 'g')) < 7 THEN
      NEW.mobile := NULL;
    END IF;
  END IF;

  -- Validate direct_phone field
  IF NEW.direct_phone IS NOT NULL THEN
    IF NEW.direct_phone IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.direct_phone ~ '^\d+\.\d{4,}$'
       OR NEW.direct_phone ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.direct_phone, '\D', '', 'g')) < 7 THEN
      NEW.direct_phone := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create phone validation function for accounts (has company_main_phone)
CREATE OR REPLACE FUNCTION public.validate_accounts_phone_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate phone field
  IF NEW.phone IS NOT NULL THEN
    IF NEW.phone IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.phone ~ '^\d+\.\d{4,}$'
       OR NEW.phone ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.phone, '\D', '', 'g')) < 7 THEN
      NEW.phone := NULL;
    END IF;
  END IF;

  -- Validate mobile field
  IF NEW.mobile IS NOT NULL THEN
    IF NEW.mobile IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.mobile ~ '^\d+\.\d{4,}$'
       OR NEW.mobile ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.mobile, '\D', '', 'g')) < 7 THEN
      NEW.mobile := NULL;
    END IF;
  END IF;

  -- Validate company_main_phone field
  IF NEW.company_main_phone IS NOT NULL THEN
    IF NEW.company_main_phone IN ('true', 'false', 'null', 'undefined', '')
       OR NEW.company_main_phone ~ '^\d+\.\d{4,}$'
       OR NEW.company_main_phone ~ '^(\d)\1{5,}$'
       OR LENGTH(REGEXP_REPLACE(NEW.company_main_phone, '\D', '', 'g')) < 7 THEN
      NEW.company_main_phone := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS validate_leads_phones ON "Leads";
DROP TRIGGER IF EXISTS validate_accounts_phones ON accounts;

-- Create trigger on Leads table
CREATE TRIGGER validate_leads_phones
  BEFORE INSERT OR UPDATE ON "Leads"
  FOR EACH ROW EXECUTE FUNCTION public.validate_leads_phone_fields();

-- Create trigger on accounts table
CREATE TRIGGER validate_accounts_phones
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_accounts_phone_fields();
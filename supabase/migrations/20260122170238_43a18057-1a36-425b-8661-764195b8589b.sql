-- Database Cleanup: Remove invalid phone data and normalize existing phones
-- This migration cleans up garbage phone data (boolean strings, GPS coordinates, etc.)

-- Step 1: Clean boolean string garbage from Leads table
UPDATE "Leads"
SET 
  phone = NULL
WHERE phone IN ('true', 'false', 'null', 'undefined', '');

UPDATE "Leads"
SET 
  mobile = NULL
WHERE mobile IN ('true', 'false', 'null', 'undefined', '');

UPDATE "Leads"
SET 
  direct_phone = NULL
WHERE direct_phone IN ('true', 'false', 'null', 'undefined', '');

-- Step 2: Clean boolean string garbage from accounts table
UPDATE accounts
SET 
  phone = NULL
WHERE phone IN ('true', 'false', 'null', 'undefined', '');

UPDATE accounts
SET 
  mobile = NULL
WHERE mobile IN ('true', 'false', 'null', 'undefined', '');

UPDATE accounts
SET 
  company_main_phone = NULL
WHERE company_main_phone IN ('true', 'false', 'null', 'undefined', '');

-- Step 3: Clear phones that look like GPS coordinates (contain decimal points with many digits)
UPDATE "Leads"
SET phone = NULL
WHERE phone ~ '^\d+\.\d{4,}$';

UPDATE "Leads"
SET mobile = NULL
WHERE mobile ~ '^\d+\.\d{4,}$';

UPDATE "Leads"
SET direct_phone = NULL
WHERE direct_phone ~ '^\d+\.\d{4,}$';

UPDATE accounts
SET phone = NULL
WHERE phone ~ '^\d+\.\d{4,}$';

UPDATE accounts
SET mobile = NULL
WHERE mobile ~ '^\d+\.\d{4,}$';

UPDATE accounts
SET company_main_phone = NULL
WHERE company_main_phone ~ '^\d+\.\d{4,}$';

-- Step 4: Clear phones with repeating digit patterns (like 999999, 000000, etc.)
UPDATE "Leads"
SET phone = NULL
WHERE phone ~ '^(\d)\1{5,}$';

UPDATE "Leads"
SET mobile = NULL
WHERE mobile ~ '^(\d)\1{5,}$';

UPDATE "Leads"
SET direct_phone = NULL
WHERE direct_phone ~ '^(\d)\1{5,}$';

UPDATE accounts
SET phone = NULL
WHERE phone ~ '^(\d)\1{5,}$';

UPDATE accounts
SET mobile = NULL
WHERE mobile ~ '^(\d)\1{5,}$';

UPDATE accounts
SET company_main_phone = NULL
WHERE company_main_phone ~ '^(\d)\1{5,}$';

-- Step 5: Clear phones that are too short (less than 7 digits)
UPDATE "Leads"
SET phone = NULL
WHERE LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) < 7
  AND phone IS NOT NULL;

UPDATE "Leads"
SET mobile = NULL
WHERE LENGTH(REGEXP_REPLACE(mobile, '\D', '', 'g')) < 7
  AND mobile IS NOT NULL;

UPDATE "Leads"
SET direct_phone = NULL
WHERE LENGTH(REGEXP_REPLACE(direct_phone, '\D', '', 'g')) < 7
  AND direct_phone IS NOT NULL;

UPDATE accounts
SET phone = NULL
WHERE LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) < 7
  AND phone IS NOT NULL;

UPDATE accounts
SET mobile = NULL
WHERE LENGTH(REGEXP_REPLACE(mobile, '\D', '', 'g')) < 7
  AND mobile IS NOT NULL;

UPDATE accounts
SET company_main_phone = NULL
WHERE LENGTH(REGEXP_REPLACE(company_main_phone, '\D', '', 'g')) < 7
  AND company_main_phone IS NOT NULL;

-- Step 6: Create a validation trigger to prevent future garbage data
CREATE OR REPLACE FUNCTION validate_phone_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate phone field
  IF NEW.phone IS NOT NULL THEN
    -- Reject boolean strings
    IF NEW.phone IN ('true', 'false', 'null', 'undefined', '') THEN
      NEW.phone := NULL;
    -- Reject GPS coordinates
    ELSIF NEW.phone ~ '^\d+\.\d{4,}$' THEN
      NEW.phone := NULL;
    -- Reject repeating patterns
    ELSIF NEW.phone ~ '^(\d)\1{5,}$' THEN
      NEW.phone := NULL;
    -- Reject too short
    ELSIF LENGTH(REGEXP_REPLACE(NEW.phone, '\D', '', 'g')) < 7 THEN
      NEW.phone := NULL;
    END IF;
  END IF;

  -- Validate mobile field
  IF NEW.mobile IS NOT NULL THEN
    IF NEW.mobile IN ('true', 'false', 'null', 'undefined', '') THEN
      NEW.mobile := NULL;
    ELSIF NEW.mobile ~ '^\d+\.\d{4,}$' THEN
      NEW.mobile := NULL;
    ELSIF NEW.mobile ~ '^(\d)\1{5,}$' THEN
      NEW.mobile := NULL;
    ELSIF LENGTH(REGEXP_REPLACE(NEW.mobile, '\D', '', 'g')) < 7 THEN
      NEW.mobile := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Leads table
DROP TRIGGER IF EXISTS validate_leads_phone_fields ON "Leads";
CREATE TRIGGER validate_leads_phone_fields
  BEFORE INSERT OR UPDATE ON "Leads"
  FOR EACH ROW
  EXECUTE FUNCTION validate_phone_fields();

-- Create trigger for accounts table  
DROP TRIGGER IF EXISTS validate_accounts_phone_fields ON accounts;
CREATE TRIGGER validate_accounts_phone_fields
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION validate_phone_fields();
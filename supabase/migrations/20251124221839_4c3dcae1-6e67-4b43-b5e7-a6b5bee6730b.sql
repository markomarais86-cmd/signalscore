-- Add phone_e164 column to Leads table for E.164 formatted phone numbers
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

-- Add mobile column if it doesn't exist
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS mobile TEXT;

-- Create function to format phone numbers to E.164
CREATE OR REPLACE FUNCTION format_phone_to_e164(phone_input TEXT, country_code TEXT DEFAULT '1')
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
BEGIN
  -- Return NULL if input is NULL or empty
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  
  -- If already in E.164 format, return as is
  IF phone_input ~ '^\+[1-9]\d{1,14}$' THEN
    RETURN phone_input;
  END IF;
  
  -- Remove all non-digit characters
  digits := regexp_replace(phone_input, '\D', '', 'g');
  
  -- Return NULL if no digits found
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  
  -- If starts with country code, add + prefix
  IF length(digits) >= 10 AND (digits ~ '^1' OR digits ~ '^44' OR digits ~ '^49' OR digits ~ '^33' OR digits ~ '^61') THEN
    RETURN '+' || digits;
  END IF;
  
  -- If 10 digits (US/Canada without country code), add +1
  IF length(digits) = 10 THEN
    RETURN '+' || country_code || digits;
  END IF;
  
  -- For other cases, add + and default country code
  RETURN '+' || country_code || digits;
END;
$$;

-- Create trigger function to auto-format phone numbers on insert/update
CREATE OR REPLACE FUNCTION auto_format_lead_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inferred_country_code TEXT := '1';
BEGIN
  -- Infer country code from account if possible
  IF NEW.account_external_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN a.country IN ('United States', 'USA', 'US', 'Canada') THEN '1'
        WHEN a.country IN ('United Kingdom', 'UK') THEN '44'
        WHEN a.country = 'Germany' THEN '49'
        WHEN a.country = 'France' THEN '33'
        WHEN a.country = 'Australia' THEN '61'
        WHEN a.country = 'Japan' THEN '81'
        WHEN a.country = 'Netherlands' THEN '31'
        WHEN a.country = 'Singapore' THEN '65'
        ELSE '1'
      END INTO inferred_country_code
    FROM accounts a
    WHERE a.external_id = NEW.account_external_id
      AND a.org_id = NEW.org_id;
  END IF;
  
  -- Format phone to E.164 if phone changed
  IF NEW.phone IS DISTINCT FROM OLD.phone OR (TG_OP = 'INSERT' AND NEW.phone IS NOT NULL) THEN
    NEW.phone_e164 := format_phone_to_e164(NEW.phone, inferred_country_code);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_format_lead_phone ON "Leads";

-- Create trigger on Leads table
CREATE TRIGGER trigger_format_lead_phone
  BEFORE INSERT OR UPDATE OF phone
  ON "Leads"
  FOR EACH ROW
  EXECUTE FUNCTION auto_format_lead_phone();

-- Add comment
COMMENT ON COLUMN "Leads".phone_e164 IS 'Phone number in E.164 international format (+[country code][number])';
COMMENT ON FUNCTION format_phone_to_e164(TEXT, TEXT) IS 'Formats a phone number to E.164 international standard';

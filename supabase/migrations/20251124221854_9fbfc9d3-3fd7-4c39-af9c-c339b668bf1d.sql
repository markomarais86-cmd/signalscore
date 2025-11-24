-- Fix search_path for format_phone_to_e164 function
CREATE OR REPLACE FUNCTION format_phone_to_e164(phone_input TEXT, country_code TEXT DEFAULT '1')
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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

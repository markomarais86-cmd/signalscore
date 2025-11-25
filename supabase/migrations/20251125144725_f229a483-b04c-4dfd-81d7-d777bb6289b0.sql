-- Backfill phone_e164 for all existing leads
-- Drop existing function if parameter names are different
DROP FUNCTION IF EXISTS format_phone_to_e164(text, text);

-- Create function to format phone to E.164
CREATE OR REPLACE FUNCTION format_phone_to_e164(phone_input text, country_input text DEFAULT 'United States')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  country_code_val text;
  digits text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get country code based on country
  country_code_val := CASE
    WHEN country_input ILIKE '%united states%' OR country_input ILIKE '%usa%' OR country_input ILIKE '%us%' THEN '1'
    WHEN country_input ILIKE '%canada%' THEN '1'
    WHEN country_input ILIKE '%united kingdom%' OR country_input ILIKE '%uk%' THEN '44'
    WHEN country_input ILIKE '%germany%' THEN '49'
    WHEN country_input ILIKE '%france%' THEN '33'
    WHEN country_input ILIKE '%australia%' THEN '61'
    WHEN country_input ILIKE '%japan%' THEN '81'
    WHEN country_input ILIKE '%netherlands%' THEN '31'
    WHEN country_input ILIKE '%singapore%' THEN '65'
    WHEN country_input ILIKE '%switzerland%' THEN '41'
    WHEN country_input ILIKE '%spain%' THEN '34'
    WHEN country_input ILIKE '%italy%' THEN '39'
    WHEN country_input ILIKE '%sweden%' THEN '46'
    WHEN country_input ILIKE '%norway%' THEN '47'
    WHEN country_input ILIKE '%denmark%' THEN '45'
    WHEN country_input ILIKE '%finland%' THEN '358'
    WHEN country_input ILIKE '%belgium%' THEN '32'
    WHEN country_input ILIKE '%austria%' THEN '43'
    WHEN country_input ILIKE '%ireland%' THEN '353'
    WHEN country_input ILIKE '%new zealand%' THEN '64'
    WHEN country_input ILIKE '%south africa%' THEN '27'
    WHEN country_input ILIKE '%india%' THEN '91'
    WHEN country_input ILIKE '%china%' THEN '86'
    WHEN country_input ILIKE '%brazil%' THEN '55'
    WHEN country_input ILIKE '%mexico%' THEN '52'
    ELSE '1'
  END;
  
  digits := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
  
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  
  IF NOT digits ~ ('^' || country_code_val) THEN
    digits := country_code_val || digits;
  END IF;
  
  RETURN '+' || digits;
END;
$$;

-- Backfill phone_e164 for all existing leads
UPDATE "Leads"
SET phone_e164 = format_phone_to_e164(phone, COALESCE(country, 'United States'))
WHERE phone IS NOT NULL 
  AND phone != ''
  AND (phone_e164 IS NULL OR phone_e164 = '');
-- Step 1: Create improved country normalization function
CREATE OR REPLACE FUNCTION normalize_country_value(country_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  trimmed text;
BEGIN
  IF country_input IS NULL OR country_input = '' THEN
    RETURN NULL;
  END IF;
  
  trimmed := TRIM(country_input);
  
  -- Filter out phone numbers (contains digits and special chars)
  IF trimmed ~ '^[\d\s\-\(\)\+\.]+$' AND LENGTH(trimmed) >= 7 THEN
    RETURN NULL;
  END IF;
  
  -- Filter out US state abbreviations (exactly 2 uppercase letters)
  IF trimmed ~ '^[A-Z]{2}$' THEN
    RETURN NULL;
  END IF;
  
  -- Normalize common country variations
  normalized := LOWER(trimmed);
  
  normalized := CASE
    WHEN normalized IN ('gb', 'uk', 'great britain') THEN 'United Kingdom'
    WHEN normalized IN ('usa', 'us', 'united states of america') THEN 'United States'
    WHEN normalized IN ('uae', 'united arab em') THEN 'United Arab Emirates'
    WHEN normalized = 'korea' THEN 'South Korea'
    WHEN normalized IN ('russia', 'russian fed') THEN 'Russian Federation'
    WHEN normalized = 'vietnam' THEN 'Viet Nam'
    WHEN normalized IN ('czech republic', 'czechia') THEN 'Czechia'
    WHEN normalized = 'deutschland' THEN 'Germany'
    WHEN normalized = 'espana' THEN 'Spain'
    WHEN normalized = 'italia' THEN 'Italy'
    WHEN normalized = 'nederland' THEN 'Netherlands'
    WHEN normalized = 'schweiz' THEN 'Switzerland'
    ELSE 
      -- Capitalize first letter of each word
      INITCAP(trimmed)
  END;
  
  RETURN normalized;
END;
$$;

-- Step 2: Update all existing accounts with normalized country values
UPDATE accounts
SET country = normalize_country_value(country)
WHERE country IS NOT NULL 
  AND country != ''
  AND (
    country ~ '^[\d\s\-\(\)\+\.]+$' -- phone numbers
    OR country ~ '^[A-Z]{2}$' -- state codes
    OR LOWER(country) IN ('gb', 'uk', 'usa', 'us', 'uae', 'korea', 'russia', 'vietnam', 'czech republic')
  );

-- Step 3: Create trigger to auto-normalize country on insert/update
CREATE OR REPLACE FUNCTION trigger_normalize_country()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.country IS NOT NULL AND NEW.country != '' THEN
    NEW.country := normalize_country_value(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_country_trigger ON accounts;
CREATE TRIGGER normalize_country_trigger
  BEFORE INSERT OR UPDATE OF country ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_country();

COMMENT ON FUNCTION normalize_country_value IS 'Normalizes country names to standard format, filters out phone numbers and state codes';
COMMENT ON TRIGGER normalize_country_trigger ON accounts IS 'Automatically normalizes country field on insert/update';
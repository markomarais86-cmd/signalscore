-- Step 1: Delete duplicate website records (keep lowest id)
DELETE FROM master_account_data a
USING master_account_data b
WHERE a.id > b.id 
  AND a."Website" = b."Website"
  AND a."Website" IS NOT NULL 
  AND a."Website" != '';

-- Step 2: Delete duplicates without website (by Company name, keep lowest id)
DELETE FROM master_account_data a
USING master_account_data b
WHERE a.id > b.id 
  AND a."Company" = b."Company"
  AND (a."Website" IS NULL OR a."Website" = '')
  AND (b."Website" IS NULL OR b."Website" = '');

-- Step 3: Add unique constraint on Website to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_account_data_website_unique 
ON master_account_data("Website") 
WHERE "Website" IS NOT NULL AND "Website" != '';

-- Step 4: Normalize domains
UPDATE master_account_data
SET domain_normalized = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("Website", '^(https?://)?', ''), '^www\.', ''))
WHERE "Website" IS NOT NULL AND "Website" != '';

-- Step 5: Convert employee count to integer
UPDATE master_account_data
SET employee_count_int = NULLIF(REGEXP_REPLACE("No. of Employees", '[^0-9]', '', 'g'), '')::INTEGER
WHERE "No. of Employees" IS NOT NULL AND "No. of Employees" != '';

-- Step 6: Convert founded year
UPDATE master_account_data
SET founded_year_int = NULLIF("Founded Year", '')::INTEGER
WHERE "Founded Year" ~ '^\d{4}$';

-- Step 7: Create index on normalized domain for fast lookups
CREATE INDEX IF NOT EXISTS idx_master_domain_normalized ON master_account_data(domain_normalized);
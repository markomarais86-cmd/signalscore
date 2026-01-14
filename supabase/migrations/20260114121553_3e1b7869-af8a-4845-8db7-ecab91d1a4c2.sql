-- Add proper metrics tracking columns to enrichment_jobs
ALTER TABLE enrichment_jobs 
ADD COLUMN IF NOT EXISTS accounts_enriched integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fields_enriched integer DEFAULT 0;

-- Add comment for deprecated column
COMMENT ON COLUMN enrichment_jobs.enriched_records IS 'DEPRECATED: Use accounts_enriched and fields_enriched for accurate metrics';

-- Update existing records to have reasonable defaults based on enriched_records
-- Assume enriched_records was actually counting accounts (best estimate)
UPDATE enrichment_jobs 
SET accounts_enriched = COALESCE(enriched_records, 0),
    fields_enriched = COALESCE(enriched_records, 0) * 3 -- Estimate ~3 fields per account
WHERE accounts_enriched = 0 OR accounts_enriched IS NULL;
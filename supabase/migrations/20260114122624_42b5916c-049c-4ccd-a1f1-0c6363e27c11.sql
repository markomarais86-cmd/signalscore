-- Fix corrupted historical enrichment job metrics
-- Where accounts_enriched > processed_records (impossible), cap it
UPDATE enrichment_jobs 
SET accounts_enriched = processed_records
WHERE accounts_enriched > processed_records 
  AND processed_records > 0;

-- Where accounts_enriched is 0 but enriched_records has valid data, use it
UPDATE enrichment_jobs 
SET accounts_enriched = enriched_records
WHERE (accounts_enriched IS NULL OR accounts_enriched = 0)
  AND enriched_records IS NOT NULL 
  AND enriched_records > 0
  AND enriched_records <= COALESCE(processed_records, total_records, enriched_records);

-- Set fields_enriched estimate for historical data (avg 2.5 fields per account)
UPDATE enrichment_jobs 
SET fields_enriched = ROUND(accounts_enriched * 2.5)
WHERE (fields_enriched IS NULL OR fields_enriched = 0)
  AND accounts_enriched > 0;
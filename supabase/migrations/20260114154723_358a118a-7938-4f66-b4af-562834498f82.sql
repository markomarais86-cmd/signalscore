-- Reset the job for fresh start with contact discovery
UPDATE enrichment_jobs 
SET status = 'pending',
    cursor = NULL,
    processed_records = 0,
    accounts_enriched = 0,
    fields_enriched = 0,
    enriched_records = 0,
    failed_records = 0,
    error_message = NULL
WHERE id = '77850744-c09f-4f69-bc5a-4c6d0836e95d';
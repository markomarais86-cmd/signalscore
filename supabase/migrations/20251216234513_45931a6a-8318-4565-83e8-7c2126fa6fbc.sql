-- Fix the stuck job with 0 records
UPDATE enrichment_jobs 
SET status = 'cancelled', error_message = 'Cancelled: invalid job with 0 records'
WHERE id = '339be5d2-9764-4351-b6f7-4778c2f8cfc0';
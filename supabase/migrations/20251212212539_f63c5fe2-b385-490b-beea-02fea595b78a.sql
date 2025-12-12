-- Mark the test job as completed since it finished successfully
UPDATE enrichment_jobs
SET status = 'completed', completed_at = now()
WHERE id = 'f278ed89-8264-4d02-951c-97055f8a0d18';
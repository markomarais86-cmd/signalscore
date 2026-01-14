-- Resume the enrichment job so contact discovery can run
UPDATE enrichment_jobs 
SET status = 'processing'
WHERE id = 'c1a8fad7-3803-4a6c-9366-7bda5637eeff'
AND org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
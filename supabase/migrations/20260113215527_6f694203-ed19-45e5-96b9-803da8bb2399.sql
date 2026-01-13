-- Add cursor column for resumable pagination
ALTER TABLE enrichment_jobs 
ADD COLUMN IF NOT EXISTS cursor UUID DEFAULT NULL;

COMMENT ON COLUMN enrichment_jobs.cursor IS 
'Last processed account ID for cursor-based resumption in orchestrator-worker pattern';
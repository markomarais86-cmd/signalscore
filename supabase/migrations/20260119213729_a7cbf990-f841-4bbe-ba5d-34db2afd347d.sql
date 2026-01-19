-- Add input_data column to enrichment_jobs for storing lead/account inputs for async processing
ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS input_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.enrichment_jobs.input_data IS 'Stores leads/accounts array for async enrichment jobs. Set during job creation, processed by background worker.';

-- Add index for finding jobs with unprocessed input data
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_pending_input 
ON public.enrichment_jobs(status, created_at) 
WHERE status = 'pending' AND input_data IS NOT NULL;
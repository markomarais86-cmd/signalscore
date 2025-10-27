-- Add batch_size column to enrichment_jobs table
ALTER TABLE public.enrichment_jobs 
ADD COLUMN batch_size integer DEFAULT 100;

-- Add comment
COMMENT ON COLUMN public.enrichment_jobs.batch_size IS 'Number of accounts to process in this enrichment job';
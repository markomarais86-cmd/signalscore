-- Add source_breakdown column to enrichment_jobs for tracking per-source metrics
ALTER TABLE enrichment_jobs 
ADD COLUMN IF NOT EXISTS source_breakdown JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN enrichment_jobs.source_breakdown IS 
'Tracks per-source enrichment metrics: {"apollo": {"attempted": N, "enriched": N, "failed": N}, "pdl": {...}, "ai": {...}}';
-- Mark stuck enrichment jobs as completed
UPDATE enrichment_jobs
SET 
  status = 'completed',
  completed_at = now()
WHERE status = 'processing'
  AND id IN ('0bc9dacf-c90b-4d56-916b-80af15c8b6b4', '01a2fbd0-6ea4-4d2f-9a9f-5c4e77f5f3c4');

-- Create function to auto-complete stuck jobs (>15 minutes in processing)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_enrichment_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.enrichment_jobs
  SET 
    status = 'failed',
    completed_at = now()
  WHERE status = 'processing'
    AND started_at < (now() - interval '15 minutes');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
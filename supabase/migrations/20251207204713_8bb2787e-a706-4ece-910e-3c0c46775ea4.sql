-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS public.cleanup_stuck_enrichment_jobs();

-- Create function to clean up stuck enrichment jobs (stuck > 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_enrichment_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stuck_count integer;
  v_stuck_jobs jsonb;
BEGIN
  -- Get stuck jobs for logging
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'job_type', job_type,
    'provider', provider,
    'started_at', started_at,
    'hours_stuck', EXTRACT(EPOCH FROM (now() - started_at)) / 3600
  ))
  INTO v_stuck_jobs
  FROM enrichment_jobs
  WHERE status IN ('processing', 'pending')
    AND started_at < now() - interval '1 hour';

  -- Mark stuck jobs as failed
  UPDATE enrichment_jobs
  SET 
    status = 'failed',
    error_message = 'Job timed out after 1 hour of processing',
    completed_at = now()
  WHERE status IN ('processing', 'pending')
    AND started_at < now() - interval '1 hour';

  GET DIAGNOSTICS v_stuck_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned_up', v_stuck_count,
    'jobs', COALESCE(v_stuck_jobs, '[]'::jsonb)
  );
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_stuck_enrichment_jobs() TO authenticated;
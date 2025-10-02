-- Create function for atomic bulk scoring job updates
CREATE OR REPLACE FUNCTION public.increment_bulk_scoring_job_progress(
  job_id_param uuid,
  chunk_successful integer,
  chunk_failed integer,
  processed_count integer,
  current_chunk_num integer,
  is_last_chunk boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.bulk_scoring_jobs
  SET 
    successful_scores = COALESCE(successful_scores, 0) + chunk_successful,
    failed_scores = COALESCE(failed_scores, 0) + chunk_failed,
    processed_accounts = processed_count,
    current_chunk = current_chunk_num,
    status = CASE WHEN is_last_chunk THEN 'completed' ELSE 'processing' END,
    completed_at = CASE WHEN is_last_chunk THEN now() ELSE completed_at END,
    last_processed_at = now(),
    updated_at = now()
  WHERE id = job_id_param;
END;
$function$;
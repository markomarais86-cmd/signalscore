-- PHASE 1 (Fixed): Critical Fixes - Missing RPC Function

-- 1. Add missing bulk scoring progress increment function
CREATE OR REPLACE FUNCTION public.increment_bulk_scoring_job_progress(
  job_id_param UUID,
  chunk_successful INTEGER,
  chunk_failed INTEGER,
  processed_count INTEGER,
  current_chunk_num INTEGER,
  is_last_chunk BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE public.bulk_scoring_jobs
  SET 
    successful_scores = successful_scores + chunk_successful,
    failed_scores = failed_scores + chunk_failed,
    processed_accounts = processed_count,
    current_chunk = current_chunk_num,
    last_processed_at = now(),
    status = CASE WHEN is_last_chunk THEN 'completed'::text ELSE status END,
    completed_at = CASE WHEN is_last_chunk THEN now() ELSE completed_at END
  WHERE id = job_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Add normalize_country function
CREATE OR REPLACE FUNCTION public.normalize_country(country_input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF country_input IS NULL OR country_input = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN INITCAP(TRIM(country_input));
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;
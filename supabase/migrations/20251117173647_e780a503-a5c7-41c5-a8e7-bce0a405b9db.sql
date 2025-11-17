-- Add progress tracking fields to enrichment_jobs table
ALTER TABLE public.enrichment_jobs
ADD COLUMN IF NOT EXISTS current_batch INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_progress_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS can_pause BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient progress polling
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status_progress 
ON public.enrichment_jobs(org_id, status, last_progress_update DESC);

-- Create function to update job progress
CREATE OR REPLACE FUNCTION public.update_enrichment_job_progress(
  p_job_id uuid,
  p_processed_records integer,
  p_enriched_records integer,
  p_failed_records integer,
  p_current_batch integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_progress_pct NUMERIC;
  v_estimated_completion TIMESTAMP WITH TIME ZONE;
  v_records_per_second NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_remaining_records INTEGER;
BEGIN
  -- Get current job state
  SELECT * INTO v_job
  FROM public.enrichment_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Calculate progress percentage
  IF v_job.total_records > 0 THEN
    v_progress_pct := ROUND((p_processed_records::NUMERIC / v_job.total_records * 100), 2);
  ELSE
    v_progress_pct := 0;
  END IF;

  -- Calculate estimated completion time
  IF v_job.started_at IS NOT NULL AND p_processed_records > 0 THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_job.started_at));
    v_records_per_second := p_processed_records::NUMERIC / NULLIF(v_elapsed_seconds, 0);
    v_remaining_records := v_job.total_records - p_processed_records;
    
    IF v_records_per_second > 0 THEN
      v_estimated_completion := now() + (v_remaining_records / v_records_per_second || ' seconds')::INTERVAL;
    END IF;
  END IF;

  -- Update job progress
  UPDATE public.enrichment_jobs
  SET 
    processed_records = p_processed_records,
    enriched_records = p_enriched_records,
    failed_records = p_failed_records,
    current_batch = COALESCE(p_current_batch, current_batch),
    progress_percentage = v_progress_pct,
    estimated_completion_at = v_estimated_completion,
    last_progress_update = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'progress_percentage', v_progress_pct,
    'processed_records', p_processed_records,
    'total_records', v_job.total_records,
    'estimated_completion_at', v_estimated_completion
  );
END;
$function$;

-- Create function to pause enrichment job
CREATE OR REPLACE FUNCTION public.pause_enrichment_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job
  FROM public.enrichment_jobs
  WHERE id = p_job_id
    AND status = 'running'
    AND can_pause = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found or cannot be paused');
  END IF;

  UPDATE public.enrichment_jobs
  SET 
    status = 'paused',
    paused_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'status', 'paused'
  );
END;
$function$;

-- Create function to resume enrichment job
CREATE OR REPLACE FUNCTION public.resume_enrichment_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job
  FROM public.enrichment_jobs
  WHERE id = p_job_id
    AND status = 'paused';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found or not paused');
  END IF;

  UPDATE public.enrichment_jobs
  SET 
    status = 'running',
    paused_at = NULL
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'status', 'running'
  );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_enrichment_job_progress(uuid, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_enrichment_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_enrichment_job(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.update_enrichment_job_progress IS 'Updates enrichment job progress with estimated completion time';
COMMENT ON FUNCTION public.pause_enrichment_job IS 'Pauses a running enrichment job';
COMMENT ON FUNCTION public.resume_enrichment_job IS 'Resumes a paused enrichment job';
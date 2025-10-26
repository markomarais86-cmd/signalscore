-- Step 1: Clear stuck/corrupted bulk scoring job
DELETE FROM bulk_scoring_jobs 
WHERE status = 'processing' 
  AND processed_accounts > total_accounts;

-- Step 2: Drop and recreate increment_bulk_scoring_job_progress with fixes
DROP FUNCTION IF EXISTS public.increment_bulk_scoring_job_progress(uuid, integer, integer, integer, integer, boolean);

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
DECLARE
  v_total_accounts integer;
BEGIN
  -- Get total accounts for this job to prevent overflow
  SELECT total_accounts INTO v_total_accounts
  FROM public.bulk_scoring_jobs
  WHERE id = job_id_param;

  -- Cap processed_count at total_accounts to prevent corruption
  processed_count := LEAST(processed_count, v_total_accounts);

  UPDATE public.bulk_scoring_jobs
  SET 
    successful_scores = COALESCE(successful_scores, 0) + chunk_successful,
    failed_scores = COALESCE(failed_scores, 0) + chunk_failed,
    processed_accounts = processed_count,
    current_chunk = current_chunk_num,
    status = CASE 
      WHEN is_last_chunk THEN 'completed' 
      WHEN processed_count >= v_total_accounts THEN 'completed'
      ELSE 'processing' 
    END,
    completed_at = CASE 
      WHEN is_last_chunk OR processed_count >= v_total_accounts THEN now() 
      ELSE completed_at 
    END,
    last_processed_at = now(),
    updated_at = now()
  WHERE id = job_id_param;
END;
$function$;

-- Step 3: Create auto_score_failures table for monitoring
CREATE TABLE IF NOT EXISTS public.auto_score_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  account_external_id text NOT NULL,
  account_name text,
  error_message text,
  error_details jsonb,
  trigger_type text, -- 'new_account', 'enrichment', 'icp_change'
  retry_count integer DEFAULT 0,
  last_retry_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for querying failures
CREATE INDEX IF NOT EXISTS idx_auto_score_failures_org_id ON public.auto_score_failures(org_id);
CREATE INDEX IF NOT EXISTS idx_auto_score_failures_account ON public.auto_score_failures(org_id, account_external_id);

-- Enable RLS
ALTER TABLE public.auto_score_failures ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view auto score failures in their org"
  ON public.auto_score_failures
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert auto score failures"
  ON public.auto_score_failures
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete auto score failures"
  ON public.auto_score_failures
  FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Step 4: Update auto_score_account to log failures
CREATE OR REPLACE FUNCTION public.auto_score_account(p_account_external_id text, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_icp_id UUID;
  v_score_result JSONB;
  v_account_name TEXT;
BEGIN
  -- Get account name for error logging
  SELECT name INTO v_account_name
  FROM public.accounts
  WHERE external_id = p_account_external_id AND org_id = p_org_id;

  -- Get active ICP
  v_icp_id := public.get_active_icp_id(p_org_id);
  
  -- Skip if no ICP is configured
  IF v_icp_id IS NULL THEN
    INSERT INTO public.auto_score_failures (
      org_id, account_external_id, account_name, 
      error_message, trigger_type
    ) VALUES (
      p_org_id, p_account_external_id, v_account_name,
      'No active ICP profile found', 'auto_score'
    );
    RETURN;
  END IF;
  
  -- Calculate score
  BEGIN
    v_score_result := public.calculate_account_score(p_account_external_id, v_icp_id, p_org_id);
  EXCEPTION WHEN OTHERS THEN
    -- Log failure
    INSERT INTO public.auto_score_failures (
      org_id, account_external_id, account_name,
      error_message, error_details, trigger_type
    ) VALUES (
      p_org_id, p_account_external_id, v_account_name,
      SQLERRM,
      jsonb_build_object('icp_id', v_icp_id, 'sqlstate', SQLSTATE),
      'auto_score'
    );
    RETURN;
  END;
  
  -- Insert or update score
  INSERT INTO public.scores (
    org_id,
    account_external_id,
    overall,
    fit,
    intent,
    reachability,
    reasons,
    scoring_version
  ) VALUES (
    p_org_id,
    p_account_external_id,
    (v_score_result->>'overall')::INTEGER,
    (v_score_result->>'fit')::INTEGER,
    (v_score_result->>'intent')::INTEGER,
    (v_score_result->>'reachability')::INTEGER,
    v_score_result->'breakdown',
    'auto_v1.0'
  )
  ON CONFLICT (org_id, account_external_id)
  DO UPDATE SET
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = now();
END;
$function$;
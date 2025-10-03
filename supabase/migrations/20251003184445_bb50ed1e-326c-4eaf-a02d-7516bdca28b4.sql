-- Phase 3: Accuracy & Monitoring - Add Failed Scoring Tracking

-- Table to track failed scoring attempts
CREATE TABLE IF NOT EXISTS public.failed_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.bulk_scoring_jobs(id) ON DELETE SET NULL,
  account_external_id text NOT NULL,
  account_name text,
  icp_id uuid REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  error_message text,
  error_details jsonb,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  last_retry_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.failed_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view failed scores in their org"
ON public.failed_scores FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert failed scores"
ON public.failed_scores FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete failed scores"
ON public.failed_scores FOR DELETE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_failed_scores_org_job 
ON public.failed_scores(org_id, job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_scores_account 
ON public.failed_scores(org_id, account_external_id);

-- Table to track data quality metrics over time
CREATE TABLE IF NOT EXISTS public.data_quality_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_accounts integer NOT NULL,
  accounts_with_industry integer NOT NULL,
  accounts_with_size integer NOT NULL,
  accounts_with_revenue integer NOT NULL,
  accounts_with_geography integer NOT NULL,
  accounts_with_contacts integer NOT NULL,
  overall_completeness numeric(5,2) NOT NULL,
  scored_accounts integer NOT NULL,
  high_fit_accounts integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_quality_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view data quality history in their org"
ON public.data_quality_history FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert data quality metrics"
ON public.data_quality_history FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_data_quality_history_org_time 
ON public.data_quality_history(org_id, created_at DESC);

-- Function to calculate and record data quality snapshot
CREATE OR REPLACE FUNCTION public.record_data_quality_snapshot(org_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts integer;
  v_with_industry integer;
  v_with_size integer;
  v_with_revenue integer;
  v_with_geography integer;
  v_with_contacts integer;
  v_completeness numeric;
  v_scored integer;
  v_high_fit integer;
BEGIN
  -- Validate org_id matches current user
  IF org_id_param != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Get total accounts
  SELECT COUNT(*) INTO v_total_accounts
  FROM public.accounts
  WHERE org_id = org_id_param;

  -- Get accounts with each field
  SELECT 
    COUNT(*) FILTER (WHERE industry_norm IS NOT NULL),
    COUNT(*) FILTER (WHERE employee_count IS NOT NULL),
    COUNT(*) FILTER (WHERE revenue_range IS NOT NULL),
    COUNT(*) FILTER (WHERE country IS NOT NULL)
  INTO v_with_industry, v_with_size, v_with_revenue, v_with_geography
  FROM public.accounts
  WHERE org_id = org_id_param;

  -- Get accounts with contacts
  SELECT COUNT(DISTINCT account_external_id) INTO v_with_contacts
  FROM public.contacts
  WHERE org_id = org_id_param;

  -- Calculate overall completeness
  v_completeness := (
    (v_with_industry::numeric + v_with_size + v_with_revenue + v_with_geography) / 
    NULLIF(v_total_accounts * 4, 0)
  ) * 100;

  -- Get scoring metrics
  SELECT COUNT(*) INTO v_scored
  FROM public.scores
  WHERE org_id = org_id_param;

  SELECT COUNT(*) INTO v_high_fit
  FROM public.scores
  WHERE org_id = org_id_param AND overall >= 70;

  -- Insert snapshot
  INSERT INTO public.data_quality_history (
    org_id,
    total_accounts,
    accounts_with_industry,
    accounts_with_size,
    accounts_with_revenue,
    accounts_with_geography,
    accounts_with_contacts,
    overall_completeness,
    scored_accounts,
    high_fit_accounts
  ) VALUES (
    org_id_param,
    v_total_accounts,
    v_with_industry,
    v_with_size,
    v_with_revenue,
    v_with_geography,
    v_with_contacts,
    v_completeness,
    v_scored,
    v_high_fit
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.record_data_quality_snapshot(uuid) TO authenticated;
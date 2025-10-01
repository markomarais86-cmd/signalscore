-- Create bulk scoring jobs table for tracking chunked processing
CREATE TABLE IF NOT EXISTS public.bulk_scoring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  icp_id uuid REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  
  -- Job metrics
  total_accounts integer NOT NULL DEFAULT 0,
  processed_accounts integer NOT NULL DEFAULT 0,
  successful_scores integer NOT NULL DEFAULT 0,
  failed_scores integer NOT NULL DEFAULT 0,
  
  -- Processing state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  current_chunk integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  chunk_size integer NOT NULL DEFAULT 2000,
  
  -- Timestamps
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  last_processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Error tracking
  error_message text,
  error_details jsonb
);

-- Enable RLS
ALTER TABLE public.bulk_scoring_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view jobs in their org"
  ON public.bulk_scoring_jobs
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can create jobs in their org"
  ON public.bulk_scoring_jobs
  FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update jobs in their org"
  ON public.bulk_scoring_jobs
  FOR UPDATE
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete jobs"
  ON public.bulk_scoring_jobs
  FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create index for efficient job lookups
CREATE INDEX idx_bulk_scoring_jobs_org_status ON public.bulk_scoring_jobs(org_id, status);
CREATE INDEX idx_bulk_scoring_jobs_created_at ON public.bulk_scoring_jobs(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_scoring_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER trigger_update_bulk_scoring_jobs_updated_at
  BEFORE UPDATE ON public.bulk_scoring_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_scoring_jobs_updated_at();
-- Create enrichment_history table for detailed tracking
CREATE TABLE IF NOT EXISTS public.enrichment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  account_external_id TEXT NOT NULL,
  job_id UUID REFERENCES enrichment_jobs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  enrichment_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  fields_enriched TEXT[] DEFAULT '{}',
  data_before JSONB,
  data_after JSONB,
  credits_used INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create provider_health table for monitoring
CREATE TABLE IF NOT EXISTS public.provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  success_rate NUMERIC(5,2),
  avg_response_time_ms INTEGER,
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  error_details JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Create enrichment_field_coverage table
CREATE TABLE IF NOT EXISTS public.enrichment_field_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  total_accounts INTEGER DEFAULT 0,
  enriched_accounts INTEGER DEFAULT 0,
  coverage_percentage NUMERIC(5,2),
  primary_provider TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, field_name)
);

-- Enable RLS
ALTER TABLE public.enrichment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_field_coverage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrichment_history
CREATE POLICY "Users can view enrichment history in their org"
  ON public.enrichment_history FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert enrichment history"
  ON public.enrichment_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete enrichment history"
  ON public.enrichment_history FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS Policies for provider_health
CREATE POLICY "Users can view provider health in their org"
  ON public.provider_health FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can manage provider health"
  ON public.provider_health FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for enrichment_field_coverage
CREATE POLICY "Users can view field coverage in their org"
  ON public.enrichment_field_coverage FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can manage field coverage"
  ON public.enrichment_field_coverage FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_enrichment_history_org_id ON public.enrichment_history(org_id);
CREATE INDEX idx_enrichment_history_account ON public.enrichment_history(account_external_id);
CREATE INDEX idx_enrichment_history_job_id ON public.enrichment_history(job_id);
CREATE INDEX idx_enrichment_history_created_at ON public.enrichment_history(created_at DESC);

CREATE INDEX idx_provider_health_org_id ON public.provider_health(org_id);
CREATE INDEX idx_provider_health_provider ON public.provider_health(provider);

CREATE INDEX idx_field_coverage_org_id ON public.enrichment_field_coverage(org_id);
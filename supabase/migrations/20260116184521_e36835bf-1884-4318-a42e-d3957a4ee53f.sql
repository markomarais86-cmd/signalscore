-- Enrichment Test Data Table (for accuracy benchmarking)
CREATE TABLE IF NOT EXISTS public.enrichment_test_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('lead', 'account')),
  -- Input fields (what we give to enrichment)
  input_name text,
  input_company text,
  input_title text,
  input_email text,
  input_domain text,
  -- Expected outputs (verified correct values)
  expected_phone text,
  expected_mobile text,
  expected_linkedin_url text,
  expected_employee_count integer,
  expected_revenue_range text,
  expected_industry text,
  expected_naics text,
  expected_sic_code text,
  expected_headquarters text,
  expected_founded_year integer,
  -- Metadata
  source text DEFAULT 'manual', -- 'manual', 'linkedin_verified', 'company_website', 'crm_export'
  verified_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enrichment Queue Table (for bulk processing)
CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('lead', 'account', 'discover')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  -- Input
  record_ids uuid[],
  input_data jsonb,
  -- Config
  sources_enabled text[] DEFAULT ARRAY['gemini', 'perplexity'],
  max_cost_per_record numeric(10, 4),
  skip_expensive_sources boolean DEFAULT false,
  -- Progress
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  successful_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  -- Cost tracking
  estimated_cost numeric(10, 4),
  actual_cost numeric(10, 4) DEFAULT 0,
  -- Timing
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_processed_at timestamptz,
  -- Error handling
  error_message text,
  error_details jsonb,
  created_by uuid REFERENCES auth.users(id)
);

-- Enrichment Costs Table (granular cost tracking)
CREATE TABLE IF NOT EXISTS public.enrichment_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  source text NOT NULL, -- 'gemini', 'perplexity', 'apollo', 'pdl', 'firecrawl'
  record_type text NOT NULL CHECK (record_type IN ('lead', 'account')),
  record_id uuid,
  queue_job_id uuid REFERENCES enrichment_queue(id),
  -- Token counts (for AI sources)
  input_tokens integer,
  output_tokens integer,
  -- Credits (for data providers)
  api_credits_used numeric(10, 4),
  -- Costs
  cost_usd numeric(10, 6),
  -- Success tracking
  success boolean DEFAULT true,
  fields_enriched text[],
  error_message text,
  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- Enrichment Accuracy Results Table
CREATE TABLE IF NOT EXISTS public.enrichment_accuracy_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  test_run_id uuid,
  test_data_id uuid REFERENCES enrichment_test_data(id) ON DELETE CASCADE,
  source text NOT NULL,
  -- Results per field
  phone_match boolean,
  mobile_match boolean,
  linkedin_match boolean,
  employee_count_match boolean,
  employee_count_variance numeric,
  revenue_match boolean,
  industry_match boolean,
  naics_match boolean,
  -- Enriched values (for comparison)
  enriched_phone text,
  enriched_employee_count integer,
  enriched_revenue_range text,
  enriched_industry text,
  enriched_naics text,
  -- Timing
  enrichment_duration_ms integer,
  cost_usd numeric(10, 6),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_pending ON enrichment_queue(org_id, status, priority DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_processing ON enrichment_queue(status) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_enrichment_costs_org_date ON enrichment_costs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_costs_source ON enrichment_costs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_test_data_org ON enrichment_test_data(org_id, test_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_accuracy_results_run ON enrichment_accuracy_results(test_run_id);

-- Enable RLS
ALTER TABLE enrichment_test_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_accuracy_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own org enrichment test data" ON enrichment_test_data
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own org enrichment test data" ON enrichment_test_data
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org enrichment test data" ON enrichment_test_data
  FOR UPDATE USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org enrichment test data" ON enrichment_test_data
  FOR DELETE USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own org enrichment queue" ON enrichment_queue
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own org enrichment queue" ON enrichment_queue
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org enrichment queue" ON enrichment_queue
  FOR UPDATE USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own org enrichment costs" ON enrichment_costs
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert enrichment costs" ON enrichment_costs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own org enrichment accuracy results" ON enrichment_accuracy_results
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert enrichment accuracy results" ON enrichment_accuracy_results
  FOR INSERT WITH CHECK (true);

-- Aggregated view for cost reporting
CREATE OR REPLACE VIEW enrichment_cost_summary AS
SELECT 
  org_id,
  date_trunc('day', created_at) as date,
  source,
  record_type,
  COUNT(*) as records_processed,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_record
FROM enrichment_costs
GROUP BY org_id, date_trunc('day', created_at), source, record_type;
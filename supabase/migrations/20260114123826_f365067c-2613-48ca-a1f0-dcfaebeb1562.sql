-- Create batched sync function for accounts (processes in chunks to avoid timeout)
CREATE OR REPLACE FUNCTION sync_firmographics_to_accounts_batch(
  p_org_id UUID, 
  p_batch_size INTEGER DEFAULT 500,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Update accounts with aggregated lead data in batches
  WITH lead_aggregates AS (
    SELECT DISTINCT ON (account_external_id)
      account_external_id,
      revenue_range,
      employee_count,
      industry,
      country,
      city,
      state_province
    FROM "Leads"
    WHERE org_id = p_org_id
      AND account_external_id IS NOT NULL
    ORDER BY account_external_id, updated_at DESC NULLS LAST
  ),
  batch_accounts AS (
    SELECT la.* 
    FROM lead_aggregates la
    INNER JOIN accounts a ON a.external_id = la.account_external_id AND a.org_id = p_org_id
    ORDER BY la.account_external_id
    LIMIT p_batch_size OFFSET p_offset
  ),
  updated AS (
    UPDATE accounts a
    SET 
      revenue_range = COALESCE(a.revenue_range, b.revenue_range),
      employee_count = COALESCE(a.employee_count, b.employee_count),
      industry_raw = COALESCE(a.industry_raw, b.industry),
      country = COALESCE(a.country, b.country),
      city = COALESCE(a.city, b.city),
      state_province = COALESCE(a.state_province, b.state_province),
      updated_at = NOW()
    FROM batch_accounts b
    WHERE a.external_id = b.account_external_id 
      AND a.org_id = p_org_id
      AND (
        (a.revenue_range IS NULL AND b.revenue_range IS NOT NULL) OR
        (a.employee_count IS NULL AND b.employee_count IS NOT NULL) OR
        (a.industry_raw IS NULL AND b.industry IS NOT NULL) OR
        (a.country IS NULL AND b.country IS NOT NULL) OR
        (a.city IS NULL AND b.city IS NOT NULL) OR
        (a.state_province IS NULL AND b.state_province IS NOT NULL)
      )
    RETURNING a.external_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Check if more records remain
  SELECT COUNT(*) INTO v_total_remaining 
  FROM (
    SELECT DISTINCT account_external_id 
    FROM "Leads" 
    WHERE org_id = p_org_id AND account_external_id IS NOT NULL
    OFFSET p_offset + p_batch_size
  ) remaining;

  RETURN jsonb_build_object(
    'updated', v_updated_count,
    'offset', p_offset,
    'batch_size', p_batch_size,
    'has_more', v_total_remaining > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create batched sync function for leads (processes in chunks to avoid timeout)
CREATE OR REPLACE FUNCTION sync_firmographics_to_leads_batch(
  p_org_id UUID, 
  p_batch_size INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Update leads with account data in batches
  WITH batch_leads AS (
    SELECT l.id as lead_id, a.revenue_range, a.employee_count, a.industry_raw, 
           a.country, a.city, a.state_province
    FROM "Leads" l
    INNER JOIN accounts a ON a.external_id = l.account_external_id AND a.org_id = p_org_id
    WHERE l.org_id = p_org_id
      AND l.account_external_id IS NOT NULL
    ORDER BY l.id
    LIMIT p_batch_size OFFSET p_offset
  ),
  updated AS (
    UPDATE "Leads" l
    SET 
      revenue_range = COALESCE(l.revenue_range, b.revenue_range),
      employee_count = COALESCE(l.employee_count, b.employee_count),
      industry = COALESCE(l.industry, b.industry_raw),
      country = COALESCE(l.country, b.country),
      city = COALESCE(l.city, b.city),
      state_province = COALESCE(l.state_province, b.state_province),
      updated_at = NOW()
    FROM batch_leads b
    WHERE l.id = b.lead_id
      AND (
        (l.revenue_range IS NULL AND b.revenue_range IS NOT NULL) OR
        (l.employee_count IS NULL AND b.employee_count IS NOT NULL) OR
        (l.industry IS NULL AND b.industry_raw IS NOT NULL) OR
        (l.country IS NULL AND b.country IS NOT NULL) OR
        (l.city IS NULL AND b.city IS NOT NULL) OR
        (l.state_province IS NULL AND b.state_province IS NOT NULL)
      )
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Check if more records remain
  SELECT COUNT(*) INTO v_total_remaining 
  FROM (
    SELECT l.id 
    FROM "Leads" l
    WHERE l.org_id = p_org_id AND l.account_external_id IS NOT NULL
    OFFSET p_offset + p_batch_size
  ) remaining;

  RETURN jsonb_build_object(
    'updated', v_updated_count,
    'offset', p_offset,
    'batch_size', p_batch_size,
    'has_more', v_total_remaining > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sync jobs table to track progress
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  direction TEXT,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  updated_records INTEGER DEFAULT 0,
  current_offset INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org's sync jobs"
  ON sync_jobs FOR SELECT
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert sync jobs for their org"
  ON sync_jobs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org's sync jobs"
  ON sync_jobs FOR UPDATE
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org_status ON sync_jobs(org_id, status);
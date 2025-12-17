-- Add heartbeat tracking columns to enrichment_jobs
ALTER TABLE enrichment_jobs 
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS heartbeat_interval_ms INTEGER DEFAULT 30000,
ADD COLUMN IF NOT EXISTS recovery_count INTEGER DEFAULT 0;

-- Create index for detecting stale jobs
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_heartbeat 
ON enrichment_jobs(status, last_heartbeat) 
WHERE status IN ('processing', 'paused');

-- Create job_recovery_log table for audit trail
CREATE TABLE IF NOT EXISTS job_recovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  recovery_type TEXT NOT NULL, -- 'auto_resume', 'manual_resume', 'stuck_cleanup', 'timeout_pause'
  previous_status TEXT,
  new_status TEXT,
  rows_recovered INTEGER DEFAULT 0,
  reason TEXT,
  recovered_at TIMESTAMPTZ DEFAULT now(),
  recovered_by UUID -- null for auto-recovery
);

-- Enable RLS on job_recovery_log
ALTER TABLE job_recovery_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_recovery_log
CREATE POLICY "Users can view their org's recovery logs" ON job_recovery_log
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert recovery logs" ON job_recovery_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete recovery logs" ON job_recovery_log
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create index for job recovery queries
CREATE INDEX IF NOT EXISTS idx_job_recovery_log_job_id ON job_recovery_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_recovery_log_org_id ON job_recovery_log(org_id);
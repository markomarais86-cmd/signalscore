-- Add week-over-week tracking columns to data_quality_history
ALTER TABLE data_quality_history
ADD COLUMN IF NOT EXISTS high_fit_accounts_delta integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS medium_fit_accounts_delta integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_fit_accounts_delta integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tam_accounts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sam_accounts integer DEFAULT 0;

-- Create weekly analytics snapshots table
CREATE TABLE IF NOT EXISTS weekly_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  total_accounts integer NOT NULL DEFAULT 0,
  high_fit_accounts integer NOT NULL DEFAULT 0,
  medium_fit_accounts integer NOT NULL DEFAULT 0,
  low_fit_accounts integer NOT NULL DEFAULT 0,
  high_fit_percentage numeric DEFAULT 0,
  medium_fit_percentage numeric DEFAULT 0,
  low_fit_percentage numeric DEFAULT 0,
  data_completeness numeric DEFAULT 0,
  tam_accounts integer DEFAULT 0,
  sam_accounts integer DEFAULT 0,
  som_accounts integer DEFAULT 0,
  top_countries jsonb DEFAULT '[]'::jsonb,
  geography_distribution jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE weekly_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view snapshots in their org"
  ON weekly_analytics_snapshots
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert snapshots"
  ON weekly_analytics_snapshots
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update snapshots"
  ON weekly_analytics_snapshots
  FOR UPDATE
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_org_date 
  ON weekly_analytics_snapshots(org_id, snapshot_date DESC);
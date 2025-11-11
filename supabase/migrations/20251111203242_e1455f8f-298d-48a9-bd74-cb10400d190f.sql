-- Add columns to campaign_snapshots for tracking export destination and status
ALTER TABLE public.campaign_snapshots
ADD COLUMN IF NOT EXISTS sync_destination TEXT CHECK (sync_destination IN ('csv', 'salesforce', 'hubspot', 'apollo')),
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS source_filter TEXT DEFAULT 'all' CHECK (source_filter IN ('all', 'crm', 'database'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_org_date 
ON public.campaign_snapshots(org_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_sync_status
ON public.campaign_snapshots(org_id, sync_status);

COMMENT ON COLUMN public.campaign_snapshots.sync_destination IS 'Where the campaign was exported: csv, salesforce, hubspot, or apollo';
COMMENT ON COLUMN public.campaign_snapshots.sync_status IS 'Status of the sync operation';
COMMENT ON COLUMN public.campaign_snapshots.source_filter IS 'Which data sources were included: all, crm, or database';
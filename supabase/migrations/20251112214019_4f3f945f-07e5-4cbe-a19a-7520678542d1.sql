-- Add exported_emails column to campaign_snapshots for deduplication
ALTER TABLE campaign_snapshots 
ADD COLUMN IF NOT EXISTS exported_emails jsonb DEFAULT '[]'::jsonb;

-- Create index for faster deduplication queries
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_exported_emails 
ON campaign_snapshots USING gin(exported_emails);

-- Add comment explaining the column
COMMENT ON COLUMN campaign_snapshots.exported_emails IS 'Array of email addresses exported in this campaign for deduplication purposes';
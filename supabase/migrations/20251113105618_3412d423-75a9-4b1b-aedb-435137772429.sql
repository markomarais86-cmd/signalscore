-- Add index for faster score lookups by external_id (without last_scored_at since it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_scores_external_id_org 
ON scores(account_external_id, org_id);

-- Add metadata column to integration_configs for caching settings
ALTER TABLE integration_configs 
ADD COLUMN IF NOT EXISTS cache_settings jsonb DEFAULT '{
  "enabled": true,
  "ttl_minutes": 5
}'::jsonb;
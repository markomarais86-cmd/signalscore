-- Add timeout tracking to ai_provider_health
ALTER TABLE ai_provider_health 
ADD COLUMN IF NOT EXISTS timeout_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS requests_24h integer DEFAULT 0;

-- Add index for faster usage lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_provider_created 
ON ai_usage_tracking(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_org_created 
ON ai_usage_tracking(org_id, created_at DESC);
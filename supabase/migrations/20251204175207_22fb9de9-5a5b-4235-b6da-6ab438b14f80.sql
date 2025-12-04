-- Clear stuck enrichment jobs
UPDATE enrichment_jobs 
SET status = 'failed', 
    completed_at = now(),
    error_message = 'Cleared by system - stuck job'
WHERE status IN ('processing', 'pending') 
AND (started_at < now() - interval '2 hours' OR started_at IS NULL);

-- Enable AI agents feature flag for all organizations
INSERT INTO feature_flags (org_id, feature_key, enabled)
SELECT DISTINCT org_id, 'ai_agents', true 
FROM user_profiles 
WHERE org_id IS NOT NULL
ON CONFLICT (org_id, feature_key) DO UPDATE SET enabled = true;
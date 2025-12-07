-- Disable Phase 3 feature flags (pipeline_efficiency and capital_efficiency)
UPDATE feature_flags 
SET enabled = false, updated_at = NOW() 
WHERE feature_key IN ('pipeline_efficiency', 'capital_efficiency');
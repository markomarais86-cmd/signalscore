
-- Fix 1: Move all users to Launchpulse (the parent/consulting org)
UPDATE user_profiles 
SET org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f' 
WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';

-- Fix 2: Move ICPs back to Launchpulse
UPDATE icp_profiles 
SET org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f' 
WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';

-- Fix 3: Clear stale child cache so it recomputes
DELETE FROM child_dashboard_metrics_cache 
WHERE org_id IN ('726a0dc0-99c7-43c2-b20f-b849f2760c3f', 'cd592f73-3e0e-478d-905b-47fe7c5fb634');

-- Refresh parent matviews
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache;
REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache;

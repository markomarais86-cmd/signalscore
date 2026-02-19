
-- Invalidate child dashboard cache so it recomputes on next load
DELETE FROM child_dashboard_metrics_cache 
WHERE org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634';

-- Also invalidate for the parent org
DELETE FROM child_dashboard_metrics_cache 
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';

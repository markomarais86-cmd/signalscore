
-- Refresh stale materialized views for accurate dashboard data
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_cache;
REFRESH MATERIALIZED VIEW CONCURRENTLY leads_metrics_cache;

-- Invalidate child dashboard cache to force recomputation
DELETE FROM child_dashboard_metrics_cache 
WHERE org_id IN ('cd592f73-3e0e-478d-905b-47fe7c5fb634', '726a0dc0-99c7-43c2-b20f-b849f2760c3f');

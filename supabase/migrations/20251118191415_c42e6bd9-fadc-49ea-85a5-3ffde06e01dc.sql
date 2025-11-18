-- Drop old JSONB-returning version of get_dashboard_metrics_fast with 3 arguments
DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, uuid, text);
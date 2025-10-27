-- Fix geography materialized view index and refresh views

-- Add unique index to geography view (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_geography_unique 
  ON public.mv_geography_by_org(org_id, country);

-- Now refresh both views (non-concurrently for initial population)
REFRESH MATERIALIZED VIEW public.mv_dashboard_metrics_by_org;
REFRESH MATERIALIZED VIEW public.mv_geography_by_org;
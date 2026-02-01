-- Helper function to check if a materialized view exists
CREATE OR REPLACE FUNCTION check_materialized_view_exists(view_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = view_name 
    AND schemaname = 'public'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to refresh materialized view concurrently (if it has a unique index)
CREATE OR REPLACE FUNCTION refresh_materialized_view_concurrently(view_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- First check if the view exists
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = view_name AND schemaname = 'public') THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  -- Try concurrent refresh first (requires unique index), fall back to regular refresh
  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', view_name);
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to non-concurrent refresh
    EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', view_name);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create system_health_checks table if it doesn't exist (for tracking cache refresh timing)
CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_system_health_checks_type_time 
ON system_health_checks(check_type, checked_at DESC);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to health checks"
ON system_health_checks
FOR ALL
USING (true)
WITH CHECK (true);

-- Auto-cleanup old health check records (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM system_health_checks 
  WHERE checked_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to cleanup on new inserts (runs periodically)
DROP TRIGGER IF EXISTS trigger_cleanup_health_checks ON system_health_checks;
CREATE TRIGGER trigger_cleanup_health_checks
AFTER INSERT ON system_health_checks
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_old_health_checks();

-- Helper function to refresh dashboard metrics for a specific org
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  -- This is a placeholder that can be extended to refresh org-specific caches
  -- Currently materialized views are org-agnostic, but this prepares for future org-specific caching
  RAISE NOTICE 'Dashboard metrics refresh requested for org %', p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Phase 2: Performance Optimization - Add Database Indexes

-- Index for faster account lookups by org_id and external_id
CREATE INDEX IF NOT EXISTS idx_accounts_org_external 
ON public.accounts(org_id, external_id);

-- Index for faster account lookups by org_id only
CREATE INDEX IF NOT EXISTS idx_accounts_org_id 
ON public.accounts(org_id);

-- Index for faster contact lookups by org_id and account_external_id (for joins)
CREATE INDEX IF NOT EXISTS idx_contacts_org_account 
ON public.contacts(org_id, account_external_id);

-- Index for faster score lookups by org_id and account_external_id
CREATE INDEX IF NOT EXISTS idx_scores_org_account 
ON public.scores(org_id, account_external_id);

-- Index for faster ICP profile lookups
CREATE INDEX IF NOT EXISTS idx_icp_profiles_org_status 
ON public.icp_profiles(org_id, status);

-- Index for faster bulk scoring job lookups
CREATE INDEX IF NOT EXISTS idx_bulk_scoring_jobs_org_status 
ON public.bulk_scoring_jobs(org_id, status, created_at DESC);

-- Function to auto-refresh materialized views when scores change
CREATE OR REPLACE FUNCTION public.refresh_views_on_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh materialized views asynchronously in a background job
  -- This prevents blocking the main transaction
  PERFORM pg_notify('refresh_views', 'score_updated');
  RETURN NEW;
END;
$$;

-- Trigger to refresh views when scores are inserted/updated
DROP TRIGGER IF EXISTS trigger_refresh_views_on_score ON public.scores;
CREATE TRIGGER trigger_refresh_views_on_score
AFTER INSERT OR UPDATE ON public.scores
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_views_on_score_change();

-- Function to manually refresh all materialized views (can be called periodically)
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_score_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_by_week;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.refresh_all_materialized_views() TO authenticated;
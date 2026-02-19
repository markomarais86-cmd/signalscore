
-- Remove 6 redundant indexes from scores table to reduce index bloat
-- Current: 13 indexes (74MB) for 32MB table (62k rows)
-- After: 7 indexes, ~35MB savings

-- idx_scores_lookup covered by idx_scores_account_overall
DROP INDEX IF EXISTS idx_scores_lookup;

-- idx_scores_org_fit covered by idx_scores_org_overall_desc
DROP INDEX IF EXISTS idx_scores_org_fit;

-- idx_scores_org_fit_ranges covered by idx_scores_org_overall_desc
DROP INDEX IF EXISTS idx_scores_org_fit_ranges;

-- idx_scores_fit_band narrow partial, barely used
DROP INDEX IF EXISTS idx_scores_fit_band;

-- idx_scores_fit narrow partial, covered by idx_scores_org_overall_desc
DROP INDEX IF EXISTS idx_scores_fit;

-- idx_scores_org_icp covered by idx_scores_icp_fit
DROP INDEX IF EXISTS idx_scores_org_icp;

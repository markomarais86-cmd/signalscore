
-- Step 1: Drop 9 redundant indexes on scores table
DROP INDEX IF EXISTS idx_scores_account;
DROP INDEX IF EXISTS idx_scores_account_lookup;
DROP INDEX IF EXISTS idx_scores_org_account;
DROP INDEX IF EXISTS idx_scores_account_external_id;
DROP INDEX IF EXISTS idx_scores_external_id_org;
DROP INDEX IF EXISTS idx_scores_org_overall;
DROP INDEX IF EXISTS idx_scores_org_account_overall;
DROP INDEX IF EXISTS idx_scores_overall;
DROP INDEX IF EXISTS idx_scores_org_id;

-- Step 2: Reset stuck scoring jobs
UPDATE bulk_scoring_jobs
SET status = 'failed',
    error_message = 'Reset: index bloat caused statement timeouts',
    updated_at = now()
WHERE status = 'processing'
  AND id IN ('d6c92111-f819-48d7-92dd-db8c83b17a9e', 'b2e398e6-7b27-456d-a4e3-8a65f16276a1');

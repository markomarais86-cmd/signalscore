
-- Drop redundant unique constraints, keeping only unique_score_per_account
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_org_id_account_external_id_scoring_version_key;
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_org_account_unique;

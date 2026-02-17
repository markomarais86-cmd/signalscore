-- Drop the composite FK that prevents child orgs from scoring parent org accounts
-- Child orgs need their own scores referencing shared accounts from the parent org
ALTER TABLE public.scores DROP CONSTRAINT fk_scores_account;
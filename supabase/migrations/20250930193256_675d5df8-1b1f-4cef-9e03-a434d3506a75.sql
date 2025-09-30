-- First, add unique constraint on accounts (org_id, external_id)
-- This ensures each account has a unique external_id within an organization
ALTER TABLE public.accounts
ADD CONSTRAINT accounts_org_external_id_unique 
UNIQUE (org_id, external_id);

-- Now add the foreign key relationship between scores and accounts
-- Using composite key (org_id, account_external_id) -> (org_id, external_id)
ALTER TABLE public.scores
ADD CONSTRAINT fk_scores_account
FOREIGN KEY (org_id, account_external_id) 
REFERENCES public.accounts(org_id, external_id)
ON DELETE CASCADE;
-- Add unique constraints for ON CONFLICT statements

-- Add unique constraint for accounts table on org_id and external_id
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_org_external_unique UNIQUE (org_id, external_id);

-- Add unique constraint for contacts table on org_id and external_id
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_org_external_unique UNIQUE (org_id, external_id);

-- Add unique constraint for scores table on org_id and account_external_id
ALTER TABLE public.scores 
ADD CONSTRAINT scores_org_account_unique UNIQUE (org_id, account_external_id);

-- Add unique constraint for Leads table on org_id and external_id  
ALTER TABLE public."Leads" 
ADD CONSTRAINT leads_org_external_unique UNIQUE (org_id, external_id);
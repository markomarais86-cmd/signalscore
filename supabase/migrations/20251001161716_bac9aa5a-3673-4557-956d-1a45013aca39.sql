-- Drop existing check constraints on data_source columns
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_data_source_check;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_data_source_check;

-- Recreate check constraints with 'closed_won' included
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_data_source_check 
CHECK (data_source IN ('crm', 'database', 'both', 'closed_won'));

ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_data_source_check 
CHECK (data_source IN ('crm', 'database', 'both', 'closed_won'));
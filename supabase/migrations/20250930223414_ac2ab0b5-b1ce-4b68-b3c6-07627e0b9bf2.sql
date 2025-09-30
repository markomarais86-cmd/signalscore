-- Add missing contact fields to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS mobile text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS state_province text;

-- Add missing contact fields to contacts table  
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS mobile text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS state_province text;

-- Enhance Leads table structure with more fields
ALTER TABLE public."Leads"
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS mobile text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS revenue_range text,
ADD COLUMN IF NOT EXISTS employee_count integer,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS state_province text,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS account_external_id text,
ADD COLUMN IF NOT EXISTS contact_external_id text;

-- Add index for better lookup performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON public."Leads"(email);
CREATE INDEX IF NOT EXISTS idx_leads_company ON public."Leads"(company);
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON public.accounts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON public.contacts(mobile);
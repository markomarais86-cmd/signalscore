-- Drop the partial unique index that can't be used with ON CONFLICT
DROP INDEX IF EXISTS leads_org_email_unique;

-- Create a proper unique constraint that handles NULL emails properly
-- Use COALESCE to provide a unique value for NULL emails based on their ID
CREATE UNIQUE INDEX leads_org_email_unique_v2 
ON public."Leads" (org_id, COALESCE(email, 'NULL_EMAIL_' || id::text));

-- Also add a simpler index for fast email lookups (non-unique)
CREATE INDEX IF NOT EXISTS idx_leads_org_email_lookup 
ON public."Leads" (org_id, email) WHERE email IS NOT NULL;
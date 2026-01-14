-- Add indexes to speed up bidirectional sync queries
-- Index on Leads for account_external_id lookups
CREATE INDEX IF NOT EXISTS idx_leads_account_external_id_org_id 
ON "Leads" (org_id, account_external_id) 
WHERE account_external_id IS NOT NULL;

-- Index on Leads for updated_at ordering
CREATE INDEX IF NOT EXISTS idx_leads_org_updated_at 
ON "Leads" (org_id, updated_at DESC NULLS LAST);

-- Index on accounts for external_id lookups
CREATE INDEX IF NOT EXISTS idx_accounts_external_id_org_id 
ON accounts (org_id, external_id);
-- Add performance indexes for infinite scroll cursor-based pagination

-- Accounts table indexes (uses updated_at for cursor)
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at 
ON accounts(org_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_industry 
ON accounts(org_id, industry_norm) 
WHERE industry_norm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_source 
ON accounts(org_id, data_source);

CREATE INDEX IF NOT EXISTS idx_accounts_country 
ON accounts(org_id, country) 
WHERE country IS NOT NULL;

-- Leads table indexes (uses created_at for cursor - no updated_at column)
CREATE INDEX IF NOT EXISTS idx_leads_created_at 
ON "Leads"(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_status 
ON "Leads"(org_id, status);

CREATE INDEX IF NOT EXISTS idx_leads_persona 
ON "Leads"(org_id, persona) 
WHERE persona IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_account_link 
ON "Leads"(org_id, account_external_id) 
WHERE account_external_id IS NOT NULL;

-- Scores table indexes for joins and filtering
CREATE INDEX IF NOT EXISTS idx_scores_account_overall 
ON scores(org_id, account_external_id, overall DESC);

CREATE INDEX IF NOT EXISTS idx_scores_fit 
ON scores(org_id, fit DESC) 
WHERE fit >= 70;

-- Contacts table for count aggregation
CREATE INDEX IF NOT EXISTS idx_contacts_account 
ON contacts(org_id, account_external_id);

-- Composite index for common account queries with score filtering
CREATE INDEX IF NOT EXISTS idx_accounts_domain_org 
ON accounts(org_id, domain) 
WHERE domain IS NOT NULL;

COMMENT ON INDEX idx_accounts_updated_at IS 'Optimizes cursor-based pagination on accounts';
COMMENT ON INDEX idx_leads_created_at IS 'Optimizes cursor-based pagination on leads';
COMMENT ON INDEX idx_scores_account_overall IS 'Optimizes score joins and high-fit filtering';
COMMENT ON INDEX idx_contacts_account IS 'Optimizes contact count aggregation per account';
-- Phase 1 Quick Win: Composite Indexes for 1M+ Account Scale
-- These indexes optimize the most frequent query patterns

-- Enable pg_trgm extension for domain fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Accounts: org + data_source filter (used in dashboard metrics)
CREATE INDEX IF NOT EXISTS idx_accounts_org_data_source 
  ON accounts(org_id, data_source) 
  INCLUDE (external_id, name);

-- 2. Accounts: org + firmographic filters (used in ICP matching & segmentation)
CREATE INDEX IF NOT EXISTS idx_accounts_org_industry_country 
  ON accounts(org_id, industry_norm, country) 
  WHERE industry_norm IS NOT NULL;

-- 3. Accounts: org + size filter
CREATE INDEX IF NOT EXISTS idx_accounts_org_size 
  ON accounts(org_id, employee_count) 
  WHERE employee_count IS NOT NULL;

-- 4. Scores: org + overall score DESC (used in high-fit account queries)
CREATE INDEX IF NOT EXISTS idx_scores_org_overall_desc 
  ON scores(org_id, overall DESC) 
  INCLUDE (account_external_id, fit);

-- 5. Scores: org + fit ranges (used in dashboard distribution)
CREATE INDEX IF NOT EXISTS idx_scores_org_fit_ranges 
  ON scores(org_id, fit) 
  WHERE fit >= 40;

-- 6. Leads: org + account matching with email filter
CREATE INDEX IF NOT EXISTS idx_leads_org_account_email 
  ON "Leads"(org_id, account_external_id) 
  WHERE email IS NOT NULL;

-- 7. Leads: org + persona filter (used in campaign ready queries)
CREATE INDEX IF NOT EXISTS idx_leads_org_persona 
  ON "Leads"(org_id, persona) 
  WHERE persona IS NOT NULL AND persona != 'Unknown';

-- 8. Contacts: org + account matching
CREATE INDEX IF NOT EXISTS idx_contacts_org_account 
  ON contacts(org_id, account_external_id) 
  INCLUDE (email, persona);

-- 9. Accounts: domain fuzzy search (used in duplicate detection & lead matching)
CREATE INDEX IF NOT EXISTS idx_accounts_domain_trgm 
  ON accounts USING gin(domain gin_trgm_ops);

-- 10. Scores: account lookup optimization
CREATE INDEX IF NOT EXISTS idx_scores_account_org 
  ON scores(account_external_id, org_id) 
  INCLUDE (overall, fit, intent, reachability);

-- Analyze tables to update statistics after index creation
ANALYZE accounts;
ANALYZE scores;
ANALYZE "Leads";
ANALYZE contacts;
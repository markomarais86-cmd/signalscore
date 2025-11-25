-- ============================================================================
-- ENTERPRISE SCALABILITY PART 1: Core Tables and Indexes
-- ============================================================================

-- 1. Domain Alias Mapping Table (no RLS for now)
CREATE TABLE IF NOT EXISTS domain_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias_domain TEXT NOT NULL,
  canonical_domain TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, alias_domain)
);

CREATE INDEX idx_domain_aliases_org_canonical ON domain_aliases(org_id, canonical_domain);
CREATE INDEX idx_domain_aliases_lookup ON domain_aliases(org_id, alias_domain);

-- 2. Processing Locks Table
CREATE TABLE IF NOT EXISTS processing_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_name TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT,
  UNIQUE(org_id, process_name)
);

CREATE INDEX idx_processing_locks_org_process ON processing_locks(org_id, process_name);

-- 3. Performance Indexes for High-Volume Queries
-- Accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_org_domain ON accounts(org_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_org_data_source ON accounts(org_id, data_source);

-- Leads table
CREATE INDEX IF NOT EXISTS idx_leads_org_account ON "Leads"(org_id, account_external_id) WHERE account_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_unlinked ON "Leads"(org_id) WHERE account_external_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_company_trgm ON "Leads" USING gin(company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email ON "Leads"(org_id, email) WHERE email IS NOT NULL;

-- Scores table
CREATE INDEX IF NOT EXISTS idx_scores_org_overall ON scores(org_id, overall DESC);
CREATE INDEX IF NOT EXISTS idx_scores_fit_band ON scores(org_id) WHERE overall >= 70;

COMMENT ON TABLE domain_aliases IS 'Maps alias domains to canonical domains for multi-brand companies';
COMMENT ON TABLE processing_locks IS 'Prevents concurrent processing jobs from conflicting';
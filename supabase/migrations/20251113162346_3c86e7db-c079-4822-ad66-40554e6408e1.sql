-- Add indexes to optimize filtered account queries

-- Index on accounts.industry_norm for industry filtering
CREATE INDEX IF NOT EXISTS idx_accounts_industry_norm ON accounts(industry_norm) WHERE industry_norm IS NOT NULL;

-- Index on accounts.country for country filtering
CREATE INDEX IF NOT EXISTS idx_accounts_country ON accounts(country) WHERE country IS NOT NULL;

-- Index on scores.overall for fit score filtering
CREATE INDEX IF NOT EXISTS idx_scores_overall ON scores(overall) WHERE overall IS NOT NULL;

-- Composite index on accounts for efficient filtering with org_id
CREATE INDEX IF NOT EXISTS idx_accounts_org_filtering ON accounts(org_id, updated_at DESC, industry_norm, country, data_source);

-- Composite index on scores for efficient joins and filtering
CREATE INDEX IF NOT EXISTS idx_scores_org_account_overall ON scores(org_id, account_external_id, overall);
-- Performance indexes for large table queries
-- These will significantly speed up dashboard metrics and filtering

-- Index for lead counting with ICP filter (used by get_dashboard_metrics)
CREATE INDEX IF NOT EXISTS idx_leads_org_icp 
ON "Leads" (org_id, icp_qualified) 
WHERE icp_qualified IS NOT NULL;

-- Index for lead scoring performance
CREATE INDEX IF NOT EXISTS idx_leads_scoring 
ON "Leads" (org_id, account_external_id, icp_qualified);

-- Index for account filtering performance  
CREATE INDEX IF NOT EXISTS idx_accounts_filter
ON accounts (org_id, data_source, industry_norm, country);

-- Index for score lookup performance
CREATE INDEX IF NOT EXISTS idx_scores_lookup
ON scores (org_id, account_external_id, computed_at DESC);
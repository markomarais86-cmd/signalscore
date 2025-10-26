-- Phase 1: Add composite indexes for scale performance
-- These indexes optimize heavy dashboard queries for millions of records

-- Index for accounts filtered by org_id and data_source
-- Speeds up: CRM vs Database filtering, data source breakdowns
CREATE INDEX IF NOT EXISTS idx_accounts_org_data_source 
ON public.accounts(org_id, data_source) 
WHERE data_source IS NOT NULL;

-- Index for scores filtered by org_id and overall/fit score
-- Speeds up: High-fit account queries, score distribution analysis
CREATE INDEX IF NOT EXISTS idx_scores_org_fit 
ON public.scores(org_id, overall, fit) 
WHERE overall IS NOT NULL;

-- Composite index for account enrichment queries
-- Speeds up: Data completeness calculations, enrichment candidate identification
CREATE INDEX IF NOT EXISTS idx_accounts_enrichment 
ON public.accounts(org_id, industry_norm, employee_count, revenue_range, country)
WHERE org_id IS NOT NULL;

-- Index for leads with account linkage
-- Speeds up: Lead-to-account matching, campaign readiness queries
CREATE INDEX IF NOT EXISTS idx_leads_account_link 
ON public."Leads"(org_id, account_external_id) 
WHERE account_external_id IS NOT NULL;

-- Index for leads with persona filtering
-- Speeds up: Persona-based lead queries, persona distribution analysis
CREATE INDEX IF NOT EXISTS idx_leads_persona 
ON public."Leads"(org_id, persona) 
WHERE persona IS NOT NULL;
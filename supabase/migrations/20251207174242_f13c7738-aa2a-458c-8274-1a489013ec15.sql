-- 1. Clean up stuck enrichment jobs
UPDATE public.enrichment_jobs 
SET status = 'failed', 
    completed_at = NOW(),
    error_message = 'Cancelled during deployment cleanup - job was stuck'
WHERE status IN ('pending', 'processing') 
  AND created_at < NOW() - INTERVAL '1 hour';

-- 2. Add performance indexes for production workloads
CREATE INDEX IF NOT EXISTS idx_accounts_org_domain ON public.accounts(org_id, domain);
CREATE INDEX IF NOT EXISTS idx_accounts_org_industry ON public.accounts(org_id, industry_norm);
CREATE INDEX IF NOT EXISTS idx_accounts_org_country ON public.accounts(org_id, country);
CREATE INDEX IF NOT EXISTS idx_accounts_org_score_lookup ON public.accounts(org_id, external_id);

CREATE INDEX IF NOT EXISTS idx_leads_org_account ON public."Leads"(org_id, account_external_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_email ON public."Leads"(org_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_org_persona ON public."Leads"(org_id, persona);

CREATE INDEX IF NOT EXISTS idx_scores_org_overall ON public.scores(org_id, overall DESC);
CREATE INDEX IF NOT EXISTS idx_scores_org_fit ON public.scores(org_id, fit DESC);
CREATE INDEX IF NOT EXISTS idx_scores_account_lookup ON public.scores(org_id, account_external_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_org_status ON public.enrichment_jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_org_account ON public.enrichment_history(org_id, account_external_id);

-- 3. Refresh materialized views for dashboard performance
REFRESH MATERIALIZED VIEW public.mv_score_distribution;
REFRESH MATERIALIZED VIEW public.mv_leads_by_week;
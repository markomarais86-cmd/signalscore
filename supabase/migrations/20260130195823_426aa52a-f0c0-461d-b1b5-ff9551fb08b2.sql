-- Phase 4A: Performance Improvements - Database Indexes and Caching Table

-- ============================================================
-- 1. Create Enrichment Cache Table (if not exists from partial run)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrichment_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL CHECK (cache_type IN ('domain', 'email', 'company')),
    enriched_data JSONB NOT NULL DEFAULT '{}',
    sources TEXT[] DEFAULT '{}',
    confidence NUMERIC(3,2) DEFAULT 0,
    total_cost NUMERIC(10,6) DEFAULT 0,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT enrichment_cache_key_unique UNIQUE (cache_key, cache_type)
);

-- Indexes for cache
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_lookup ON enrichment_cache(cache_key, cache_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_expiry ON enrichment_cache(expires_at);

-- Enable RLS
ALTER TABLE public.enrichment_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists, then create
DROP POLICY IF EXISTS "Service role can manage cache" ON public.enrichment_cache;
CREATE POLICY "Service role can manage cache"
    ON public.enrichment_cache FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Add Composite Indexes for Dashboard Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_accounts_org_enriched 
    ON accounts(org_id, enriched_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_accounts_org_icp_qualified 
    ON accounts(org_id, icp_qualified);

CREATE INDEX IF NOT EXISTS idx_accounts_org_propensity 
    ON accounts(org_id, propensity_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_accounts_domain_lookup 
    ON accounts(org_id, domain);

-- Fixed: Leads uses 'status' not 'lead_status'
CREATE INDEX IF NOT EXISTS idx_leads_org_status 
    ON "Leads"(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_enriched 
    ON "Leads"(org_id, enriched_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_leads_email_lookup 
    ON "Leads"(org_id, email);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_org_status 
    ON enrichment_jobs(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_active 
    ON enrichment_jobs(org_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_provider_health_recent 
    ON ai_provider_health(provider, checked_at DESC);

-- ============================================================
-- 3. Cache Helper Functions
-- ============================================================
CREATE OR REPLACE FUNCTION get_enrichment_cache(
    p_cache_key TEXT,
    p_cache_type TEXT
) RETURNS TABLE(
    enriched_data JSONB,
    sources TEXT[],
    confidence NUMERIC,
    hit BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE enrichment_cache
    SET hit_count = hit_count + 1, last_accessed_at = now()
    WHERE cache_key = p_cache_key AND cache_type = p_cache_type AND expires_at > now();
    
    RETURN QUERY
    SELECT ec.enriched_data, ec.sources, ec.confidence, true AS hit
    FROM enrichment_cache ec
    WHERE ec.cache_key = p_cache_key AND ec.cache_type = p_cache_type AND ec.expires_at > now();
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::JSONB, NULL::TEXT[], NULL::NUMERIC, false;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_enrichment_cache(
    p_cache_key TEXT,
    p_cache_type TEXT,
    p_enriched_data JSONB,
    p_sources TEXT[],
    p_confidence NUMERIC,
    p_total_cost NUMERIC DEFAULT 0,
    p_ttl_days INTEGER DEFAULT 30
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO enrichment_cache (cache_key, cache_type, enriched_data, sources, confidence, total_cost, expires_at)
    VALUES (p_cache_key, p_cache_type, p_enriched_data, p_sources, p_confidence, p_total_cost, now() + (p_ttl_days || ' days')::interval)
    ON CONFLICT (cache_key, cache_type) 
    DO UPDATE SET enriched_data = EXCLUDED.enriched_data, sources = EXCLUDED.sources, 
                  confidence = EXCLUDED.confidence, total_cost = EXCLUDED.total_cost,
                  expires_at = now() + (p_ttl_days || ' days')::interval
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM enrichment_cache WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
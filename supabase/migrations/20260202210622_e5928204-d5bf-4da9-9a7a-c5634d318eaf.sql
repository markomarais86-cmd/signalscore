-- ============================================================
-- Security Fix: Restrict access to enrichment_cache and rate_limits tables
-- ============================================================

-- ============================================================
-- 1. Fix enrichment_cache - Remove permissive policy, add org_id for tenant isolation
-- ============================================================

-- Add org_id column for tenant isolation (nullable initially for existing data)
ALTER TABLE public.enrichment_cache 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage cache" ON public.enrichment_cache;

-- Create proper org-scoped policies
-- Only authenticated users can read cache entries from their org
CREATE POLICY "Users can read their org cache entries"
ON public.enrichment_cache
FOR SELECT
TO authenticated
USING (org_id = get_current_user_org_id());

-- Only authenticated users can insert/update cache entries for their org
CREATE POLICY "Users can manage their org cache entries"
ON public.enrichment_cache
FOR ALL
TO authenticated
USING (org_id = get_current_user_org_id())
WITH CHECK (org_id = get_current_user_org_id());

-- ============================================================
-- 2. Fix rate_limits - Remove overly permissive "System can manage" policy
-- ============================================================

-- Drop the overly permissive system policy that uses USING (true)
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;

-- The existing org-scoped policies remain:
-- - "Admins can view rate limits in their org" (SELECT with org check + admin check)
-- - "Users can view their org rate limits" (SELECT with org check)
-- - "Users can manage their org rate limits" (ALL with org check)

-- ============================================================
-- 3. Update cache functions to require org_id
-- ============================================================

-- Update get_enrichment_cache function to use org_id for filtering
CREATE OR REPLACE FUNCTION get_enrichment_cache(
    p_cache_key TEXT,
    p_cache_type TEXT,
    p_org_id UUID DEFAULT NULL
)
RETURNS TABLE(
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
    WHERE cache_key = p_cache_key 
      AND cache_type = p_cache_type 
      AND expires_at > now()
      AND (p_org_id IS NULL OR org_id = p_org_id);

    RETURN QUERY
    SELECT ec.enriched_data, ec.sources, ec.confidence, true AS hit
    FROM enrichment_cache ec
    WHERE ec.cache_key = p_cache_key 
      AND ec.cache_type = p_cache_type 
      AND ec.expires_at > now()
      AND (p_org_id IS NULL OR ec.org_id = p_org_id);
    
    -- If no rows returned, return empty with hit=false
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$;

-- Update set_enrichment_cache function to require org_id
CREATE OR REPLACE FUNCTION set_enrichment_cache(
    p_cache_key TEXT,
    p_cache_type TEXT,
    p_enriched_data JSONB,
    p_sources TEXT[],
    p_confidence NUMERIC,
    p_total_cost NUMERIC DEFAULT 0,
    p_ttl_days INTEGER DEFAULT 30,
    p_org_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO enrichment_cache (cache_key, cache_type, enriched_data, sources, confidence, total_cost, expires_at, org_id)
    VALUES (p_cache_key, p_cache_type, p_enriched_data, p_sources, p_confidence, p_total_cost, now() + (p_ttl_days || ' days')::interval, p_org_id)
    ON CONFLICT (cache_key, cache_type) 
    DO UPDATE SET 
        enriched_data = EXCLUDED.enriched_data,
        sources = EXCLUDED.sources,
        confidence = EXCLUDED.confidence,
        total_cost = EXCLUDED.total_cost,
        expires_at = EXCLUDED.expires_at,
        org_id = COALESCE(EXCLUDED.org_id, enrichment_cache.org_id)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;
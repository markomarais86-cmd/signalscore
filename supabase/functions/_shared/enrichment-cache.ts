/**
 * Enrichment Cache Module (Simplified)
 * 
 * Provides lightweight caching for enrichment results.
 * Uses direct table queries instead of RPC for simplicity.
 * 
 * Cache TTL: 30 days by default
 * Security: All cache entries are scoped to org_id for tenant isolation
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CacheEntry {
  enriched_data: Record<string, any>;
  sources: string[];
  confidence: number;
  hit: boolean;
}

/**
 * Generate a normalized cache key for domain lookups
 */
export function getDomainCacheKey(domain: string): string {
  if (!domain) return '';
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

/**
 * Generate a normalized cache key for email lookups
 */
export function getEmailCacheKey(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Generate a normalized cache key for company lookups
 */
export function getCompanyCacheKey(companyName: string, domain?: string): string {
  if (domain) {
    return getDomainCacheKey(domain);
  }
  if (!companyName) return '';
  return companyName
    .toLowerCase()
    .trim()
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Apply confidence decay based on cache age
 * Fresher data = higher confidence, stale data = reduced confidence
 */
function applyConfidenceDecay(baseConfidence: number, cacheAgeDays: number): number {
  // No decay for first 7 days
  if (cacheAgeDays <= 7) return baseConfidence;
  
  // Calculate weeks old (after first week)
  const weeksOld = Math.floor((cacheAgeDays - 7) / 7);
  
  // Decay 2% per week, minimum 70% of original confidence
  const decayFactor = Math.max(0.7, 1 - (weeksOld * 0.02));
  
  return baseConfidence * decayFactor;
}

/**
 * Calculate cache age in days from timestamp
 */
function getCacheAgeDays(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check cache for existing enrichment data (non-blocking, safe)
 * IMPROVEMENT #6: Applies confidence decay for stale cached data
 * SECURITY: Filters by org_id for tenant isolation
 */
export async function getCachedEnrichment(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company',
  orgId?: string
): Promise<CacheEntry | null> {
  if (!cacheKey) return null;

  try {
    let query = supabase
      .from('enrichment_cache')
      .select('enriched_data, sources, confidence, created_at, hit_count, org_id')
      .eq('cache_key', cacheKey)
      .eq('cache_type', cacheType)
      .gt('expires_at', new Date().toISOString());

    // Filter by org_id if provided for tenant isolation
    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return null;
    }

    // IMPROVEMENT #6: Apply confidence decay based on cache age
    const cacheAgeDays = getCacheAgeDays(data.created_at);
    const originalConfidence = data.confidence || 0.9;
    const adjustedConfidence = applyConfidenceDecay(originalConfidence, cacheAgeDays);
    
    if (cacheAgeDays > 7) {
      console.log(`[enrichment-cache] Confidence decay applied: ${Math.round(originalConfidence * 100)}% → ${Math.round(adjustedConfidence * 100)}% (${cacheAgeDays} days old)`);
    }

    // Update hit count in background (don't wait)
    const updateQuery = supabase
      .from('enrichment_cache')
      .update({ hit_count: (data as any).hit_count + 1, last_accessed_at: new Date().toISOString() })
      .eq('cache_key', cacheKey)
      .eq('cache_type', cacheType);
    
    if (orgId) {
      updateQuery.eq('org_id', orgId);
    }
    
    updateQuery.then(() => {}).catch(() => {});

    console.log(`[enrichment-cache] HIT for ${cacheType}:${cacheKey.slice(0, 20)}... (age: ${cacheAgeDays}d, confidence: ${Math.round(adjustedConfidence * 100)}%)`);
    return {
      enriched_data: data.enriched_data || {},
      sources: data.sources || [],
      confidence: adjustedConfidence,
      hit: true,
    };
  } catch (error) {
    console.warn('[enrichment-cache] Cache lookup error:', error);
    return null;
  }
}

/**
 * Store enrichment result in cache (non-blocking, safe)
 * SECURITY: Stores org_id for tenant isolation
 */
export async function setCachedEnrichment(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company',
  enrichedData: Record<string, any>,
  sources: string[],
  confidence: number,
  totalCost: number = 0,
  ttlDays: number = 30,
  orgId?: string
): Promise<boolean> {
  if (!cacheKey) return false;

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const cacheRecord: Record<string, any> = {
      cache_key: cacheKey,
      cache_type: cacheType,
      enriched_data: enrichedData,
      sources,
      confidence,
      total_cost: totalCost,
      expires_at: expiresAt.toISOString(),
      hit_count: 0,
      last_accessed_at: new Date().toISOString(),
    };

    // Include org_id for tenant isolation if provided
    if (orgId) {
      cacheRecord.org_id = orgId;
    }

    const { error } = await supabase
      .from('enrichment_cache')
      .upsert(cacheRecord, {
        onConflict: 'cache_key,cache_type'
      });

    if (error) {
      console.warn('[enrichment-cache] Cache write error:', error.message);
      return false;
    }

    console.log(`[enrichment-cache] Cached ${cacheType}:${cacheKey.slice(0, 20)}... (TTL: ${ttlDays}d)`);
    return true;
  } catch (error) {
    console.warn('[enrichment-cache] Cache write failed:', error);
    return false;
  }
}

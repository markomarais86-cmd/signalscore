/**
 * Enrichment Cache Module
 * 
 * Provides caching for enrichment results to reduce API costs
 * and improve speed for repeated lookups.
 * 
 * Cache TTL: 30 days by default
 * Cache Types: 'domain', 'email', 'company'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CacheEntry {
  enriched_data: Record<string, any>;
  sources: string[];
  confidence: number;
  hit: boolean;
}

export interface CacheConfig {
  ttlDays?: number;
  enabled?: boolean;
}

const DEFAULT_TTL_DAYS = 30;

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
  // Normalize company name: lowercase, remove common suffixes
  return companyName
    .toLowerCase()
    .trim()
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Check cache for existing enrichment data
 */
export async function getCachedEnrichment(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company'
): Promise<CacheEntry | null> {
  if (!cacheKey) return null;

  try {
    const { data, error } = await supabase.rpc('get_enrichment_cache', {
      p_cache_key: cacheKey,
      p_cache_type: cacheType,
    });

    if (error) {
      console.warn('[enrichment-cache] Cache lookup error:', error.message);
      return null;
    }

    // RPC returns array, get first row
    const result = Array.isArray(data) ? data[0] : data;
    
    if (result && result.hit === true) {
      console.log(`[enrichment-cache] HIT for ${cacheType}:${cacheKey.slice(0, 20)}...`);
      return {
        enriched_data: result.enriched_data || {},
        sources: result.sources || [],
        confidence: result.confidence || 0,
        hit: true,
      };
    }

    console.log(`[enrichment-cache] MISS for ${cacheType}:${cacheKey.slice(0, 20)}...`);
    return null;
  } catch (error) {
    console.error('[enrichment-cache] Cache lookup failed:', error);
    return null;
  }
}

/**
 * Store enrichment result in cache
 */
export async function setCachedEnrichment(
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company',
  enrichedData: Record<string, any>,
  sources: string[],
  confidence: number,
  totalCost: number = 0,
  ttlDays: number = DEFAULT_TTL_DAYS
): Promise<boolean> {
  if (!cacheKey) return false;

  try {
    const { data, error } = await supabase.rpc('set_enrichment_cache', {
      p_cache_key: cacheKey,
      p_cache_type: cacheType,
      p_enriched_data: enrichedData,
      p_sources: sources,
      p_confidence: confidence,
      p_total_cost: totalCost,
      p_ttl_days: ttlDays,
    });

    if (error) {
      console.warn('[enrichment-cache] Cache write error:', error.message);
      return false;
    }

    console.log(`[enrichment-cache] Cached ${cacheType}:${cacheKey.slice(0, 20)}... (TTL: ${ttlDays}d)`);
    return true;
  } catch (error) {
    console.error('[enrichment-cache] Cache write failed:', error);
    return false;
  }
}

/**
 * Bulk check cache for multiple keys
 * Returns map of key -> cached data (or null if miss)
 */
export async function getBulkCachedEnrichment(
  supabase: ReturnType<typeof createClient>,
  keys: { key: string; type: 'domain' | 'email' | 'company' }[]
): Promise<Map<string, CacheEntry | null>> {
  const results = new Map<string, CacheEntry | null>();
  
  if (!keys.length) return results;

  // For efficiency, do parallel lookups (max 10 concurrent)
  const batchSize = 10;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const promises = batch.map(({ key, type }) => 
      getCachedEnrichment(supabase, key, type).then(result => ({ key, result }))
    );
    
    const batchResults = await Promise.all(promises);
    for (const { key, result } of batchResults) {
      results.set(key, result);
    }
  }

  return results;
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(
  supabase: ReturnType<typeof createClient>
): Promise<{
  totalEntries: number;
  totalHits: number;
  hitRate: number;
  expiredCount: number;
}> {
  try {
    const { data, error } = await supabase
      .from('enrichment_cache')
      .select('hit_count, expires_at')
      .limit(10000);

    if (error) throw error;

    const now = new Date();
    const totalEntries = data.length;
    const totalHits = data.reduce((sum, row) => sum + (row.hit_count || 0), 0);
    const expiredCount = data.filter(row => new Date(row.expires_at) < now).length;
    const validEntries = totalEntries - expiredCount;
    const hitRate = validEntries > 0 ? (totalHits / (totalHits + validEntries)) * 100 : 0;

    return { totalEntries, totalHits, hitRate: Math.round(hitRate * 10) / 10, expiredCount };
  } catch (error) {
    console.error('[enrichment-cache] Stats fetch failed:', error);
    return { totalEntries: 0, totalHits: 0, hitRate: 0, expiredCount: 0 };
  }
}

/**
 * Cleanup expired cache entries
 */
export async function cleanupExpiredCache(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_cache');
    if (error) throw error;
    const count = typeof data === 'number' ? data : 0;
    console.log(`[enrichment-cache] Cleaned up ${count} expired entries`);
    return count;
  } catch (error) {
    console.error('[enrichment-cache] Cleanup failed:', error);
    return 0;
  }
}

/**
 * Enrichment Cache Module (Simplified)
 * 
 * Provides lightweight caching for enrichment results.
 * Uses direct table queries instead of RPC for simplicity.
 * 
 * Cache TTL: 30 days by default
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
 * Check cache for existing enrichment data (non-blocking, safe)
 */
export async function getCachedEnrichment(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company'
): Promise<CacheEntry | null> {
  if (!cacheKey) return null;

  try {
    const { data, error } = await supabase
      .from('enrichment_cache')
      .select('enriched_data, sources, confidence')
      .eq('cache_key', cacheKey)
      .eq('cache_type', cacheType)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Update hit count in background (don't wait)
    supabase
      .from('enrichment_cache')
      .update({ hit_count: (data as any).hit_count + 1, last_accessed_at: new Date().toISOString() })
      .eq('cache_key', cacheKey)
      .eq('cache_type', cacheType)
      .then(() => {})
      .catch(() => {});

    console.log(`[enrichment-cache] HIT for ${cacheType}:${cacheKey.slice(0, 20)}...`);
    return {
      enriched_data: data.enriched_data || {},
      sources: data.sources || [],
      confidence: data.confidence || 0,
      hit: true,
    };
  } catch (error) {
    console.warn('[enrichment-cache] Cache lookup error:', error);
    return null;
  }
}

/**
 * Store enrichment result in cache (non-blocking, safe)
 */
export async function setCachedEnrichment(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: 'domain' | 'email' | 'company',
  enrichedData: Record<string, any>,
  sources: string[],
  confidence: number,
  totalCost: number = 0,
  ttlDays: number = 30
): Promise<boolean> {
  if (!cacheKey) return false;

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const { error } = await supabase
      .from('enrichment_cache')
      .upsert({
        cache_key: cacheKey,
        cache_type: cacheType,
        enriched_data: enrichedData,
        sources,
        confidence,
        total_cost: totalCost,
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
        last_accessed_at: new Date().toISOString(),
      }, {
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

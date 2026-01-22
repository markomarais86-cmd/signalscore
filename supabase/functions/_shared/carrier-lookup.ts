// Carrier Lookup using NumVerify API
// Validates phone numbers and retrieves carrier/line type information
// Includes database caching and retry logic for rate limit handling

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CarrierInfo {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string | null;
  carrier: string | null;
  line_type: 'mobile' | 'landline' | 'special_services' | 'toll_free' | 'premium_rate' | 'unknown';
  error?: string;
  lookup_cost: number;
  cached: boolean;
}

interface NumVerifyResponse {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: string | null;
  error?: {
    code: number;
    type: string;
    info: string;
  };
}

interface CachedCarrier {
  phone_normalized: string;
  carrier_name: string | null;
  line_type: string | null;
  country_code: string | null;
  country_name: string | null;
  valid: boolean;
  raw_response: any;
  expires_at: string;
}

// Simple in-memory cache for carrier lookups (persists within function invocation)
const memoryCache = new Map<string, CarrierInfo>();

// Normalize phone number for cache key
function normalizeForCache(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Map NumVerify line_type to our standardized types
function mapLineType(lineType: string | null): CarrierInfo['line_type'] {
  if (!lineType) return 'unknown';
  
  const normalized = lineType.toLowerCase();
  
  if (normalized === 'mobile') return 'mobile';
  if (normalized === 'landline' || normalized === 'fixed_line') return 'landline';
  if (normalized === 'toll_free' || normalized === 'tollfree') return 'toll_free';
  if (normalized === 'premium_rate') return 'premium_rate';
  if (normalized === 'special_services' || normalized === 'special') return 'special_services';
  
  return 'unknown';
}

// Create Supabase client for database caching
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[carrier-lookup] Supabase credentials not available for caching');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Check database cache for existing carrier info
async function checkDbCache(phone: string): Promise<CarrierInfo | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  
  const normalized = normalizeForCache(phone);
  
  try {
    const { data, error } = await supabase
      .from('carrier_cache')
      .select('*')
      .eq('phone_normalized', normalized)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    const cached = data as CachedCarrier;
    console.log(`[carrier-lookup] DB cache hit for ${phone}`);
    
    return {
      valid: cached.valid,
      number: phone,
      local_format: cached.raw_response?.local_format || '',
      international_format: cached.raw_response?.international_format || '',
      country_prefix: cached.raw_response?.country_prefix || '',
      country_code: cached.country_code || '',
      country_name: cached.country_name || '',
      location: cached.raw_response?.location || null,
      carrier: cached.carrier_name,
      line_type: mapLineType(cached.line_type),
      lookup_cost: 0,
      cached: true,
    };
  } catch (err) {
    console.warn('[carrier-lookup] DB cache check failed:', err);
    return null;
  }
}

// Save carrier info to database cache
async function saveToDbCache(phone: string, info: CarrierInfo, orgId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  
  const normalized = normalizeForCache(phone);
  
  try {
    await supabase
      .from('carrier_cache')
      .upsert({
        phone_normalized: normalized,
        carrier_name: info.carrier,
        line_type: info.line_type,
        country_code: info.country_code,
        country_name: info.country_name,
        valid: info.valid,
        raw_response: {
          local_format: info.local_format,
          international_format: info.international_format,
          country_prefix: info.country_prefix,
          location: info.location,
        },
        org_id: orgId,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      }, {
        onConflict: 'phone_normalized',
      });
    
    console.log(`[carrier-lookup] Saved to DB cache: ${phone}`);
  } catch (err) {
    console.warn('[carrier-lookup] Failed to save to DB cache:', err);
  }
}

// Check if error is a rate limit error
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  const errorStr = String(error).toLowerCase();
  return errorStr.includes('429') || 
         errorStr.includes('rate limit') || 
         errorStr.includes('too many requests') ||
         errorStr.includes('quota exceeded');
}

/**
 * Look up carrier information for a phone number using NumVerify API
 * Includes retry logic with exponential backoff for rate limits
 * Cost: ~$0.001-0.005 per lookup depending on plan
 */
export async function lookupCarrier(
  phone: string, 
  options: { maxRetries?: number; orgId?: string } = {}
): Promise<CarrierInfo> {
  const { maxRetries = 3, orgId } = options;
  const apiKey = Deno.env.get('NUMVERIFY_API_KEY');
  
  if (!apiKey) {
    console.error('[carrier-lookup] NUMVERIFY_API_KEY not configured');
    return {
      valid: false,
      number: phone,
      local_format: '',
      international_format: '',
      country_prefix: '',
      country_code: '',
      country_name: '',
      location: null,
      carrier: null,
      line_type: 'unknown',
      error: 'API key not configured',
      lookup_cost: 0,
      cached: false,
    };
  }

  // Check memory cache first
  const cacheKey = normalizeForCache(phone);
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    console.log(`[carrier-lookup] Memory cache hit for ${phone}`);
    return { ...memoryCached, cached: true };
  }

  // Check database cache
  const dbCached = await checkDbCache(phone);
  if (dbCached) {
    memoryCache.set(cacheKey, dbCached);
    return dbCached;
  }

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // NumVerify API endpoint
      const url = new URL('http://apilayer.net/api/validate');
      url.searchParams.set('access_key', apiKey);
      url.searchParams.set('number', phone);
      url.searchParams.set('country_code', ''); // Auto-detect
      url.searchParams.set('format', '1');

      console.log(`[carrier-lookup] Looking up: ${phone} (attempt ${attempt + 1}/${maxRetries})`);
      
      const response = await fetch(url.toString());
      
      // Handle rate limiting with retry
      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[carrier-lookup] Rate limited (429), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`NumVerify API error: ${response.status} ${response.statusText}`);
      }

      const data: NumVerifyResponse = await response.json();

      // Check for API-level errors (including rate limit errors in response body)
      if (data.error) {
        console.error(`[carrier-lookup] API error:`, data.error);
        
        // Check if it's a rate limit error
        if (data.error.code === 104 || isRateLimitError(data.error.info)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[carrier-lookup] Rate limit error in response, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return {
          valid: false,
          number: phone,
          local_format: '',
          international_format: '',
          country_prefix: '',
          country_code: '',
          country_name: '',
          location: null,
          carrier: null,
          line_type: 'unknown',
          error: data.error.info || 'API error',
          lookup_cost: 0.001,
          cached: false,
        };
      }

      const result: CarrierInfo = {
        valid: data.valid,
        number: data.number,
        local_format: data.local_format,
        international_format: data.international_format,
        country_prefix: data.country_prefix,
        country_code: data.country_code,
        country_name: data.country_name,
        location: data.location || null,
        carrier: data.carrier || null,
        line_type: mapLineType(data.line_type),
        lookup_cost: 0.001, // Approximate cost per lookup
        cached: false,
      };

      // Cache the result in memory and database
      memoryCache.set(cacheKey, result);
      await saveToDbCache(phone, result, orgId);
      
      console.log(`[carrier-lookup] Result for ${phone}: valid=${result.valid}, carrier=${result.carrier}, line_type=${result.line_type}`);

      return result;

    } catch (error: any) {
      console.error(`[carrier-lookup] Error looking up ${phone} (attempt ${attempt + 1}):`, error);
      
      // Check if it's a rate limit error and we have retries left
      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[carrier-lookup] Rate limit detected, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Last attempt or non-retryable error
      if (attempt === maxRetries - 1) {
        return {
          valid: false,
          number: phone,
          local_format: '',
          international_format: '',
          country_prefix: '',
          country_code: '',
          country_name: '',
          location: null,
          carrier: null,
          line_type: 'unknown',
          error: error.message || 'Unknown error',
          lookup_cost: 0,
          cached: false,
        };
      }
    }
  }

  // Should not reach here, but return error result just in case
  return {
    valid: false,
    number: phone,
    local_format: '',
    international_format: '',
    country_prefix: '',
    country_code: '',
    country_name: '',
    location: null,
    carrier: null,
    line_type: 'unknown',
    error: 'Rate limit exceeded after retries',
    lookup_cost: 0,
    cached: false,
  };
}

/**
 * Batch lookup carrier information for multiple phone numbers
 * Processes sequentially with configurable delay to respect rate limits
 */
export async function lookupCarrierBatch(
  phones: string[],
  options: { maxConcurrent?: number; delayMs?: number; orgId?: string } = {}
): Promise<Map<string, CarrierInfo>> {
  const { maxConcurrent = 1, delayMs = 1000, orgId } = options;
  const results = new Map<string, CarrierInfo>();
  
  console.log(`[carrier-lookup] Batch lookup for ${phones.length} numbers (delay: ${delayMs}ms)`);
  
  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const result = await lookupCarrier(phone, { orgId });
    results.set(phone, result);
    
    // Add delay between requests to avoid rate limiting (skip if cached)
    if (i < phones.length - 1 && !result.cached) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const validCount = Array.from(results.values()).filter(r => r.valid).length;
  const mobileCount = Array.from(results.values()).filter(r => r.line_type === 'mobile').length;
  const cachedCount = Array.from(results.values()).filter(r => r.cached).length;
  
  console.log(`[carrier-lookup] Batch complete: ${validCount}/${phones.length} valid, ${mobileCount} mobile, ${cachedCount} cached`);
  
  return results;
}

/**
 * Check if a phone number is mobile based on carrier lookup
 */
export async function isMobileNumber(phone: string, orgId?: string): Promise<boolean> {
  const info = await lookupCarrier(phone, { orgId });
  return info.valid && info.line_type === 'mobile';
}

/**
 * Get the best phone number for SMS/calling from a list
 * Prioritizes: mobile > landline > unknown
 */
export async function getBestPhoneForContact(
  phones: string[],
  orgId?: string
): Promise<{
  phone: string;
  info: CarrierInfo;
} | null> {
  if (phones.length === 0) return null;
  
  const results = await lookupCarrierBatch(phones, { orgId });
  
  // Priority: mobile first, then landline, then anything valid
  const priorities: CarrierInfo['line_type'][] = ['mobile', 'landline', 'unknown'];
  
  for (const priority of priorities) {
    for (const [phone, info] of results) {
      if (info.valid && info.line_type === priority) {
        return { phone, info };
      }
    }
  }
  
  // Return first valid number if no preferred type found
  for (const [phone, info] of results) {
    if (info.valid) {
      return { phone, info };
    }
  }
  
  return null;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(orgId?: string): Promise<{
  memorySize: number;
  dbCount: number;
  expiredCount: number;
}> {
  const supabase = getSupabaseClient();
  let dbCount = 0;
  let expiredCount = 0;
  
  if (supabase) {
    try {
      const { count: totalCount } = await supabase
        .from('carrier_cache')
        .select('*', { count: 'exact', head: true });
      
      const { count: expCount } = await supabase
        .from('carrier_cache')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());
      
      dbCount = totalCount || 0;
      expiredCount = expCount || 0;
    } catch (err) {
      console.warn('[carrier-lookup] Failed to get cache stats:', err);
    }
  }
  
  return {
    memorySize: memoryCache.size,
    dbCount,
    expiredCount,
  };
}

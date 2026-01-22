// Carrier Lookup using NumVerify API
// Validates phone numbers and retrieves carrier/line type information

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

// Simple in-memory cache for carrier lookups (persists within function invocation)
const carrierCache = new Map<string, CarrierInfo>();

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

/**
 * Look up carrier information for a phone number using NumVerify API
 * Cost: ~$0.001-0.005 per lookup depending on plan
 */
export async function lookupCarrier(phone: string): Promise<CarrierInfo> {
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

  // Check cache first
  const cacheKey = normalizeForCache(phone);
  const cached = carrierCache.get(cacheKey);
  if (cached) {
    console.log(`[carrier-lookup] Cache hit for ${phone}`);
    return { ...cached, cached: true };
  }

  try {
    // NumVerify API endpoint
    const url = new URL('http://apilayer.net/api/validate');
    url.searchParams.set('access_key', apiKey);
    url.searchParams.set('number', phone);
    url.searchParams.set('country_code', ''); // Auto-detect
    url.searchParams.set('format', '1');

    console.log(`[carrier-lookup] Looking up: ${phone}`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`NumVerify API error: ${response.status} ${response.statusText}`);
    }

    const data: NumVerifyResponse = await response.json();

    // Check for API-level errors
    if (data.error) {
      console.error(`[carrier-lookup] API error:`, data.error);
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

    // Cache the result
    carrierCache.set(cacheKey, result);
    
    console.log(`[carrier-lookup] Result for ${phone}: valid=${result.valid}, carrier=${result.carrier}, line_type=${result.line_type}`);

    return result;

  } catch (error: any) {
    console.error(`[carrier-lookup] Error looking up ${phone}:`, error);
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

/**
 * Batch lookup carrier information for multiple phone numbers
 * Processes sequentially to respect rate limits
 */
export async function lookupCarrierBatch(
  phones: string[],
  options: { maxConcurrent?: number; delayMs?: number } = {}
): Promise<Map<string, CarrierInfo>> {
  const { maxConcurrent = 1, delayMs = 100 } = options;
  const results = new Map<string, CarrierInfo>();
  
  console.log(`[carrier-lookup] Batch lookup for ${phones.length} numbers`);
  
  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const result = await lookupCarrier(phone);
    results.set(phone, result);
    
    // Add delay between requests to avoid rate limiting
    if (i < phones.length - 1 && !result.cached) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const validCount = Array.from(results.values()).filter(r => r.valid).length;
  const mobileCount = Array.from(results.values()).filter(r => r.line_type === 'mobile').length;
  
  console.log(`[carrier-lookup] Batch complete: ${validCount}/${phones.length} valid, ${mobileCount} mobile`);
  
  return results;
}

/**
 * Check if a phone number is mobile based on carrier lookup
 */
export async function isMobileNumber(phone: string): Promise<boolean> {
  const info = await lookupCarrier(phone);
  return info.valid && info.line_type === 'mobile';
}

/**
 * Get the best phone number for SMS/calling from a list
 * Prioritizes: mobile > landline > unknown
 */
export async function getBestPhoneForContact(phones: string[]): Promise<{
  phone: string;
  info: CarrierInfo;
} | null> {
  if (phones.length === 0) return null;
  
  const results = await lookupCarrierBatch(phones);
  
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

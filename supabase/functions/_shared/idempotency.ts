import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

export interface IdempotencyResult {
  isDuplicate: boolean;
  cachedResponse?: any;
  key: string;
}

export interface IdempotencyConfig {
  ttlSeconds?: number;
  endpoint: string;
  orgId: string;
}

// Default TTL configurations per endpoint type
export const IDEMPOTENCY_TTL = {
  'enrichment-orchestrator': 300, // 5 minutes - long-running job
  'bulk-score-accounts': 300,     // 5 minutes - long-running job
  'clay-webhook-receiver': 60,    // 1 minute - webhook retry window
  'default': 60,                   // 1 minute default
};

/**
 * Generate a deterministic hash from request body for idempotency
 */
export function generateIdempotencyKey(
  orgId: string,
  endpoint: string,
  requestBody: any
): string {
  // Create a stable string representation of the request
  const stableBody = JSON.stringify(requestBody, Object.keys(requestBody).sort());
  
  // Simple hash function for Deno
  let hash = 0;
  const str = `${orgId}:${endpoint}:${stableBody}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${orgId}:${endpoint}:${Math.abs(hash).toString(36)}`;
}

/**
 * Check if a request is a duplicate based on idempotency key
 */
export async function checkIdempotency(
  supabase: SupabaseClient,
  key: string,
  endpoint: string,
  ttlSeconds: number = IDEMPOTENCY_TTL.default
): Promise<IdempotencyResult> {
  try {
    // Check for existing non-expired key
    const { data, error } = await supabase
      .from('idempotency_keys')
      .select('response, expires_at')
      .eq('idempotency_key', key)
      .eq('endpoint', endpoint)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('[Idempotency] Check error:', error);
      // Fail open - allow the request
      return { isDuplicate: false, key };
    }

    if (data) {
      console.log(`[Idempotency] Duplicate detected for ${endpoint}, key: ${key.substring(0, 50)}...`);
      return {
        isDuplicate: true,
        cachedResponse: data.response,
        key,
      };
    }

    return { isDuplicate: false, key };
  } catch (error) {
    console.error('[Idempotency] Exception:', error);
    return { isDuplicate: false, key };
  }
}

/**
 * Record an idempotency key after successful processing
 */
export async function recordIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
  endpoint: string,
  orgId: string,
  response: any,
  ttlSeconds: number = IDEMPOTENCY_TTL.default
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    
    const { error } = await supabase
      .from('idempotency_keys')
      .upsert({
        idempotency_key: key,
        endpoint,
        org_id: orgId,
        response,
        expires_at: expiresAt,
      }, {
        onConflict: 'idempotency_key,endpoint',
      });

    if (error) {
      console.error('[Idempotency] Record error:', error);
    } else {
      console.log(`[Idempotency] Recorded key for ${endpoint}, TTL: ${ttlSeconds}s`);
    }
  } catch (error) {
    console.error('[Idempotency] Record exception:', error);
  }
}

/**
 * Helper to apply idempotency check at the start of an edge function
 * Returns a Response if duplicate, null if new request
 */
export async function applyIdempotency(
  supabase: SupabaseClient,
  orgId: string,
  endpoint: string,
  requestBody: any,
  corsHeaders: Record<string, string>
): Promise<{ response: Response | null; key: string }> {
  const ttl = IDEMPOTENCY_TTL[endpoint as keyof typeof IDEMPOTENCY_TTL] || IDEMPOTENCY_TTL.default;
  const key = generateIdempotencyKey(orgId, endpoint, requestBody);
  
  const result = await checkIdempotency(supabase, key, endpoint, ttl);
  
  if (result.isDuplicate && result.cachedResponse) {
    console.log(`[Idempotency] Returning cached response for ${endpoint}`);
    return {
      response: new Response(
        JSON.stringify({
          ...result.cachedResponse,
          _cached: true,
          _idempotency_key: key.substring(0, 20) + '...',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      ),
      key,
    };
  }
  
  return { response: null, key };
}

/**
 * Check for existing in-progress jobs (for long-running operations)
 */
export async function checkExistingJob(
  supabase: SupabaseClient,
  orgId: string,
  tableName: string,
  statusField: string = 'status',
  activeStatuses: string[] = ['pending', 'processing'],
  maxAgeMinutes: number = 30
): Promise<{ exists: boolean; existingJob?: any }> {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('org_id', orgId)
      .in(statusField, activeStatuses)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[Idempotency] Check existing job error:`, error);
      return { exists: false };
    }

    if (data) {
      console.log(`[Idempotency] Found existing ${tableName} job: ${data.id}`);
      return { exists: true, existingJob: data };
    }

    return { exists: false };
  } catch (error) {
    console.error('[Idempotency] Check existing job exception:', error);
    return { exists: false };
  }
}

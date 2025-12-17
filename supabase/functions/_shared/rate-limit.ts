import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  max_requests: number;
  reset_at: string;
}

// Endpoint-specific rate limit configurations
export const RATE_LIMIT_CONFIG: Record<string, { maxRequests: number; windowSeconds: number }> = {
  // High-cost AI endpoints
  'enrich-ai-only': { maxRequests: 20, windowSeconds: 60 },
  'generate-icp-insights': { maxRequests: 30, windowSeconds: 60 },
  'ai-chat': { maxRequests: 30, windowSeconds: 60 },
  'ai-actions': { maxRequests: 30, windowSeconds: 60 },
  
  // External API endpoints (paid per call)
  'enrich-contacts-bulk': { maxRequests: 50, windowSeconds: 60 },
  'search-pdl-contacts': { maxRequests: 50, windowSeconds: 60 },
  'redeem-apollo-contacts': { maxRequests: 30, windowSeconds: 60 },
  
  // CPU-bound endpoints
  'bulk-score-accounts': { maxRequests: 100, windowSeconds: 60 },
  
  // Default for other endpoints
  'default': { maxRequests: 100, windowSeconds: 60 },
};

/**
 * Check rate limit for a given organization and endpoint
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  endpoint: string,
  maxRequests?: number,
  windowSeconds?: number
): Promise<RateLimitResult> {
  // Get config from predefined limits or use provided values
  const config = RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG['default'];
  const effectiveMaxRequests = maxRequests ?? config.maxRequests;
  const effectiveWindowSeconds = windowSeconds ?? config.windowSeconds;

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_org_id: orgId,
      p_endpoint: endpoint,
      p_max_requests: effectiveMaxRequests,
      p_window_seconds: effectiveWindowSeconds
    });

    if (error) {
      console.error(`[rate-limit] Check error for ${endpoint}:`, error);
      // Fail open - allow request if rate limit check fails
      return {
        allowed: true,
        current_count: 0,
        max_requests: effectiveMaxRequests,
        reset_at: new Date().toISOString()
      };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error(`[rate-limit] Exception for ${endpoint}:`, error);
    // Fail open
    return {
      allowed: true,
      current_count: 0,
      max_requests: effectiveMaxRequests,
      reset_at: new Date().toISOString()
    };
  }
}

/**
 * Generate a 429 rate limit response
 */
export function rateLimitResponse(
  result: RateLimitResult,
  endpoint: string
): Response {
  const resetMs = new Date(result.reset_at).getTime() - Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

  console.warn(`[rate-limit] Rate limit exceeded for ${endpoint}: ${result.current_count}/${result.max_requests}`);

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded for ${endpoint}. Try again in ${retryAfterSeconds}s.`,
        details: {
          current: result.current_count,
          limit: result.max_requests,
          retry_after: result.reset_at,
          retry_after_seconds: retryAfterSeconds
        }
      }
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Limit': result.max_requests.toString(),
        'X-RateLimit-Remaining': Math.max(0, result.max_requests - result.current_count).toString(),
        'X-RateLimit-Reset': result.reset_at
      }
    }
  );
}

/**
 * Helper to apply rate limiting at the start of an edge function
 * Returns null if allowed, or a Response if rate limited
 */
export async function applyRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  endpoint: string
): Promise<Response | null> {
  const result = await checkRateLimit(supabase, orgId, endpoint);
  
  if (!result.allowed) {
    return rateLimitResponse(result, endpoint);
  }
  
  return null;
}

// Helper function to check rate limits in edge functions
// Import this in your edge functions to add rate limiting

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  max_requests: number;
  reset_at: string;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  endpoint: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_org_id: orgId,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if rate limit check fails
      return {
        allowed: true,
        current_count: 0,
        max_requests: maxRequests,
        reset_at: new Date().toISOString()
      };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error('Rate limit check exception:', error);
    // Fail open
    return {
      allowed: true,
      current_count: 0,
      max_requests: maxRequests,
      reset_at: new Date().toISOString()
    };
  }
}

export function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${result.max_requests} per ${Math.floor((new Date(result.reset_at).getTime() - Date.now()) / 1000)}s`,
      retry_after: result.reset_at,
      current: result.current_count,
      limit: result.max_requests
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000).toString()
      }
    }
  );
}

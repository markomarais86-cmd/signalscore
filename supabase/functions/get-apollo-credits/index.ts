import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  isCircuitOpen, 
  recordSuccess, 
  recordFailure 
} from "../_shared/circuit-breaker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERVICE_NAME = 'apollo';

interface ApolloUsageResponse {
  hourly_requests_limit: number;
  hourly_requests_consumed: number;
  daily_requests_limit: number;
  daily_requests_consumed: number;
  minute_rate_limit: number;
  minute_rate_consumed: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Apollo API key not configured',
          credits_remaining: null,
          credits_used_total: null,
          configured: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check circuit breaker before calling Apollo
    const { isOpen, state, cooldownRemaining } = await isCircuitOpen(SERVICE_NAME, supabase);
    if (isOpen) {
      console.log(`[get-apollo-credits] Circuit breaker OPEN, skipping API call`);
      return new Response(
        JSON.stringify({ 
          success: false,
          configured: true,
          api_accessible: false,
          circuit_state: state,
          message: `Apollo service temporarily unavailable. Retry in ${Math.round((cooldownRemaining || 0) / 1000)}s`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-apollo-credits] Fetching Apollo usage stats...');

    // Call Apollo's usage stats endpoint - this does NOT consume credits
    const startTime = Date.now();
    const response = await fetch('https://api.apollo.io/api/v1/usage_stats/api_usage_stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey,
      },
      body: '{}',
    });
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[get-apollo-credits] Apollo API error:', response.status, errorText);
      
      // Handle 403 - API_INACCESSIBLE (common for plans without usage stats access)
      // This is not a service failure, just a plan limitation
      if (response.status === 403) {
        console.log('[get-apollo-credits] Usage stats API not accessible - API key is valid but credits not trackable');
        await recordSuccess(SERVICE_NAME, responseTime, supabase);
        return new Response(
          JSON.stringify({ 
            success: true,
            configured: true,
            api_accessible: false,
            api_key_valid: true,
            credits_remaining: null,
            credits_used_today: null,
            daily_limit: null,
            message: 'Credit balance unavailable. Use Preview to see available contacts.',
            last_checked: new Date().toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Record failure for rate limits and server errors
      if (response.status === 429 || response.status >= 500) {
        await recordFailure(SERVICE_NAME, `Apollo API error: ${response.status}`, supabase);
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Apollo API error: ${response.status}`,
          details: errorText,
          configured: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Record success
    await recordSuccess(SERVICE_NAME, responseTime, supabase);

    const usageData: ApolloUsageResponse = await response.json();
    console.log('[get-apollo-credits] Usage data:', usageData);

    // Calculate credits info
    const creditsRemaining = usageData.daily_requests_limit - usageData.daily_requests_consumed;
    const creditsUsedToday = usageData.daily_requests_consumed;
    const dailyLimit = usageData.daily_requests_limit;

    const { error: updateError } = await supabase
      .from('external_data_sources')
      .upsert({
        org_id,
        provider: 'apollo',
        credits_remaining: creditsRemaining,
        credits_used_total: creditsUsedToday,
        monthly_credit_limit: dailyLimit,
        credits_last_checked: new Date().toISOString(),
        is_active: true,
        api_key_configured: true,
      }, {
        onConflict: 'org_id,provider'
      });

    if (updateError) {
      console.error('[get-apollo-credits] Error updating credits:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        credits_remaining: creditsRemaining,
        credits_used_today: creditsUsedToday,
        daily_limit: dailyLimit,
        hourly_remaining: usageData.hourly_requests_limit - usageData.hourly_requests_consumed,
        hourly_limit: usageData.hourly_requests_limit,
        last_checked: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-apollo-credits] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
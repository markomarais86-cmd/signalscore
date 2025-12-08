import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderHealth {
  provider: string;
  available: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  lastChecked: string;
  error?: string;
}

interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: ProviderHealth[];
  availableProviders: string[];
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const deepCheck = url.searchParams.get('deep') === 'true';

    const providers = await checkAllProviders(deepCheck);
    
    // Update health status in database
    for (const provider of providers) {
      await supabase.from('ai_provider_health').upsert({
        provider: provider.provider,
        status: provider.status,
        last_success_at: provider.status === 'healthy' ? new Date().toISOString() : undefined,
        last_failure_at: provider.status === 'unhealthy' ? new Date().toISOString() : undefined,
        avg_latency_ms: provider.latencyMs,
        checked_at: new Date().toISOString(),
      }, {
        onConflict: 'provider',
      });
    }

    const availableProviders = providers
      .filter(p => p.available && p.status !== 'unhealthy')
      .map(p => p.provider);

    const overall = determineOverallHealth(providers);

    const result: HealthCheckResult = {
      overall,
      providers,
      availableProviders,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      overall: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkAllProviders(deepCheck: boolean): Promise<ProviderHealth[]> {
  const providers: ProviderHealth[] = [];

  // Check OpenAI
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiKey) {
    providers.push(await checkProvider('openai', deepCheck, {
      endpoint: 'https://api.openai.com/v1/models',
      headers: { Authorization: `Bearer ${openaiKey}` },
      testEndpoint: 'https://api.openai.com/v1/chat/completions',
      testBody: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      },
    }));
  } else {
    providers.push({
      provider: 'openai',
      available: false,
      status: 'unknown',
      lastChecked: new Date().toISOString(),
      error: 'API key not configured',
    });
  }

  // Check Abacus
  const abacusKey = Deno.env.get('ABACUS_API_KEY');
  if (abacusKey) {
    providers.push(await checkProvider('abacus', deepCheck, {
      endpoint: 'https://api.abacus.ai/v0/models',
      headers: { Authorization: `Bearer ${abacusKey}` },
      testEndpoint: 'https://api.abacus.ai/v0/chat/completions',
      testBody: {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      },
    }));
  } else {
    providers.push({
      provider: 'abacus',
      available: false,
      status: 'unknown',
      lastChecked: new Date().toISOString(),
      error: 'API key not configured',
    });
  }

  // Check Lovable AI Gateway
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovableKey) {
    providers.push(await checkProvider('lovable', deepCheck, {
      endpoint: 'https://ai.gateway.lovable.dev/v1/models',
      headers: { Authorization: `Bearer ${lovableKey}` },
      testEndpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
      testBody: {
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      },
    }));
  } else {
    providers.push({
      provider: 'lovable',
      available: false,
      status: 'unknown',
      lastChecked: new Date().toISOString(),
      error: 'API key not configured',
    });
  }

  return providers;
}

async function checkProvider(
  name: string,
  deepCheck: boolean,
  config: {
    endpoint: string;
    headers: Record<string, string>;
    testEndpoint?: string;
    testBody?: any;
  }
): Promise<ProviderHealth> {
  const startTime = Date.now();

  try {
    // Quick connectivity check
    const response = await fetch(config.endpoint, {
      method: 'GET',
      headers: {
        ...config.headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok && response.status !== 404) {
      return {
        provider: name,
        available: true,
        status: 'degraded',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${response.status}`,
      };
    }

    // Deep check - actually make a completion request
    if (deepCheck && config.testEndpoint && config.testBody) {
      const testStart = Date.now();
      const testResponse = await fetch(config.testEndpoint, {
        method: 'POST',
        headers: {
          ...config.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config.testBody),
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        return {
          provider: name,
          available: true,
          status: 'degraded',
          latencyMs: Date.now() - testStart,
          lastChecked: new Date().toISOString(),
          error: `Completion failed: ${testResponse.status}`,
        };
      }

      return {
        provider: name,
        available: true,
        status: 'healthy',
        latencyMs: Date.now() - testStart,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      provider: name,
      available: true,
      status: 'healthy',
      latencyMs: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      provider: name,
      available: false,
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

function determineOverallHealth(providers: ProviderHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
  const available = providers.filter(p => p.available);
  
  if (available.length === 0) {
    return 'unhealthy';
  }

  const healthy = available.filter(p => p.status === 'healthy');
  
  if (healthy.length > 0) {
    return 'healthy';
  }

  const degraded = available.filter(p => p.status === 'degraded');
  
  if (degraded.length > 0) {
    return 'degraded';
  }

  return 'unhealthy';
}

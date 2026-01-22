// AI Provider Abstraction Layer - Unified interface with fallbacks, rate limiting, and cost tracking

import { validateRequest, validateResponse, estimateCost } from './ai-guardrails.ts';

export type AIProvider = 'openai' | 'lovable';
export type TaskType = 'chat' | 'analysis' | 'search' | 'enrichment' | 'workflow';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  messages: AIMessage[];
  taskType?: TaskType;
  preferredProvider?: AIProvider;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  orgId?: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  cost: number;
}

export interface ProviderConfig {
  endpoint: string;
  model: string;
  apiKey: string | undefined;
  headers: Record<string, string>;
}

// Provider configurations
const PROVIDER_CONFIGS: Record<AIProvider, (taskType: TaskType) => ProviderConfig> = {
  openai: (taskType) => ({
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: taskType === 'analysis' ? 'gpt-4o' : 'gpt-4o-mini',
    apiKey: Deno.env.get('OPENAI_API_KEY'),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
  }),
  lovable: () => ({
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    model: 'google/gemini-2.5-flash',
    apiKey: Deno.env.get('LOVABLE_API_KEY'),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    },
  }),
};

// Get available providers (those with API keys configured)
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  
  if (Deno.env.get('OPENAI_API_KEY')) providers.push('openai');
  if (Deno.env.get('LOVABLE_API_KEY')) providers.push('lovable');
  
  return providers;
}

// Get provider priority order
function getProviderOrder(preferred?: AIProvider): AIProvider[] {
  const available = getAvailableProviders();
  
  if (preferred && available.includes(preferred)) {
    return [preferred, ...available.filter(p => p !== preferred)];
  }
  
  // Default priority: openai > lovable
  const priority: AIProvider[] = ['openai', 'lovable'];
  return priority.filter(p => available.includes(p));
}

// Track usage in database
async function trackUsage(
  supabaseClient: any,
  orgId: string,
  provider: AIProvider,
  model: string,
  taskType: TaskType,
  tokensInput: number,
  tokensOutput: number,
  latencyMs: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const cost = estimateCost(provider, model, tokensInput, tokensOutput);
    
    await supabaseClient.from('ai_usage_tracking').insert({
      org_id: orgId,
      provider,
      model,
      task_type: taskType,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost_estimate: cost,
      latency_ms: latencyMs,
      success,
      error_message: errorMessage,
    });
  } catch (e) {
    console.error('Failed to track AI usage:', e);
  }
}

// Update provider health status
async function updateProviderHealth(
  supabaseClient: any,
  provider: AIProvider,
  success: boolean,
  latencyMs: number
): Promise<void> {
  try {
    const { data: existing } = await supabaseClient
      .from('ai_provider_health')
      .select('*')
      .eq('provider', provider)
      .single();

    if (existing) {
      const updates: any = {
        checked_at: new Date().toISOString(),
      };

      if (success) {
        updates.last_success_at = new Date().toISOString();
        updates.failure_count = 0;
        updates.status = 'healthy';
        updates.avg_latency_ms = Math.round((existing.avg_latency_ms || latencyMs + latencyMs) / 2);
      } else {
        updates.last_failure_at = new Date().toISOString();
        updates.failure_count = (existing.failure_count || 0) + 1;
        updates.status = updates.failure_count >= 3 ? 'unhealthy' : 'degraded';
      }

      await supabaseClient
        .from('ai_provider_health')
        .update(updates)
        .eq('provider', provider);
    } else {
      await supabaseClient.from('ai_provider_health').insert({
        provider,
        status: success ? 'healthy' : 'degraded',
        last_success_at: success ? new Date().toISOString() : null,
        last_failure_at: success ? null : new Date().toISOString(),
        failure_count: success ? 0 : 1,
        avg_latency_ms: latencyMs,
      });
    }
  } catch (e) {
    console.error('Failed to update provider health:', e);
  }
}

// Call a single provider
async function callProvider(
  config: ProviderConfig,
  messages: AIMessage[],
  maxTokens: number,
  temperature: number
): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Provider error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
  };
}

// Main function: Call AI with automatic fallback
export async function callAIWithFallback(
  supabaseClient: any,
  options: AIRequestOptions
): Promise<AIResponse> {
  const {
    messages,
    taskType = 'chat',
    preferredProvider,
    maxTokens = 2000,
    temperature = 0.7,
    orgId,
  } = options;

  // Validate request through guardrails
  if (orgId) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const validation = await validateRequest(supabaseClient, orgId, lastUserMessage.content);
      if (!validation.allowed) {
        throw new Error(`Request blocked: ${validation.reason}`);
      }
    }
  }

  const providerOrder = getProviderOrder(preferredProvider);
  
  if (providerOrder.length === 0) {
    throw new Error('No AI providers available. Please configure at least one API key.');
  }

  let lastError: Error | null = null;

  for (const provider of providerOrder) {
    const startTime = Date.now();
    const config = PROVIDER_CONFIGS[provider](taskType);

    try {
      console.log(`Attempting AI call with provider: ${provider}`);
      
      const result = await callProvider(config, messages, maxTokens, temperature);
      const latencyMs = Date.now() - startTime;

      // Validate response
      const responseValidation = validateResponse(result.content);
      const finalContent = responseValidation.sanitizedContent || result.content;

      // Track successful usage
      if (orgId) {
        await trackUsage(
          supabaseClient,
          orgId,
          provider,
          config.model,
          taskType,
          result.tokensInput,
          result.tokensOutput,
          latencyMs,
          true
        );
      }

      // Update provider health
      await updateProviderHealth(supabaseClient, provider, true, latencyMs);

      const cost = estimateCost(provider, config.model, result.tokensInput, result.tokensOutput);

      console.log(`AI call successful: ${provider} (${latencyMs}ms, $${cost.toFixed(4)})`);

      return {
        content: finalContent,
        provider,
        model: config.model,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        latencyMs,
        cost,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.error(`Provider ${provider} failed:`, lastError.message);

      // Track failed usage
      if (orgId) {
        await trackUsage(
          supabaseClient,
          orgId,
          provider,
          config.model,
          taskType,
          0,
          0,
          latencyMs,
          false,
          lastError.message
        );
      }

      // Update provider health
      await updateProviderHealth(supabaseClient, provider, false, latencyMs);

      // Continue to next provider
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}

// Streaming version for chat
export async function streamAIWithFallback(
  supabaseClient: any,
  options: AIRequestOptions
): Promise<{ stream: ReadableStream; provider: AIProvider; model: string }> {
  const {
    messages,
    taskType = 'chat',
    preferredProvider,
    maxTokens = 2000,
    temperature = 0.7,
  } = options;

  const providerOrder = getProviderOrder(preferredProvider);
  
  if (providerOrder.length === 0) {
    throw new Error('No AI providers available');
  }

  for (const provider of providerOrder) {
    const config = PROVIDER_CONFIGS[provider](taskType);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Provider error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      return {
        stream: response.body,
        provider,
        model: config.model,
      };
    } catch (error) {
      console.error(`Streaming provider ${provider} failed:`, error);
      // Continue to next provider
    }
  }

  throw new Error('All AI providers failed for streaming');
}

// Get provider health status
export async function getProviderHealth(supabaseClient: any): Promise<Record<AIProvider, any>> {
  const { data } = await supabaseClient
    .from('ai_provider_health')
    .select('*');

  const health: Record<string, any> = {};
  for (const row of data || []) {
    health[row.provider] = {
      status: row.status,
      lastSuccess: row.last_success_at,
      lastFailure: row.last_failure_at,
      failureCount: row.failure_count,
      avgLatency: row.avg_latency_ms,
    };
  }

  // Add unchecked providers
  for (const provider of getAvailableProviders()) {
    if (!health[provider]) {
      health[provider] = { status: 'unknown', available: true };
    }
  }

  return health as Record<AIProvider, any>;
}

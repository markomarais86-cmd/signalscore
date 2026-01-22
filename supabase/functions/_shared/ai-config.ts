// Centralized AI Model Configuration for Multi-Provider Support
// Supports: Perplexity, OpenAI, Lovable AI Gateway, Anthropic Claude, xAI Grok
// Note: Abacus removed due to missing deploymentId configuration issues

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export type AIProvider = 'perplexity' | 'openai' | 'lovable' | 'anthropic' | 'xai';
export type TaskType = 'chat' | 'analysis' | 'enrichment' | 'bulk' | 'reasoning' | 'research';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  endpoint: string;
  supportsStreaming: boolean;
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
  supportsTemperature: boolean;
}

// Provider endpoints
export const AI_ENDPOINTS = {
  perplexity: 'https://api.perplexity.ai/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  lovable: 'https://ai.gateway.lovable.dev/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  xai: 'https://api.x.ai/v1/chat/completions',
};

// Model configurations by provider
export const AI_MODELS = {
  perplexity: {
    chat: 'sonar',
    analysis: 'sonar-pro',
    enrichment: 'sonar-pro', // Best for real-time company research with citations
    bulk: 'sonar',
    reasoning: 'sonar-reasoning',
    research: 'sonar-pro', // Real-time web search for contact/phone research
  },
  openai: {
    chat: 'gpt-4o',
    analysis: 'gpt-4o',
    enrichment: 'gpt-4o-mini',
    bulk: 'gpt-4o-mini',
    reasoning: 'o1-mini',
    research: 'gpt-4o-mini', // Fallback for contact research
  },
  // Abacus removed - consistently fails due to missing deploymentId
  lovable: {
    chat: 'google/gemini-2.5-flash',
    analysis: 'google/gemini-2.5-flash',
    enrichment: 'google/gemini-2.5-flash',
    bulk: 'google/gemini-2.5-flash-lite',
    reasoning: 'google/gemini-2.5-pro',
    research: 'google/gemini-2.5-flash', // Fast AI research fallback
  },
  anthropic: {
    chat: 'claude-3-5-sonnet-20241022',
    analysis: 'claude-3-5-sonnet-20241022',
    enrichment: 'claude-3-5-sonnet-20241022',
    bulk: 'claude-3-5-haiku-20241022', // Cheaper for bulk operations
    reasoning: 'claude-3-5-sonnet-20241022',
    research: 'claude-3-5-sonnet-20241022', // Deep reasoning for structured extraction
  },
  xai: {
    chat: 'grok-2-1212',
    analysis: 'grok-2-1212',
    enrichment: 'grok-2-1212',
    bulk: 'grok-2-1212',
    reasoning: 'grok-2-1212',
    research: 'grok-2-1212', // Real-time X/Twitter social data
  },
};

// ============================================================================
// TIMEOUT CONFIGURATION - Adaptive Timeouts
// ============================================================================

// Provider-specific base timeouts (milliseconds)
export const AI_PROVIDER_BASE_TIMEOUTS: Record<AIProvider, number> = {
  perplexity: 8000,    // 8s base - web search
  anthropic: 10000,    // 10s base - Claude reasoning
  xai: 8000,           // 8s base - Grok
  lovable: 6000,       // 6s base - Gemini Flash (fastest)
  openai: 12000,       // 12s base - GPT can be slow
};

// Maximum timeout cap (prevents any single provider from blocking too long)
export const MAX_PROVIDER_TIMEOUT = 25000; // 25s cap

// Latency multiplier for adaptive calculation
export const LATENCY_MULTIPLIER = 1.5;
export const LATENCY_BUFFER_MS = 3000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a Supabase client for internal operations
 */
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  providerName: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${providerName} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ============================================================================
// CIRCUIT BREAKER INTEGRATION
// ============================================================================

interface CircuitStatus {
  isOpen: boolean;
  state: 'closed' | 'open' | 'half_open';
  cooldownRemaining?: number;
}

/**
 * Check if circuit is open for a provider
 */
async function checkCircuitBreaker(
  provider: AIProvider,
  supabase: SupabaseClient
): Promise<CircuitStatus> {
  try {
    const { data: health } = await supabase
      .from('service_health')
      .select('circuit_state, cooldown_until, failure_count')
      .eq('service_name', provider)
      .single();
    
    if (!health) {
      // No record = circuit closed
      return { isOpen: false, state: 'closed' };
    }
    
    if (health.circuit_state === 'closed') {
      return { isOpen: false, state: 'closed' };
    }
    
    if (health.circuit_state === 'open') {
      const cooldownUntil = health.cooldown_until ? new Date(health.cooldown_until) : null;
      if (cooldownUntil && cooldownUntil > new Date()) {
        const remaining = cooldownUntil.getTime() - Date.now();
        return { isOpen: true, state: 'open', cooldownRemaining: remaining };
      }
      // Cooldown expired, transition to half-open
      await supabase
        .from('service_health')
        .update({ circuit_state: 'half_open', state_changed_at: new Date().toISOString() })
        .eq('service_name', provider);
      return { isOpen: false, state: 'half_open' };
    }
    
    // half_open - allow request (testing)
    return { isOpen: false, state: 'half_open' };
  } catch (error) {
    console.warn(`[AI Config] Circuit breaker check failed for ${provider}:`, error);
    return { isOpen: false, state: 'closed' }; // Fail open
  }
}

/**
 * Record success for circuit breaker
 */
async function recordCircuitSuccess(
  provider: AIProvider,
  latencyMs: number,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const { data: health } = await supabase
      .from('service_health')
      .select('circuit_state, success_count, total_requests, avg_response_time_ms')
      .eq('service_name', provider)
      .single();
    
    const now = new Date().toISOString();
    const currentAvg = health?.avg_response_time_ms || latencyMs;
    const newAvg = Math.round((currentAvg * 0.7) + (latencyMs * 0.3));
    
    const updates: Record<string, any> = {
      last_success_at: now,
      failure_count: 0,
      total_requests: (health?.total_requests || 0) + 1,
      avg_response_time_ms: newAvg,
    };
    
    // If half-open, check if we should close circuit
    if (health?.circuit_state === 'half_open') {
      const newSuccessCount = (health.success_count || 0) + 1;
      updates.success_count = newSuccessCount;
      
      if (newSuccessCount >= 2) {
        updates.circuit_state = 'closed';
        updates.state_changed_at = now;
        updates.success_count = 0;
        console.log(`[AI Config] ${provider}: Circuit CLOSED after recovery`);
      }
    }
    
    await supabase
      .from('service_health')
      .upsert({ service_name: provider, ...updates }, { onConflict: 'service_name' });
  } catch (error) {
    console.warn(`[AI Config] Failed to record success for ${provider}:`, error);
  }
}

/**
 * Record failure for circuit breaker
 */
async function recordCircuitFailure(
  provider: AIProvider,
  errorMessage: string,
  isTimeout: boolean,
  supabase: SupabaseClient
): Promise<{ circuitOpened: boolean }> {
  try {
    const { data: health } = await supabase
      .from('service_health')
      .select('circuit_state, failure_count, total_requests, total_failures')
      .eq('service_name', provider)
      .single();
    
    const now = new Date().toISOString();
    const failureCount = (health?.failure_count || 0) + 1;
    const failureThreshold = 3; // Open circuit after 3 failures
    const cooldownMs = 30000; // 30s cooldown
    
    const updates: Record<string, any> = {
      last_failure_at: now,
      last_error_message: errorMessage.substring(0, 500),
      failure_count: failureCount,
      total_requests: (health?.total_requests || 0) + 1,
      total_failures: (health?.total_failures || 0) + 1,
    };
    
    let circuitOpened = false;
    
    // Open circuit if threshold exceeded or in half-open state
    if (failureCount >= failureThreshold || health?.circuit_state === 'half_open') {
      updates.circuit_state = 'open';
      updates.state_changed_at = now;
      updates.cooldown_until = new Date(Date.now() + cooldownMs).toISOString();
      updates.success_count = 0;
      circuitOpened = true;
      console.log(`[AI Config] ${provider}: Circuit OPENED after ${failureCount} failures`);
    }
    
    await supabase
      .from('service_health')
      .upsert({ service_name: provider, ...updates }, { onConflict: 'service_name' });
    
    return { circuitOpened };
  } catch (error) {
    console.warn(`[AI Config] Failed to record failure for ${provider}:`, error);
    return { circuitOpened: false };
  }
}

// ============================================================================
// ADAPTIVE TIMEOUT FUNCTIONS
// ============================================================================

interface ProviderLatencyData {
  provider: string;
  avg_latency_ms: number | null;
  status: string;
  failure_count: number;
  timeout_count: number;
}

/**
 * Get adaptive timeouts based on recent provider performance
 */
async function getAdaptiveTimeouts(
  supabase: SupabaseClient
): Promise<Record<AIProvider, number>> {
  const timeouts: Record<AIProvider, number> = { ...AI_PROVIDER_BASE_TIMEOUTS };
  
  try {
    const { data: healthData } = await supabase
      .from('ai_provider_health')
      .select('provider, avg_latency_ms, status, failure_count, timeout_count')
      .in('provider', ['perplexity', 'anthropic', 'xai', 'lovable', 'openai']);
    
    if (!healthData || healthData.length === 0) {
      console.log('[AI Config] No health data, using base timeouts');
      return timeouts;
    }
    
    for (const record of healthData as ProviderLatencyData[]) {
      const provider = record.provider as AIProvider;
      const baseTimeout = AI_PROVIDER_BASE_TIMEOUTS[provider] || 10000;
      
      if (record.avg_latency_ms && record.avg_latency_ms > 0) {
        // Adaptive: avg_latency * 1.5 + buffer, but at least base
        const adaptiveTimeout = Math.max(
          baseTimeout,
          Math.round(record.avg_latency_ms * LATENCY_MULTIPLIER + LATENCY_BUFFER_MS)
        );
        // Cap at maximum
        timeouts[provider] = Math.min(adaptiveTimeout, MAX_PROVIDER_TIMEOUT);
      }
      
      // If provider is degraded/unhealthy or has many timeouts, reduce timeout to fail faster
      if (record.status === 'unhealthy' || record.failure_count > 3 || record.timeout_count > 5) {
        timeouts[provider] = Math.min(timeouts[provider], 10000);
        console.log(`[AI Config] ${provider}: reduced timeout to ${timeouts[provider]}ms (status: ${record.status}, timeouts: ${record.timeout_count})`);
      }
    }
  } catch (error) {
    console.warn('[AI Config] Failed to fetch health data, using base timeouts:', error);
  }
  
  return timeouts;
}

/**
 * Update provider health after a call
 */
async function updateProviderHealth(
  supabase: SupabaseClient,
  provider: AIProvider,
  success: boolean,
  latencyMs: number,
  isTimeout: boolean,
  cost: number
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    const { data: existing } = await supabase
      .from('ai_provider_health')
      .select('avg_latency_ms, failure_count, timeout_count, total_cost, requests_24h')
      .eq('provider', provider)
      .single();
    
    let newAvgLatency = latencyMs;
    let newFailureCount = success ? 0 : 1;
    let newTimeoutCount = isTimeout ? 1 : 0;
    let newTotalCost = cost;
    
    if (existing) {
      if (existing.avg_latency_ms && latencyMs > 0) {
        // Exponential moving average: 70% old + 30% new
        newAvgLatency = Math.round(existing.avg_latency_ms * 0.7 + latencyMs * 0.3);
      }
      newFailureCount = success ? 0 : (existing.failure_count || 0) + 1;
      newTimeoutCount = isTimeout ? (existing.timeout_count || 0) + 1 : (existing.timeout_count || 0);
      newTotalCost = (existing.total_cost || 0) + cost;
    }
    
    // Determine status based on recent performance
    let status = 'healthy';
    if (newFailureCount > 2 || newTimeoutCount > 5) {
      status = 'unhealthy';
    } else if (newFailureCount > 0 || newTimeoutCount > 2) {
      status = 'degraded';
    }
    
    await supabase.from('ai_provider_health').upsert({
      provider,
      status,
      avg_latency_ms: newAvgLatency,
      failure_count: newFailureCount,
      timeout_count: newTimeoutCount,
      total_cost: newTotalCost,
      requests_24h: (existing?.requests_24h || 0) + 1,
      last_success_at: success ? now : undefined,
      last_failure_at: success ? undefined : now,
      checked_at: now,
    }, {
      onConflict: 'provider',
    });
  } catch (error) {
    console.warn(`[AI Config] Failed to update health for ${provider}:`, error);
  }
}

// ============================================================================
// COST TRACKING
// ============================================================================

/**
 * Track AI usage for billing and analytics
 */
async function trackAIUsage(
  supabase: SupabaseClient,
  orgId: string | undefined,
  provider: AIProvider,
  model: string,
  taskType: TaskType,
  tokensInput: number,
  tokensOutput: number,
  latencyMs: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  if (!orgId) return;
  
  try {
    const costEstimate = estimateCost(provider, model, tokensInput, tokensOutput);
    
    await supabase.from('ai_usage_tracking').insert({
      org_id: orgId,
      provider,
      model,
      task_type: taskType,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost_estimate: costEstimate,
      latency_ms: latencyMs,
      success,
      error_message: errorMessage?.substring(0, 500),
    });
  } catch (error) {
    console.warn(`[AI Config] Failed to track usage for ${provider}:`, error);
  }
}

/**
 * Check if budget allows more AI calls
 */
async function checkBudget(
  supabase: SupabaseClient,
  orgId: string,
  maxCostPerDay: number = 50
): Promise<{ allowed: boolean; currentCost: number; remaining: number }> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data } = await supabase
      .from('ai_usage_tracking')
      .select('cost_estimate')
      .eq('org_id', orgId)
      .gte('created_at', todayStart.toISOString());
    
    const currentCost = (data || []).reduce((sum, row: any) => sum + (parseFloat(row.cost_estimate) || 0), 0);
    const remaining = maxCostPerDay - currentCost;
    
    return {
      allowed: remaining > 0,
      currentCost,
      remaining: Math.max(0, remaining),
    };
  } catch (error) {
    console.warn('[AI Config] Budget check failed:', error);
    return { allowed: true, currentCost: 0, remaining: maxCostPerDay }; // Fail open
  }
}

/**
 * Estimate cost based on tokens
 */
export function estimateCost(provider: string, model: string, tokensInput: number, tokensOutput: number): number {
  const costs: Record<string, Record<string, { input: number; output: number }>> = {
    openai: {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'o1-mini': { input: 0.003, output: 0.012 },
      default: { input: 0.003, output: 0.010 },
    },
    anthropic: {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
      default: { input: 0.002, output: 0.01 },
    },
    xai: {
      'grok-2-1212': { input: 0.002, output: 0.010 },
      default: { input: 0.002, output: 0.010 },
    },
    lovable: {
      default: { input: 0.001, output: 0.005 },
    },
    perplexity: {
      'sonar-pro': { input: 0.003, output: 0.015 },
      'sonar': { input: 0.001, output: 0.005 },
      default: { input: 0.002, output: 0.008 },
    },
    xai: {
      'grok-3': { input: 0.003, output: 0.015 },
      default: { input: 0.002, output: 0.008 },
    },
  };

  const providerCosts = costs[provider] || costs.lovable;
  const modelCosts = providerCosts[model] || providerCosts.default || { input: 0.001, output: 0.005 };

  return (tokensInput / 1000) * modelCosts.input + (tokensOutput / 1000) * modelCosts.output;
}

// ============================================================================
// PROVIDER AVAILABILITY
// ============================================================================

// Check which providers are available based on API keys
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  
  // Check all 5 providers
  if (Deno.env.get('PERPLEXITY_API_KEY')) {
    providers.push('perplexity');
  }
  if (Deno.env.get('OPENAI_API_KEY')) {
    providers.push('openai');
  }
  // Abacus removed - consistently fails due to missing deploymentId
  if (Deno.env.get('LOVABLE_API_KEY')) {
    providers.push('lovable');
  }
  if (Deno.env.get('ANTHROPIC_API_KEY')) {
    providers.push('anthropic');
  }
  if (Deno.env.get('XAI_API_KEY')) {
    providers.push('xai');
  }
  
  return providers;
}

// Get the best model configuration for a given task
export function getModelConfig(taskType: TaskType, preferredProvider?: AIProvider): AIModelConfig {
  const available = getAvailableProviders();
  
  // Handle no providers case early
  if (available.length === 0) {
    throw new Error('No AI provider available. Please configure PERPLEXITY_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, or LOVABLE_API_KEY.');
  }
  
  // For enrichment tasks: Perplexity first (real-time web search with citations)
  // Priority: perplexity > anthropic > xai > openai > lovable
  let provider: AIProvider;
  
  if (preferredProvider && available.includes(preferredProvider)) {
    provider = preferredProvider;
  } else if (taskType === 'enrichment' && available.includes('perplexity')) {
    // Perplexity is best for enrichment due to real-time web search
    provider = 'perplexity';
  } else if (available.includes('anthropic')) {
    provider = 'anthropic';
  } else if (available.includes('xai')) {
    provider = 'xai';
  } else if (available.includes('openai')) {
    provider = 'openai';
  } else if (available.includes('perplexity')) {
    provider = 'perplexity';
  } else if (available.includes('lovable')) {
    provider = 'lovable';
  } else {
    // Fallback to first available - shouldn't reach here given earlier check
    provider = available[0];
  }
  
  const model = AI_MODELS[provider]?.[taskType];
  
  if (!model) {
    throw new Error(`No model configured for provider ${provider} and task ${taskType}`);
  }
  
  // Determine API parameter compatibility
  const isNewerOpenAI = provider === 'openai' && 
    (model.includes('gpt-5') || model.includes('o3') || model.includes('o4'));
  
  return {
    provider,
    model,
    endpoint: AI_ENDPOINTS[provider],
    supportsStreaming: true,
    maxTokensParam: isNewerOpenAI ? 'max_completion_tokens' : 'max_tokens',
    supportsTemperature: !isNewerOpenAI && provider !== 'perplexity',
  };
}

// Get API key for a provider
export function getApiKey(provider: AIProvider): string {
  switch (provider) {
    case 'perplexity':
      return Deno.env.get('PERPLEXITY_API_KEY') || '';
    case 'openai':
      return Deno.env.get('OPENAI_API_KEY') || '';
    case 'lovable':
      return Deno.env.get('LOVABLE_API_KEY') || '';
    case 'anthropic':
      return Deno.env.get('ANTHROPIC_API_KEY') || '';
    case 'xai':
      return Deno.env.get('XAI_API_KEY') || '';
    default:
      return '';
  }
}

// Build request headers for a provider
export function buildHeaders(provider: AIProvider): Record<string, string> {
  const apiKey = getApiKey(provider);
  
  // Anthropic uses a different header format
  if (provider === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
  }
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

// Build request body for a provider
export function buildRequestBody(
  provider: AIProvider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    tools?: any[];
    tool_choice?: any;
    search_recency_filter?: string;
  } = {}
): Record<string, any> {
  const config = getModelConfig('chat', provider);
  
  // Anthropic uses a different request format
  if (provider === 'anthropic') {
    // Convert OpenAI-style messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    
    const body: Record<string, any> = {
      model,
      max_tokens: options.maxTokens || 4096,
      messages: nonSystemMessages,
    };
    
    if (systemMessage) {
      body.system = systemMessage;
    }
    
    if (options.stream !== undefined) {
      body.stream = options.stream;
    }
    
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    
    return body;
  }
  
  const body: Record<string, any> = {
    model,
    messages,
  };
  
  // Handle streaming
  if (options.stream !== undefined) {
    body.stream = options.stream;
  }
  
  // Handle max tokens based on model compatibility
  if (options.maxTokens) {
    body[config.maxTokensParam] = options.maxTokens;
  }
  
  // Handle temperature (only for compatible models)
  if (options.temperature !== undefined && config.supportsTemperature) {
    body.temperature = options.temperature;
  }
  
  // Handle tools (not supported by Perplexity)
  if (options.tools && provider !== 'perplexity') {
    body.tools = options.tools;
  }
  if (options.tool_choice && provider !== 'perplexity') {
    body.tool_choice = options.tool_choice;
  }
  
  // Perplexity-specific: search recency filter for fresh data
  if (provider === 'perplexity' && options.search_recency_filter) {
    body.search_recency_filter = options.search_recency_filter;
  }
  
  return body;
}

// ============================================================================
// SINGLE PROVIDER CALL WITH FALLBACK
// ============================================================================

// Make an AI API call with automatic fallback across ALL providers
export async function callAI(
  taskType: TaskType,
  messages: Array<{ role: string; content: string }>,
  options: {
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    tools?: any[];
    tool_choice?: any;
    preferredProvider?: AIProvider;
    search_recency_filter?: string;
    supabase?: SupabaseClient;
    orgId?: string;
  } = {}
): Promise<Response> {
  const providers = getAvailableProviders();
  const supabase = options.supabase || getSupabaseClient();
  
  if (providers.length === 0) {
    throw new Error('No AI providers configured');
  }
  
  // Get adaptive timeouts
  const timeouts = await getAdaptiveTimeouts(supabase);
  
  // For enrichment/research, use AI-first waterfall: Perplexity → Claude → Grok → Gemini
  let orderedProviders: AIProvider[];
  if (taskType === 'enrichment' || taskType === 'research') {
    // AI-First Waterfall: Prioritize real-time search and reasoning providers
    orderedProviders = [
      ...providers.filter(p => p === 'perplexity'),  // Best for real-time web search
      ...providers.filter(p => p === 'anthropic'),   // Claude for deep reasoning/extraction
      ...providers.filter(p => p === 'xai'),         // Grok for social/X data
      ...providers.filter(p => p === 'lovable'),     // Gemini as fast fallback
      ...providers.filter(p => p === 'openai'),      // GPT as backup
    ].filter(p => providers.includes(p));
    console.log(`[AI Config] Using AI-first waterfall for ${taskType}: ${orderedProviders.join(' → ')}`);
  } else if (options.preferredProvider) {
    orderedProviders = [
      options.preferredProvider,
      ...providers.filter(p => p !== options.preferredProvider)
    ];
  } else {
    orderedProviders = providers;
  }
  
  let lastError: Error | null = null;
  
  for (const provider of orderedProviders) {
    const start = Date.now();
    const timeoutMs = timeouts[provider] || AI_PROVIDER_BASE_TIMEOUTS[provider] || MAX_PROVIDER_TIMEOUT;
    
    // Check circuit breaker
    const circuitStatus = await checkCircuitBreaker(provider, supabase);
    if (circuitStatus.isOpen) {
      console.log(`[AI Config] ${provider}: Circuit OPEN, skipping (cooldown: ${circuitStatus.cooldownRemaining}ms)`);
      continue;
    }
    
    try {
      const config = getModelConfig(taskType, provider);
      const headers = buildHeaders(provider);
      const body = buildRequestBody(provider, config.model, messages, {
        ...options,
        // For Perplexity enrichment, use recent data
        search_recency_filter: provider === 'perplexity' ? (options.search_recency_filter || 'month') : undefined,
      });
      
      console.log(`[AI Config] Calling ${provider} with model ${config.model} (timeout: ${timeoutMs}ms)`);
      
      const response = await fetchWithTimeout(
        config.endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeoutMs,
        provider
      );
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        console.log(`[AI Config] ${provider} succeeded in ${latencyMs}ms`);
        
        // Record success
        await recordCircuitSuccess(provider, latencyMs, supabase);
        await updateProviderHealth(supabase, provider, true, latencyMs, false, getProviderCost(provider));
        
        // Track usage (fire and forget)
        if (options.orgId) {
          trackAIUsage(supabase, options.orgId, provider, config.model, taskType, 500, 1000, latencyMs, true)
            .catch(err => console.warn('[AI Config] Usage tracking failed:', err));
        }
        
        return response;
      }
      
      // Log error but continue to next provider
      const errorText = await response.text();
      const latencyMsFinal = Date.now() - start;
      console.error(`[AI Config] ${provider} error (${response.status}): ${errorText}`);
      
      await recordCircuitFailure(provider, errorText, false, supabase);
      await updateProviderHealth(supabase, provider, false, latencyMsFinal, false, 0);
      
      lastError = new Error(`${provider} returned ${response.status}: ${errorText}`);
      
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes('timed out');
      
      console.error(`[AI Config] ${provider} ${isTimeout ? 'TIMEOUT' : 'failed'}: ${errorMsg}`);
      
      await recordCircuitFailure(provider, errorMsg, isTimeout, supabase);
      await updateProviderHealth(supabase, provider, false, latencyMs, isTimeout, 0);
      
      lastError = error as Error;
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

// ============================================================================
// AGGREGATED AI CALL - PARALLEL EXECUTION
// ============================================================================

export interface AggregatedAIResponse {
  provider: AIProvider;
  success: boolean;
  data: any;
  error?: string;
  latencyMs: number;
  isTimeout?: boolean;
}

/**
 * Call ALL available AI providers IN PARALLEL and return aggregated responses.
 * Uses adaptive timeouts, circuit breakers, and budget limits.
 */
export async function callAIAllProviders(
  taskType: TaskType,
  messages: Array<{ role: string; content: string }>,
  options: {
    maxTokens?: number;
    temperature?: number;
    search_recency_filter?: string;
    preferredProvider?: AIProvider;
    supabase?: SupabaseClient;
    orgId?: string;
    maxCostPerDay?: number;
  } = {}
): Promise<AggregatedAIResponse[]> {
  const providers = getAvailableProviders();
  const supabase = options.supabase || getSupabaseClient();
  
  if (providers.length === 0) {
    console.warn('[AI Config] No AI providers configured');
    return [];
  }
  
  // Check budget before making calls
  if (options.orgId) {
    const { allowed, remaining } = await checkBudget(supabase, options.orgId, options.maxCostPerDay);
    if (!allowed) {
      console.warn(`[AI Config] Budget exceeded, cannot call AI providers`);
      return [];
    }
    if (remaining < 5) {
      console.warn(`[AI Config] Low budget remaining: $${remaining.toFixed(2)}`);
    }
  }
  
  // Get adaptive timeouts based on recent performance
  const timeouts = await getAdaptiveTimeouts(supabase);
  
  // Define provider order for enrichment/research tasks
  // Priority: real-time search → deep reasoning → social data → fast fallback
  let orderedProviders: AIProvider[] = [
    'perplexity',  // Real-time web search with citations
    'anthropic',   // Deep reasoning and structured extraction (Claude)
    'xai',         // Social/X data access (Grok)
    'lovable',     // Fast Gemini model
    'openai',      // Reliable backup (GPT)
  ].filter(p => providers.includes(p));
  
  // If preferred provider specified, move it to front
  if (options.preferredProvider && orderedProviders.includes(options.preferredProvider)) {
    orderedProviders = [
      options.preferredProvider,
      ...orderedProviders.filter(p => p !== options.preferredProvider)
    ];
  }
  
  // Filter out providers with open circuits
  const availableProviders: AIProvider[] = [];
  for (const provider of orderedProviders) {
    const circuitStatus = await checkCircuitBreaker(provider, supabase);
    if (!circuitStatus.isOpen) {
      availableProviders.push(provider);
    } else {
      console.log(`[AI Config] ${provider}: Circuit OPEN, excluding from aggregation (cooldown: ${circuitStatus.cooldownRemaining}ms)`);
    }
  }
  
  if (availableProviders.length === 0) {
    console.warn('[AI Config] All provider circuits are open');
    return [];
  }
  
  console.log(`[AI Config] PARALLEL call to ${availableProviders.length} providers: ${availableProviders.join(', ')}`);
  console.log(`[AI Config] Timeouts: ${JSON.stringify(timeouts)}`);
  
  // Create promise for each provider - PARALLEL EXECUTION
  const providerPromises = availableProviders.map(async (provider): Promise<AggregatedAIResponse> => {
    const start = Date.now();
    const timeoutMs = timeouts[provider] || AI_PROVIDER_BASE_TIMEOUTS[provider] || MAX_PROVIDER_TIMEOUT;
    
    try {
      const config = getModelConfig(taskType, provider);
      const headers = buildHeaders(provider);
      const body = buildRequestBody(provider, config.model, messages, {
        ...options,
        search_recency_filter: provider === 'perplexity' 
          ? (options.search_recency_filter || 'month') 
          : undefined,
      });
      
      console.log(`[AI Config] ${provider}: starting (timeout: ${timeoutMs}ms, model: ${config.model})`);
      
      const response = await fetchWithTimeout(
        config.endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeoutMs,
        provider
      );
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[AI Config] ${provider}: SUCCESS in ${latencyMs}ms`);
        
        // Record success (fire and forget)
        recordCircuitSuccess(provider, latencyMs, supabase).catch(() => {});
        updateProviderHealth(supabase, provider, true, latencyMs, false, getProviderCost(provider)).catch(() => {});
        
        // Track usage
        if (options.orgId) {
          trackAIUsage(supabase, options.orgId, provider, config.model, taskType, 500, 1000, latencyMs, true)
            .catch(() => {});
        }
        
        return { provider, success: true, data, latencyMs };
      } else {
        const errorText = await response.text();
        console.warn(`[AI Config] ${provider}: HTTP ${response.status} in ${latencyMs}ms`);
        
        recordCircuitFailure(provider, errorText, false, supabase).catch(() => {});
        updateProviderHealth(supabase, provider, false, latencyMs, false, 0).catch(() => {});
        
        return { provider, success: false, data: null, error: errorText, latencyMs };
      }
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMsg.includes('timed out');
      
      console.warn(`[AI Config] ${provider}: ${isTimeout ? 'TIMEOUT' : 'FAILED'} after ${latencyMs}ms - ${errorMsg}`);
      
      recordCircuitFailure(provider, errorMsg, isTimeout, supabase).catch(() => {});
      updateProviderHealth(supabase, provider, false, latencyMs, isTimeout, 0).catch(() => {});
      
      return { 
        provider, 
        success: false, 
        data: null, 
        error: isTimeout ? `Timeout after ${latencyMs}ms` : errorMsg, 
        latencyMs,
        isTimeout 
      };
    }
  });
  
  // Execute all in parallel with Promise.allSettled
  const results = await Promise.allSettled(providerPromises);
  
  // Extract responses from settled promises
  const responses: AggregatedAIResponse[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Promise rejection (shouldn't happen with our error handling)
      return {
        provider: availableProviders[index],
        success: false,
        data: null,
        error: result.reason?.message || 'Unknown error',
        latencyMs: 0,
      };
    }
  });
  
  const successCount = responses.filter(r => r.success).length;
  const timeoutCount = responses.filter(r => r.isTimeout).length;
  const avgLatency = Math.round(
    responses.reduce((sum, r) => sum + r.latencyMs, 0) / responses.length
  );
  
  console.log(`[AI Config] Parallel complete: ${successCount}/${responses.length} succeeded, ${timeoutCount} timeouts, avg latency: ${avgLatency}ms`);
  
  return responses;
}

/**
 * Get confidence multiplier for a provider
 */
export function getProviderConfidence(provider: AIProvider): number {
  const confidenceMap: Record<AIProvider, number> = {
    perplexity: 0.88,  // Real-time web search with citations
    anthropic: 0.85,   // Strong reasoning
    xai: 0.80,         // Social data
    openai: 0.82,      // Reliable
    lovable: 0.78,     // Fast but less verified
  };
  return confidenceMap[provider] || 0.70;
}

/**
 * Get estimated cost per call for a provider
 */
export function getProviderCost(provider: AIProvider): number {
  const costMap: Record<AIProvider, number> = {
    perplexity: 0.005,
    anthropic: 0.003,
    xai: 0.002,
    openai: 0.003,
    lovable: 0.001,
  };
  return costMap[provider] || 0.002;
}

// Parse streaming response from any provider
export async function* parseStreamingResponse(
  response: Response,
  provider: AIProvider
): AsyncGenerator<string, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Incomplete JSON, will be handled in next iteration
      }
    }
  }
}

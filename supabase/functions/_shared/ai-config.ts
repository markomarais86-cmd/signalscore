// Centralized AI Model Configuration for Multi-Provider Support
// Supports: Perplexity, OpenAI, Lovable AI Gateway, Anthropic Claude, xAI Grok
// Note: Abacus removed due to missing deploymentId configuration issues

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
    chat: 'gpt-5-2025-08-07',
    analysis: 'gpt-5-2025-08-07',
    enrichment: 'gpt-5-mini-2025-08-07',
    bulk: 'gpt-5-nano-2025-08-07',
    reasoning: 'o4-mini-2025-04-16',
    research: 'gpt-5-mini-2025-08-07', // Fallback for contact research
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
    chat: 'claude-sonnet-4-20250514',
    analysis: 'claude-sonnet-4-20250514',
    enrichment: 'claude-sonnet-4-20250514',
    bulk: 'claude-sonnet-4-20250514',
    reasoning: 'claude-sonnet-4-20250514',
    research: 'claude-sonnet-4-20250514', // Deep reasoning for structured extraction
  },
  xai: {
    chat: 'grok-3',
    analysis: 'grok-3',
    enrichment: 'grok-3',
    bulk: 'grok-3',
    reasoning: 'grok-3',
    research: 'grok-3', // Real-time X/Twitter social data
  },
};

// Check which providers are available based on API keys
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  
  // Check all 6 providers
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
  } = {}
): Promise<Response> {
  const providers = getAvailableProviders();
  
  if (providers.length === 0) {
    throw new Error('No AI providers configured');
  }
  
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
    try {
      const config = getModelConfig(taskType, provider);
      const headers = buildHeaders(provider);
      const body = buildRequestBody(provider, config.model, messages, {
        ...options,
        // For Perplexity enrichment, use recent data
        search_recency_filter: provider === 'perplexity' ? (options.search_recency_filter || 'month') : undefined,
      });
      
      console.log(`[AI Config] Calling ${provider} with model ${config.model} for task ${taskType}`);
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        console.log(`[AI Config] ${provider} succeeded`);
        return response;
      }
      
      // Log error but continue to next provider
      const errorText = await response.text();
      console.error(`[AI Config] ${provider} error (${response.status}): ${errorText}`);
      lastError = new Error(`${provider} returned ${response.status}: ${errorText}`);
      
    } catch (error) {
      console.error(`[AI Config] ${provider} failed:`, error);
      lastError = error as Error;
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

// ============================================================================
// AGGREGATED AI CALL - CALL ALL PROVIDERS AND MERGE RESULTS
// ============================================================================

export interface AggregatedAIResponse {
  provider: AIProvider;
  success: boolean;
  data: any;
  error?: string;
  latencyMs: number;
}

/**
 * Call ALL available AI providers and return aggregated responses.
 * This enables the enrichment pipeline to merge data from multiple AI sources.
 */
export async function callAIAllProviders(
  taskType: TaskType,
  messages: Array<{ role: string; content: string }>,
  options: {
    maxTokens?: number;
    temperature?: number;
    search_recency_filter?: string;
    preferredProvider?: AIProvider;
  } = {}
): Promise<AggregatedAIResponse[]> {
  const providers = getAvailableProviders();
  const responses: AggregatedAIResponse[] = [];
  
  if (providers.length === 0) {
    console.warn('[AI Config] No AI providers configured');
    return [];
  }
  
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
  
  console.log(`[AI Config] Calling ${orderedProviders.length} providers for ${taskType}: ${orderedProviders.join(' → ')}`);
  
  for (const provider of orderedProviders) {
    const start = Date.now();
    try {
      const config = getModelConfig(taskType, provider);
      const headers = buildHeaders(provider);
      const body = buildRequestBody(provider, config.model, messages, {
        ...options,
        // For Perplexity, use recent data
        search_recency_filter: provider === 'perplexity' ? (options.search_recency_filter || 'month') : undefined,
      });
      
      console.log(`[AI Config] Calling ${provider} with model ${config.model}`);
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      const latencyMs = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        responses.push({ provider, success: true, data, latencyMs });
        console.log(`[AI Config] ${provider} succeeded in ${latencyMs}ms`);
      } else {
        const errorText = await response.text();
        console.warn(`[AI Config] ${provider} error (${response.status}): ${errorText.substring(0, 200)}`);
        responses.push({ provider, success: false, data: null, error: errorText, latencyMs });
      }
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[AI Config] ${provider} failed: ${errorMsg}`);
      responses.push({ provider, success: false, data: null, error: errorMsg, latencyMs });
    }
  }
  
  const successCount = responses.filter(r => r.success).length;
  console.log(`[AI Config] Aggregation complete: ${successCount}/${orderedProviders.length} providers succeeded`);
  
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

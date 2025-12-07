// Centralized AI Model Configuration for Multi-Provider Support
// Supports: OpenAI, Abacus.AI, and Lovable AI Gateway

export type AIProvider = 'openai' | 'abacus' | 'lovable';
export type TaskType = 'chat' | 'analysis' | 'enrichment' | 'bulk' | 'reasoning';

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
  openai: 'https://api.openai.com/v1/chat/completions',
  abacus: 'https://apps.abacus.ai/api/v0/getStreamingChatResponse',
  lovable: 'https://ai.gateway.lovable.dev/v1/chat/completions',
};

// Model configurations by provider
export const AI_MODELS = {
  openai: {
    chat: 'gpt-5-2025-08-07',
    analysis: 'gpt-5-2025-08-07',
    enrichment: 'gpt-5-mini-2025-08-07',
    bulk: 'gpt-5-nano-2025-08-07',
    reasoning: 'o4-mini-2025-04-16',
  },
  abacus: {
    chat: 'RouteLLM',
    analysis: 'claude-sonnet-4.5',
    enrichment: 'gpt-5.1',
    bulk: 'gpt-5.1',
    reasoning: 'o4-mini',
  },
  lovable: {
    chat: 'google/gemini-2.5-flash',
    analysis: 'google/gemini-2.5-flash',
    enrichment: 'google/gemini-2.5-flash',
    bulk: 'google/gemini-2.5-flash-lite',
    reasoning: 'google/gemini-2.5-pro',
  },
};

// Check which providers are available based on API keys
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  
  if (Deno.env.get('OPENAI_API_KEY')) {
    providers.push('openai');
  }
  if (Deno.env.get('ABACUS_API_KEY')) {
    providers.push('abacus');
  }
  if (Deno.env.get('LOVABLE_API_KEY')) {
    providers.push('lovable');
  }
  
  return providers;
}

// Get the best model configuration for a given task
export function getModelConfig(taskType: TaskType, preferredProvider?: AIProvider): AIModelConfig {
  const available = getAvailableProviders();
  
  // Priority: preferred > openai > abacus > lovable
  let provider: AIProvider;
  
  if (preferredProvider && available.includes(preferredProvider)) {
    provider = preferredProvider;
  } else if (available.includes('openai')) {
    provider = 'openai';
  } else if (available.includes('abacus')) {
    provider = 'abacus';
  } else if (available.includes('lovable')) {
    provider = 'lovable';
  } else {
    throw new Error('No AI provider available. Please configure OPENAI_API_KEY, ABACUS_API_KEY, or LOVABLE_API_KEY.');
  }
  
  const model = AI_MODELS[provider][taskType];
  
  // Determine API parameter compatibility
  const isNewerOpenAI = provider === 'openai' && 
    (model.includes('gpt-5') || model.includes('o3') || model.includes('o4'));
  
  return {
    provider,
    model,
    endpoint: AI_ENDPOINTS[provider],
    supportsStreaming: true,
    maxTokensParam: isNewerOpenAI ? 'max_completion_tokens' : 'max_tokens',
    supportsTemperature: !isNewerOpenAI,
  };
}

// Get API key for a provider
export function getApiKey(provider: AIProvider): string {
  switch (provider) {
    case 'openai':
      return Deno.env.get('OPENAI_API_KEY') || '';
    case 'abacus':
      return Deno.env.get('ABACUS_API_KEY') || '';
    case 'lovable':
      return Deno.env.get('LOVABLE_API_KEY') || '';
  }
}

// Build request headers for a provider
export function buildHeaders(provider: AIProvider): Record<string, string> {
  const apiKey = getApiKey(provider);
  
  switch (provider) {
    case 'openai':
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    case 'abacus':
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    case 'lovable':
      return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
  }
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
  } = {}
): Record<string, any> {
  const config = getModelConfig('chat');
  
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
  
  // Handle tools
  if (options.tools) {
    body.tools = options.tools;
  }
  if (options.tool_choice) {
    body.tool_choice = options.tool_choice;
  }
  
  // Abacus-specific parameters
  if (provider === 'abacus') {
    body.deploymentToken = Deno.env.get('ABACUS_DEPLOYMENT_TOKEN') || '';
    body.deploymentId = Deno.env.get('ABACUS_DEPLOYMENT_ID') || '';
  }
  
  return body;
}

// Make an AI API call with automatic fallback
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
  } = {}
): Promise<Response> {
  const providers = getAvailableProviders();
  
  // Sort by preference
  const orderedProviders = options.preferredProvider 
    ? [options.preferredProvider, ...providers.filter(p => p !== options.preferredProvider)]
    : providers;
  
  let lastError: Error | null = null;
  
  for (const provider of orderedProviders) {
    try {
      const config = getModelConfig(taskType, provider);
      const headers = buildHeaders(provider);
      const body = buildRequestBody(provider, config.model, messages, options);
      
      console.log(`[AI Config] Calling ${provider} with model ${config.model} for task ${taskType}`);
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
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

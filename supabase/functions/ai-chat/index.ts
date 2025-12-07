import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LaunchPulse AI, an intelligent assistant for a B2B sales intelligence platform. You help users with:

**Core Capabilities:**
- ICP (Ideal Customer Profile) creation and optimization
- Account scoring and prioritization
- Lead qualification and enrichment
- Campaign building and contact discovery
- Data analysis and insights

**Platform Context:**
- Users have accounts, leads, and ICP profiles
- Accounts are scored 0-100 based on ICP fit, intent, and reachability
- High-fit accounts (70+) are prioritized for campaigns
- Leads can be enriched with firmographic and contact data
- Contact discovery finds decision-makers at target accounts

**Response Guidelines:**
- Be concise and actionable
- Provide specific next steps when possible
- Reference platform features by name (ICP Manager, Campaign Builder, etc.)
- When asked about data, remind users to check the relevant page
- Format responses with markdown for clarity

**Current Features:**
1. Executive Dashboard - Overview metrics and insights
2. ICP Manager - Define and score ideal customer profiles
3. Accounts - View and filter scored accounts
4. Leads - Manage contacts and personas
5. Data Upload - Import CRM and CSV data
6. AI Agents - Automated enrichment and qualification
7. Settings - Integrations and configurations`;

// AI Provider Configuration
type AIProvider = 'openai' | 'abacus' | 'lovable';

interface ProviderConfig {
  endpoint: string;
  model: string;
  apiKey: string | undefined;
  supportsTemperature: boolean;
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
}

interface ProviderResult {
  provider: AIProvider;
  success: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
}

function getProviderConfig(provider: AIProvider): ProviderConfig | null {
  switch (provider) {
    case 'openai':
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return null;
      return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
        apiKey: openaiKey,
        supportsTemperature: true,
        maxTokensParam: 'max_tokens',
      };
    case 'abacus':
      const abacusKey = Deno.env.get("ABACUS_API_KEY");
      if (!abacusKey) return null;
      return {
        endpoint: 'https://apps.abacus.ai/api/v0/getStreamingChatResponse',
        model: 'RouteLLM',
        apiKey: abacusKey,
        supportsTemperature: true,
        maxTokensParam: 'max_tokens',
      };
    case 'lovable':
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) return null;
      return {
        endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        model: 'google/gemini-2.5-flash',
        apiKey: lovableKey,
        supportsTemperature: true,
        maxTokensParam: 'max_tokens',
      };
  }
}

function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (Deno.env.get("OPENAI_API_KEY")) providers.push('openai');
  if (Deno.env.get("ABACUS_API_KEY")) providers.push('abacus');
  if (Deno.env.get("LOVABLE_API_KEY")) providers.push('lovable');
  return providers;
}

async function callProvider(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  stream: boolean = true
): Promise<Response> {
  const body: Record<string, any> = {
    model: config.model,
    messages,
    stream,
  };

  body[config.maxTokensParam] = 4096;

  if (config.supportsTemperature) {
    body.temperature = 0.7;
  }

  return fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, preferredProvider, testMode } = await req.json();
    
    // Enhanced logging for debugging
    const requestId = crypto.randomUUID().slice(0, 8);
    const startTime = Date.now();
    
    console.log(`[${requestId}] ========== AI CHAT REQUEST ==========`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Test Mode: ${testMode || false}`);
    console.log(`[${requestId}] Preferred Provider: ${preferredProvider || 'none'}`);
    console.log(`[${requestId}] Message Count: ${messages?.length || 0}`);
    console.log(`[${requestId}] Context: ${JSON.stringify(context || {})}`);
    
    // Build context-aware system prompt
    let contextualPrompt = SYSTEM_PROMPT;
    if (context?.currentPage) {
      contextualPrompt += `\n\n**User's Current Page:** ${context.currentPage}`;
    }
    if (context?.accountCount) {
      contextualPrompt += `\n**Accounts in System:** ${context.accountCount}`;
    }
    if (context?.highFitCount) {
      contextualPrompt += `\n**High-Fit Accounts:** ${context.highFitCount}`;
    }

    const fullMessages = [
      { role: "system", content: contextualPrompt },
      ...messages,
    ];

    // Get ordered list of providers to try
    const available = getAvailableProviders();
    console.log(`[${requestId}] Available Providers: ${available.join(', ') || 'NONE'}`);
    
    if (available.length === 0) {
      console.error(`[${requestId}] ERROR: No AI providers configured!`);
      throw new Error("No AI provider available. Please configure OPENAI_API_KEY, ABACUS_API_KEY, or LOVABLE_API_KEY.");
    }

    // Preferred order: user preference > openai > abacus > lovable
    const orderedProviders: AIProvider[] = [];
    if (preferredProvider && available.includes(preferredProvider)) {
      orderedProviders.push(preferredProvider);
    }
    for (const p of ['openai', 'abacus', 'lovable'] as AIProvider[]) {
      if (available.includes(p) && !orderedProviders.includes(p)) {
        orderedProviders.push(p);
      }
    }
    
    console.log(`[${requestId}] Provider Priority: ${orderedProviders.join(' -> ')}`);

    let lastError: string = '';
    const providerResults: ProviderResult[] = [];

    // Try each provider in order
    for (const provider of orderedProviders) {
      const config = getProviderConfig(provider);
      if (!config) {
        console.log(`[${requestId}] Skipping ${provider}: No config available`);
        continue;
      }

      const providerStartTime = Date.now();
      console.log(`[${requestId}] Attempting ${provider}...`);
      console.log(`[${requestId}]   Endpoint: ${config.endpoint}`);
      console.log(`[${requestId}]   Model: ${config.model}`);
      console.log(`[${requestId}]   API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'MISSING'}`);

      try {
        const response = await callProvider(config, fullMessages, !testMode);
        const responseTime = Date.now() - providerStartTime;

        if (response.ok) {
          console.log(`[${requestId}] ✅ SUCCESS with ${provider}`);
          console.log(`[${requestId}]   Response Time: ${responseTime}ms`);
          console.log(`[${requestId}]   Status: ${response.status}`);
          
          providerResults.push({
            provider,
            success: true,
            responseTime,
            statusCode: response.status,
          });

          // If test mode, return diagnostic info instead of streaming
          if (testMode) {
            const totalTime = Date.now() - startTime;
            const body = await response.json();
            return new Response(JSON.stringify({
              success: true,
              requestId,
              provider,
              model: config.model,
              responseTime,
              totalTime,
              availableProviders: available,
              providerResults,
              testResponse: body.choices?.[0]?.message?.content || 'No content',
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        // Handle specific error codes
        const errorText = await response.text();
        console.log(`[${requestId}] ❌ FAILED with ${provider}`);
        console.log(`[${requestId}]   Status: ${response.status}`);
        console.log(`[${requestId}]   Response Time: ${responseTime}ms`);
        console.log(`[${requestId}]   Error: ${errorText.slice(0, 200)}`);

        providerResults.push({
          provider,
          success: false,
          responseTime,
          statusCode: response.status,
          error: errorText.slice(0, 200),
        });

        if (response.status === 429) {
          lastError = `Rate limit exceeded on ${provider}`;
          console.warn(`[${requestId}] Rate limited, trying next provider...`);
          continue;
        }
        if (response.status === 402) {
          lastError = `Credits exhausted on ${provider}`;
          console.warn(`[${requestId}] Credits exhausted, trying next provider...`);
          continue;
        }

        lastError = `${provider} error (${response.status}): ${errorText.slice(0, 100)}`;
        
      } catch (error) {
        const responseTime = Date.now() - providerStartTime;
        lastError = `${provider} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[${requestId}] ❌ EXCEPTION with ${provider}: ${lastError}`);
        
        providerResults.push({
          provider,
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // All providers failed
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] ========== ALL PROVIDERS FAILED ==========`);
    console.error(`[${requestId}] Total Time: ${totalTime}ms`);
    console.error(`[${requestId}] Last Error: ${lastError}`);
    
    if (testMode) {
      return new Response(JSON.stringify({
        success: false,
        requestId,
        error: lastError || "All AI providers failed",
        totalTime,
        availableProviders: available,
        providerResults,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: lastError || "All AI providers failed" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

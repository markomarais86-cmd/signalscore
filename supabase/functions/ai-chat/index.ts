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

function getProviderConfig(provider: AIProvider): ProviderConfig | null {
  switch (provider) {
    case 'openai':
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return null;
      return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-5-2025-08-07',
        apiKey: openaiKey,
        supportsTemperature: false, // GPT-5 doesn't support temperature
        maxTokensParam: 'max_completion_tokens',
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

  // Add max tokens with correct parameter name
  body[config.maxTokensParam] = 4096;

  // Only add temperature for providers that support it
  if (config.supportsTemperature) {
    body.temperature = 0.7;
  }

  console.log(`[AI Chat] Calling ${config.model} at ${config.endpoint}`);

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
    const { messages, context, preferredProvider } = await req.json();
    
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
    if (available.length === 0) {
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

    let lastError: string = '';

    // Try each provider in order
    for (const provider of orderedProviders) {
      const config = getProviderConfig(provider);
      if (!config) continue;

      try {
        const response = await callProvider(config, fullMessages, true);

        if (response.ok) {
          console.log(`[AI Chat] Success with ${provider}`);
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        // Handle specific error codes
        if (response.status === 429) {
          lastError = `Rate limit exceeded on ${provider}`;
          console.warn(`[AI Chat] ${lastError}, trying next provider...`);
          continue;
        }
        if (response.status === 402) {
          lastError = `Credits exhausted on ${provider}`;
          console.warn(`[AI Chat] ${lastError}, trying next provider...`);
          continue;
        }

        const errorText = await response.text();
        lastError = `${provider} error (${response.status}): ${errorText}`;
        console.error(`[AI Chat] ${lastError}`);
        
      } catch (error) {
        lastError = `${provider} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[AI Chat] ${lastError}`);
      }
    }

    // All providers failed
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

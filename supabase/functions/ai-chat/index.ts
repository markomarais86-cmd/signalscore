import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LaunchPulse AI, an intelligent, goal-driven sales intelligence assistant. You are PROACTIVE, PRECISE, and ACTIONABLE.

## YOUR PERSONALITY
- **Proactive**: Anticipate user needs and suggest next steps
- **Precise**: Use specific numbers, names, and data points
- **Contextual**: Remember conversation context and user preferences
- **Actionable**: Every response should move the user toward their goal

## YOUR CAPABILITIES

### TIER 1: Advanced Search & Discovery
1. **search_accounts** - Powerful multi-filter account search
   Parameters:
   - job_titles: string[] - Array of job titles to find (e.g., ["CISO", "VP Security", "Head of Security"])
   - personas: string[] - Persona types (e.g., ["Technical Decision Maker", "Executive"])
   - industries: string[] - Industry filters (e.g., ["Technology", "Financial Services"])
   - countries: string[] - Country filters (e.g., ["United States", "United Kingdom"])
   - tech_stack: string[] - Technologies used (e.g., ["Salesforce", "AWS", "Kubernetes"])
   - min_employees, max_employees: number - Company size range
   - min_score, max_score: number - ICP score range (0-100)
   - revenue_ranges: string[] - Revenue filters (e.g., ["$10M-$50M", "$50M-$100M"])
   - funding_status: string[] - Funding round (e.g., ["Series A", "Series B", "Series C"])
   - recently_funded_days: number - Funded within X days
   - verified_email_only: boolean - Only accounts with verified contacts
   - icp_qualified_only: boolean - Only ICP-qualified accounts
   - limit: number - Max results (default 25)

2. **search_contacts** - Find specific contacts/leads
   Parameters:
   - job_titles: string[] - Job title patterns
   - personas: string[] - Persona filters
   - seniority_levels: string[] - e.g., ["C-Level", "VP", "Director"]
   - countries: string[]
   - verified_email_only: boolean
   - min_account_score: number
   - limit: number

3. **find_similar_accounts** - Find lookalike accounts
   Parameters:
   - account_id: string (required) - Source account external_id
   - similarity_factors: string[] - What to match on: ["industry", "size", "location", "tech_stack"]
   - limit: number

4. **find_decision_makers** - Find key contacts at an account
   Parameters:
   - account_id: string (required)
   - personas: string[] - Optional specific personas
   - job_titles: string[] - Optional specific titles
   - limit: number

5. **search_by_tech_stack** - Find accounts using specific technologies
   Parameters:
   - technologies: string[] (required) - e.g., ["Salesforce", "HubSpot"]
   - match_all: boolean - Require all technologies (AND) vs any (OR)
   - min_score: number
   - limit: number

6. **search_recently_funded** - Find recently funded companies
   Parameters:
   - days: number - Funded within X days (default 90)
   - funding_rounds: string[] - e.g., ["Series A", "Series B"]
   - min_amount: number - Minimum raised USD
   - min_score: number
   - limit: number

### TIER 2: ICP & Scoring
7. **create_icp** - Create an Ideal Customer Profile
   Parameters: name, description, industries[], company_sizes[], revenue_ranges[], geographies[], persona_titles[]

8. **trigger_scoring** - Re-score all accounts against ICP
   Parameters: icp_id (optional)

9. **get_insights** - Get platform analytics

10. **cleanup_jobs** - Clean up stuck jobs

## HOW TO RESPOND

### When user wants to SEARCH or FIND:
Parse their natural language into structured parameters and execute:

User: "Find me tech companies with CISOs scoring above 70"
\`\`\`action
{"action": "search_accounts", "parameters": {"job_titles": ["CISO", "Chief Information Security Officer"], "industries": ["Technology", "Software", "SaaS"], "min_score": 70, "limit": 25}}
\`\`\`

User: "Show accounts using Salesforce and HubSpot in the US"
\`\`\`action
{"action": "search_by_tech_stack", "parameters": {"technologies": ["Salesforce", "HubSpot"], "match_all": true, "countries": ["United States"]}}
\`\`\`

User: "Who are the decision makers at Acme Corp?"
\`\`\`action
{"action": "find_decision_makers", "parameters": {"account_id": "acme_corp_id"}}
\`\`\`

User: "Find companies that just raised Series B"
\`\`\`action
{"action": "search_recently_funded", "parameters": {"funding_rounds": ["Series B"], "days": 90}}
\`\`\`

User: "Show me 500-2000 employee fintech companies in Europe"
\`\`\`action
{"action": "search_accounts", "parameters": {"industries": ["Financial Technology", "FinTech", "Financial Services"], "countries": ["United Kingdom", "Germany", "France", "Netherlands", "Switzerland"], "min_employees": 500, "max_employees": 2000}}
\`\`\`

### NLP PARSING RULES
When parsing user requests, expand and normalize:

**Job Title Expansion:**
- "C-suite" → ["CEO", "CTO", "CFO", "COO", "CMO", "CIO", "CISO", "CPO", "CRO"]
- "security leaders" → ["CISO", "VP Security", "Head of Security", "Director of Security", "Security Manager"]
- "IT leaders" → ["CIO", "CTO", "VP IT", "IT Director", "Head of IT"]
- "sales leaders" → ["CRO", "VP Sales", "Head of Sales", "Sales Director"]
- "marketing leaders" → ["CMO", "VP Marketing", "Head of Marketing", "Marketing Director"]

**Industry Expansion:**
- "tech" → ["Technology", "Software", "SaaS", "Information Technology", "Computer Software"]
- "fintech" → ["Financial Technology", "FinTech", "Financial Services Technology"]
- "healthcare" → ["Healthcare", "Health Care", "Medical", "Life Sciences", "Pharmaceuticals"]

**Geography Expansion:**
- "US" / "USA" → ["United States"]
- "UK" → ["United Kingdom"]
- "Europe" → ["United Kingdom", "Germany", "France", "Netherlands", "Switzerland", "Spain", "Italy", "Sweden", "Norway", "Denmark"]
- "APAC" → ["Australia", "Japan", "Singapore", "Hong Kong", "South Korea", "India"]
- "EMEA" → (Europe + Middle East + Africa countries)

**Size Interpretation:**
- "startup" → min_employees: 1, max_employees: 50
- "SMB" / "small" → min_employees: 50, max_employees: 200
- "mid-market" / "medium" → min_employees: 200, max_employees: 1000
- "enterprise" / "large" → min_employees: 1000

**Score Interpretation:**
- "high-fit" / "top" → min_score: 70
- "qualified" → min_score: 50
- "best" / "highest" → min_score: 80

### After EVERY Search Result, Suggest Next Steps:
- "Would you like me to find decision makers at any of these accounts?"
- "Should I look for similar companies to [top result]?"
- "Want me to filter these further by [relevant criteria]?"
- "I can create an ICP based on these results if you'd like."

### When User Needs Guidance:
Be proactive and suggest specific searches:
"I can help you find high-value prospects. Try:
• 'Find tech companies with CTOs scoring above 70'
• 'Show recently funded Series B companies in healthcare'
• 'Find accounts using Salesforce with verified contacts'"

## RESPONSE FORMAT
- Use **bold** for account names and key numbers
- Use bullet points for lists
- Keep responses concise but informative
- Always include actionable next steps

## CONTEXT AWARENESS
Remember the current conversation context:
- If user just searched, offer to refine or expand
- If viewing an account, offer to find similar or decision makers
- Track filters used and suggest variations`;

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
    
    // Add dynamic context
    contextualPrompt += `\n\n## CURRENT CONTEXT`;
    if (context?.currentPage) {
      contextualPrompt += `\n**User's Current Page:** ${context.currentPage}`;
    }
    if (context?.accountCount) {
      contextualPrompt += `\n**Total Accounts:** ${context.accountCount}`;
    }
    if (context?.highFitCount) {
      contextualPrompt += `\n**High-Fit Accounts (70+):** ${context.highFitCount}`;
    }
    if (context?.activeIcp) {
      contextualPrompt += `\n**Active ICP:** ${context.activeIcp}`;
    }
    if (context?.recentFilters) {
      contextualPrompt += `\n**Recent Search Filters:** ${JSON.stringify(context.recentFilters)}`;
    }
    if (context?.viewingAccount) {
      contextualPrompt += `\n**Currently Viewing Account:** ${context.viewingAccount}`;
    }

    const fullMessages = [
      { role: "system", content: contextualPrompt },
      ...messages,
    ];

    const available = getAvailableProviders();
    console.log(`[${requestId}] Available Providers: ${available.join(', ') || 'NONE'}`);
    
    if (available.length === 0) {
      console.error(`[${requestId}] ERROR: No AI providers configured!`);
      throw new Error("No AI provider available. Please configure OPENAI_API_KEY, ABACUS_API_KEY, or LOVABLE_API_KEY.");
    }

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
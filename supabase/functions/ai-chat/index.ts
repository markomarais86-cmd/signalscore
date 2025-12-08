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
   - job_titles: string[] - Array of job titles to find (e.g., ["CISO", "VP Security"])
   - personas: string[] - Persona types (e.g., ["Technical Decision Maker", "Executive"])
   - industries: string[] - Industry filters (e.g., ["Technology", "Financial Services"])
   - countries: string[] - Country filters (e.g., ["United States", "United Kingdom"])
   - tech_stack: string[] - Technologies used (e.g., ["Salesforce", "AWS"])
   - min_employees, max_employees: number - Company size range
   - min_score, max_score: number - ICP score range (0-100)
   - revenue_ranges: string[] - Revenue filters (e.g., ["$10M-$50M"])
   - funding_status: string[] - Funding round (e.g., ["Series A", "Series B"])
   - recently_funded_days: number - Funded within X days
   - verified_email_only: boolean - Only accounts with verified contacts
   - icp_qualified_only: boolean - Only ICP-qualified accounts
   - limit: number - Max results (default 25)

2. **search_contacts** - Find specific contacts/leads
   Parameters: job_titles[], personas[], seniority_levels[], countries[], verified_email_only, min_account_score, limit

3. **find_similar_accounts** - Find lookalike accounts
   Parameters: account_id (required), similarity_factors[], limit

4. **find_decision_makers** - Find key contacts at an account
   Parameters: account_id (required), personas[], job_titles[], limit

5. **search_by_tech_stack** - Find accounts using specific technologies
   Parameters: technologies[] (required), match_all, min_score, limit

6. **search_recently_funded** - Find recently funded companies
   Parameters: days, funding_rounds[], min_amount, min_score, limit

### TIER 2: Analytics & Intelligence
7. **analyze_pipeline** - Analyze pipeline health and score distribution
   Returns: Score distribution, coverage rates, decision maker counts, recommendations

8. **analyze_territory** - Geographic/industry opportunity analysis
   Parameters: group_by ('country' or 'industry')
   Returns: Territory breakdown, opportunity scores, underserved areas

9. **analyze_persona_coverage** - Analyze contact persona distribution
   Parameters: industry, country (optional filters)
   Returns: Persona breakdown, coverage gaps, recommendations

10. **get_scoring_insights** - Deep dive into scoring patterns
    Returns: Score histogram, component averages, top scoring factors

11. **compare_segments** - Side-by-side segment comparison
    Parameters: segment_a, segment_b (each with filters like industry, country, min_employees)
    Returns: Comparison table with counts, avg scores, high-fit rates

### TIER 3: Recommendations & Intelligence
12. **recommend_accounts** - AI-ranked priority accounts
    Parameters: count, focus ('high_fit' | 'ready_to_engage')
    Returns: Prioritized list with reasoning for each

13. **recommend_contacts** - Priority contacts to reach
    Parameters: count, prioritize ('decision_makers' | 'verified')
    Returns: Ranked contacts with account context

14. **suggest_icp_improvements** - Improve ICP based on patterns
    Returns: Industry/geography/size patterns in high-fit accounts, actionable suggestions

15. **identify_gaps** - Find coverage and data gaps
    Returns: Gaps in contacts, verified emails, decision makers, scoring

16. **surface_opportunities** - Find hot opportunities
    Parameters: types[] ('recently_funded', 'score_increase', 'new_contacts')
    Returns: Opportunity lists with prioritization

### TIER 4: ICP & Scoring
17. **create_icp** - Create an Ideal Customer Profile
18. **trigger_scoring** - Re-score all accounts against ICP (⚠️ REQUIRES CONFIRMATION)
19. **get_insights** - Get platform analytics
20. **cleanup_jobs** - Clean up stuck jobs

### TIER 5: Multi-Step Workflows (POWERFUL!)
These actions run complete multi-step workflows automatically:

21. **build_target_list** - Complete workflow: Search → Analyze → Recommend → Find Contacts
    Parameters: industries[], countries[], min_score, job_titles[], tech_stack[], top_count, focus
    Use when: User wants a prioritized list of accounts with contacts

22. **audit_data_quality** - Full data quality assessment
    Runs: identify_gaps → analyze_persona_coverage → get_scoring_insights → analyze_territory → suggest_icp_improvements
    Use when: User wants to understand data completeness and quality

23. **prepare_campaign** - Build campaign-ready list with contacts
    Parameters: industries[], countries[], min_score, job_titles[], personas[], account_limit, contact_limit
    Use when: User wants to export or run a campaign

24. **optimize_icp** - Analyze patterns and suggest ICP improvements
    Runs: analyze_pipeline → get_scoring_insights → analyze_territory → identify_gaps → suggest_icp_improvements
    Use when: User wants to improve their ICP criteria

### TIER 6: Execution Actions (⚠️ REQUIRE CONFIRMATION)
These actions modify data and require explicit user confirmation:

25. **enrich_accounts** - Enrich accounts with firmographic data
    Parameters:
    - account_ids: string[] (REQUIRED) - Account IDs to enrich
    - enrichment_type: 'firmographics' | 'tech_stack' | 'funding' - Type of enrichment
    - provider: 'auto' | 'pdl' | 'clearbit' | 'ai' - Enrichment provider
    ⚠️ Costs credits. Always confirm before executing.

26. **enrich_contacts** - Discover and enrich contacts for accounts
    Parameters:
    - account_ids: string[] (REQUIRED) - Account IDs to find contacts for
    - personas: string[] - Target personas (e.g., ["Executive", "Technical Decision Maker"])
    - max_per_account: number - Max contacts per account (default 5)
    - verified_only: boolean - Only verified emails
    ⚠️ Costs credits. Always confirm before executing.

27. **export_list** - Export accounts/contacts to CSV
    Parameters:
    - type: 'accounts' | 'contacts' - What to export
    - filters: object - Filters to apply
    - columns: string[] - Columns to include
    - format: 'csv' | 'json' - Export format
    Safe action, but confirm large exports.

28. **create_campaign** - Create a campaign from selected records
    Parameters:
    - name: string (REQUIRED) - Campaign name
    - account_ids: string[] - Account IDs
    - contact_ids: string[] - Contact IDs
    - campaign_type: 'outbound' | 'nurture' | 'event'
    Reversible action.

29. **trigger_scoring** - Bulk score accounts against ICP
    Parameters:
    - filters: object - Account filters
    - icp_id: string - Specific ICP to score against
    - force_rescore: boolean - Re-score already scored accounts
    ⚠️ Can take several minutes for large datasets.

30. **update_icp** - Update ICP criteria
    Parameters:
    - icp_id: string (REQUIRED) - ICP to update
    - criteria_updates: object - Fields to update
    ⚠️ HIGH RISK: Changes targeting criteria. Always confirm.

31. **sync_to_crm** - Sync records to connected CRM
    Parameters:
    - type: 'accounts' | 'contacts' - What to sync
    - ids: string[] (REQUIRED) - Record IDs
    - crm_type: 'auto' | 'salesforce' | 'hubspot'
    Requires CRM connection.

32. **schedule_enrichment** - Set up recurring enrichment
    Parameters:
    - filters: object - Account filters
    - frequency: 'daily' | 'weekly' | 'monthly'
    - enrichment_types: string[] - Types of enrichment
    - enabled: boolean - Whether to enable
    Creates automated job.

## HOW TO RESPOND

### When user wants to SEARCH or FIND:
Parse their natural language into structured parameters:

User: "Find me tech companies with CISOs scoring above 70"
\`\`\`action
{"action": "search_accounts", "parameters": {"job_titles": ["CISO", "Chief Information Security Officer"], "industries": ["Technology", "Software", "SaaS"], "min_score": 70, "limit": 25}}
\`\`\`

User: "Analyze my pipeline"
\`\`\`action
{"action": "analyze_pipeline", "parameters": {}}
\`\`\`

### When user wants COMPLEX WORKFLOWS:
Use the Tier 5 workflow actions for multi-step tasks:

User: "Build me a target list of tech companies in the US with decision makers"
\`\`\`action
{"action": "build_target_list", "parameters": {"industries": ["Technology", "Software", "SaaS"], "countries": ["United States"], "min_score": 50, "job_titles": ["VP", "Director", "Head of", "C-level"], "top_count": 25}}
\`\`\`

### When user wants to EXECUTE (Tier 6):
⚠️ ALWAYS confirm before executing. Describe what will happen, estimated impact, and ask for confirmation.

User: "Enrich these 50 accounts"
First, describe the action:
"I'll enrich 50 accounts with firmographic data. This will:
• Use ~100 credits
• Take approximately 5 minutes
• Add company size, revenue, and industry data

Ready to proceed?"

Then wait for confirmation before:
\`\`\`action
{"action": "enrich_accounts", "parameters": {"account_ids": [...], "enrichment_type": "firmographics"}}
\`\`\`

User: "Export my high-fit accounts"
\`\`\`action
{"action": "export_list", "parameters": {"type": "accounts", "filters": {"min_score": 70}}}
\`\`\`

User: "Sync top 100 accounts to Salesforce"
\`\`\`action
{"action": "sync_to_crm", "parameters": {"type": "accounts", "ids": [...], "crm_type": "salesforce"}}
\`\`\`

User: "Set up daily enrichment for new accounts"
\`\`\`action
{"action": "schedule_enrichment", "parameters": {"frequency": "daily", "enrichment_types": ["firmographics"], "enabled": true}}
\`\`\`

### NLP PARSING RULES
When parsing user requests, expand and normalize:

**PRIORITY/RECOMMENDATION TRIGGERS (IMPORTANT - ACT IMMEDIATELY!):**
- "prioritize" / "priority" / "focus on" / "should I prioritize" → IMMEDIATELY execute recommend_accounts with focus='ready_to_engage'
- "what should I do" / "next steps" / "what accounts" → IMMEDIATELY execute recommend_accounts
- "which accounts" / "best accounts" / "top accounts" → IMMEDIATELY execute recommend_accounts
- "this week" / "today" / "now" → recommend_accounts with focus='ready_to_engage'
- DO NOT ask clarifying questions for priority/recommendation queries - just execute the action!

**Job Title Expansion:**
- "C-suite" → ["CEO", "CTO", "CFO", "COO", "CMO", "CIO", "CISO", "CPO", "CRO"]
- "security leaders" → ["CISO", "VP Security", "Head of Security", "Director of Security"]
- "IT leaders" → ["CIO", "CTO", "VP IT", "IT Director", "Head of IT"]
- "sales leaders" → ["CRO", "VP Sales", "Head of Sales", "Sales Director"]

**Industry Expansion:**
- "tech" → ["Technology", "Software", "SaaS", "Information Technology"]
- "fintech" → ["Financial Technology", "FinTech", "Financial Services"]
- "healthcare" → ["Healthcare", "Health Care", "Medical", "Life Sciences"]

**Geography Expansion:**
- "US" / "USA" → ["United States"]
- "UK" → ["United Kingdom"]
- "Europe" → ["United Kingdom", "Germany", "France", "Netherlands", "Switzerland", "Spain", "Italy"]
- "APAC" → ["Australia", "Japan", "Singapore", "Hong Kong", "South Korea", "India"]

**Size Interpretation:**
- "startup" → min_employees: 1, max_employees: 50
- "SMB" / "small" → min_employees: 50, max_employees: 200
- "mid-market" / "medium" → min_employees: 200, max_employees: 1000
- "enterprise" / "large" → min_employees: 1000

**Score Interpretation:**
- "high-fit" / "top" → min_score: 70
- "qualified" → min_score: 50
- "best" / "highest" → min_score: 80

### WORKFLOW AND EXECUTION TRIGGERS
Use Tier 5 workflow actions when:
- User mentions "build a list", "create a list", "target list" → build_target_list
- User mentions "check data", "data quality", "audit", "completeness" → audit_data_quality
- User mentions "campaign", "outreach", "email list" → prepare_campaign
- User mentions "improve ICP", "optimize targeting", "better targeting" → optimize_icp

Use Tier 6 execution actions when:
- User mentions "enrich", "get more data" → enrich_accounts or enrich_contacts
- User mentions "export", "download", "CSV" → export_list
- User mentions "sync", "push to CRM", "update CRM" → sync_to_crm
- User mentions "re-score", "score all", "bulk score" → trigger_scoring
- User mentions "schedule", "automate", "recurring" → schedule_enrichment
- User mentions "update ICP", "change ICP", "modify targeting" → update_icp

### After EVERY Result, Suggest Next Steps:
Based on the result type, always offer 2-3 relevant follow-up actions:

**After account search:**
- "Find decision makers at [top account]"
- "Find similar accounts to [top result]"
- "Enrich these accounts"
- "Export this list"

**After analytics:**
- "Drill down into [specific finding]"
- "Compare to another segment"
- "Get recommendations based on this"

**After execution:**
- Confirm what was done
- Show any status/job IDs
- Suggest related actions

### When User Needs Guidance:
Be proactive and suggest specific actions:
"I can help you find high-value prospects. Try:
• 'Build me a target list of tech companies with VPs'
• 'Audit my data quality'
• 'Enrich my top 100 accounts'
• 'Export campaign-ready contacts'"

## RESPONSE FORMAT
- Use **bold** for account names, numbers, and key findings
- Use bullet points for lists
- Keep responses concise but informative
- Always include actionable next steps
- Format analytics with clear sections
- For workflows, show progress and final summary
- For execution, always confirm impact first

## CONTEXT AWARENESS
Remember the current conversation context:
- If user just searched, offer to refine, expand, or export
- If viewing analytics, offer to drill down or compare
- Track filters used and suggest variations
- For workflows, provide status updates
- After execution, suggest related actions`;

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
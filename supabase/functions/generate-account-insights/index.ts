import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, getAvailableProviders } from "../_shared/ai-config.ts";
import { applyRateLimit } from "../_shared/rate-limit.ts";
import { isCircuitOpen, recordSuccess, recordFailure } from "../_shared/circuit-breaker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountInsight {
  insight_type: string;
  content: Record<string, any>;
  confidence: number;
}

// Tool definition for structured output
const insightsTool = {
  type: "function",
  function: {
    name: "generate_account_insights",
    description: "Generate structured insights for a B2B account based on provided data",
    parameters: {
      type: "object",
      properties: {
        engagement: {
          type: "object",
          properties: {
            bestTime: { type: "string", description: "Specific day/time recommendation with reasoning" },
            bestChannel: { type: "string", description: "Channel recommendation (email/phone/linkedin) with reasoning" },
            keyMessaging: {
              type: "array",
              items: { type: "string" },
              description: "3-4 specific messaging angles based on account data"
            },
            urgencySignals: {
              type: "array",
              items: { type: "string" },
              description: "Time-sensitive opportunities to act on"
            }
          },
          required: ["bestTime", "bestChannel", "keyMessaging", "urgencySignals"]
        },
        buyingSignals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signal: { type: "string" },
              strength: { type: "string", enum: ["high", "medium", "low"] },
              action: { type: "string" }
            },
            required: ["signal", "strength", "action"]
          }
        },
        similarAccounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              similarity: { type: "number" },
              outcome: { type: "string" },
              dealSize: { type: "string" },
              insight: { type: "string" }
            },
            required: ["name", "similarity", "outcome", "dealSize", "insight"]
          }
        },
        recommendedActions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "number" },
              action: { type: "string" },
              persona: { type: "string" },
              reason: { type: "string" }
            },
            required: ["priority", "action", "persona", "reason"]
          }
        },
        confidence: { type: "number", description: "Confidence score between 0 and 1" }
      },
      required: ["engagement", "buyingSignals", "similarAccounts", "recommendedActions", "confidence"]
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountExternalId, forceRefresh = false } = await req.json();
    
    if (!accountExternalId) {
      return new Response(
        JSON.stringify({ error: 'accountExternalId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.org_id;
    console.log(`[generate-account-insights] Generating for account ${accountExternalId}, org ${orgId}`);

    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(supabase, orgId, 'generate-account-insights');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check for cached insights if not forcing refresh
    if (!forceRefresh) {
      const { data: cachedInsights } = await supabase
        .from('account_insights')
        .select('*')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .gt('expires_at', new Date().toISOString());

      if (cachedInsights && cachedInsights.length > 0) {
        console.log(`[generate-account-insights] Returning ${cachedInsights.length} cached insights`);
        const formattedInsights = formatInsightsResponse(cachedInsights);
        return new Response(
          JSON.stringify({ insights: formattedInsights, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch account data
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .eq('external_id', accountExternalId)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch account score
    const { data: score } = await supabase
      .from('scores')
      .select('*')
      .eq('org_id', orgId)
      .eq('account_external_id', accountExternalId)
      .single();

    // Fetch associated leads
    const { data: leads } = await supabase
      .from('Leads')
      .select('first_name, last_name, title, persona, email, status')
      .eq('org_id', orgId)
      .eq('account_external_id', accountExternalId)
      .limit(20);

    // Fetch similar closed-won accounts
    const { data: closedWon } = await supabase
      .from('closed_won_deals')
      .select(`
        account_external_id,
        deal_value,
        close_date,
        sales_cycle_days
      `)
      .eq('org_id', orgId)
      .limit(10);

    // Get account details for closed-won
    let similarAccounts: any[] = [];
    if (closedWon && closedWon.length > 0) {
      const closedWonIds = closedWon.map(d => d.account_external_id);
      const { data: closedWonAccounts } = await supabase
        .from('accounts')
        .select('external_id, name, industry_norm, employee_count, revenue_range')
        .eq('org_id', orgId)
        .in('external_id', closedWonIds);

      if (closedWonAccounts) {
        similarAccounts = closedWonAccounts
          .filter(a => a.industry_norm === account.industry_norm || 
                      (account.employee_count && a.employee_count && 
                       Math.abs((a.employee_count - account.employee_count) / account.employee_count) < 0.5))
          .slice(0, 3)
          .map(a => {
            const deal = closedWon.find(d => d.account_external_id === a.external_id);
            return {
              name: a.name,
              industry: a.industry_norm,
              dealValue: deal?.deal_value,
              salesCycleDays: deal?.sales_cycle_days
            };
          });
      }
    }

    // Get active ICP profile
    const { data: icpProfile } = await supabase
      .from('icp_profiles')
      .select('name, industries, persona_job_titles, persona_seniority_levels')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    // Generate AI insights with circuit breaker
    const insights = await generateAIInsights(
      account, 
      score, 
      leads || [], 
      similarAccounts,
      icpProfile
    );

    // Cache insights
    const insightsToStore: AccountInsight[] = [
      { insight_type: 'engagement', content: insights.engagement, confidence: insights.confidence },
      { insight_type: 'buying_signals', content: { signals: insights.buyingSignals }, confidence: insights.confidence },
      { insight_type: 'similar_accounts', content: { accounts: insights.similarAccounts }, confidence: insights.confidence },
      { insight_type: 'recommended_actions', content: { actions: insights.recommendedActions }, confidence: insights.confidence }
    ];

    for (const insight of insightsToStore) {
      await supabase
        .from('account_insights')
        .upsert({
          org_id: orgId,
          account_external_id: accountExternalId,
          insight_type: insight.insight_type,
          content: insight.content,
          confidence: insight.confidence,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'org_id,account_external_id,insight_type'
        });
    }

    console.log(`[generate-account-insights] Generated and cached insights for ${accountExternalId}`);

    return new Response(
      JSON.stringify({ insights, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-account-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatInsightsResponse(cachedInsights: any[]) {
  const result: any = {
    engagement: {},
    buyingSignals: [],
    similarAccounts: [],
    recommendedActions: [],
    confidence: 0
  };

  for (const insight of cachedInsights) {
    switch (insight.insight_type) {
      case 'engagement':
        result.engagement = insight.content;
        result.confidence = insight.confidence;
        break;
      case 'buying_signals':
        result.buyingSignals = insight.content?.signals || [];
        break;
      case 'similar_accounts':
        result.similarAccounts = insight.content?.accounts || [];
        break;
      case 'recommended_actions':
        result.recommendedActions = insight.content?.actions || [];
        break;
    }
  }

  return result;
}

async function generateAIInsights(
  account: any, 
  score: any | null, 
  leads: any[], 
  similarAccounts: any[],
  icpProfile: any | null
) {
  const providers = getAvailableProviders();
  
  // Check if AI is available and circuit is not open
  if (providers.length > 0) {
    // Check circuit breaker for AI service (use 'lovable' as primary)
    const serviceName = providers.includes('lovable') ? 'lovable' : providers[0];
    const circuitOpen = await isCircuitOpen(serviceName);
    
    if (!circuitOpen) {
      try {
        const startTime = Date.now();
        const result = await callAIForInsights(account, score, leads, similarAccounts, icpProfile);
        
        // Record success
        await recordSuccess(serviceName, Date.now() - startTime);
        console.log(`[generate-account-insights] AI insights generated successfully via ${serviceName}`);
        
        return result;
      } catch (error) {
        console.error('[generate-account-insights] AI call failed, using fallback:', error);
        
        // Record failure
        await recordFailure(serviceName, error.message);
      }
    } else {
      console.log(`[generate-account-insights] Circuit open for ${serviceName}, using fallback`);
    }
  }

  // Fallback to rule-based insights
  console.log('[generate-account-insights] Using rule-based fallback');
  return generateRuleBasedInsights(account, score, leads, similarAccounts, icpProfile);
}

async function callAIForInsights(
  account: any,
  score: any | null,
  leads: any[],
  similarAccounts: any[],
  icpProfile: any | null
) {
  const prompt = buildInsightPrompt(account, score, leads, similarAccounts, icpProfile);
  
  // Use tool calling for structured output
  const response = await callAI(
    'analysis',
    [
      {
        role: 'system',
        content: 'You are a B2B sales intelligence analyst. Generate actionable insights for account-based marketing. Use the provided tool to return structured insights.'
      },
      { role: 'user', content: prompt }
    ],
    {
      tools: [insightsTool],
      tool_choice: { type: 'function', function: { name: 'generate_account_insights' } },
      maxTokens: 2000,
      preferredProvider: 'lovable' // Prefer Lovable AI Gateway
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Extract tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      return {
        engagement: parsed.engagement || {},
        buyingSignals: parsed.buyingSignals || [],
        similarAccounts: parsed.similarAccounts?.length > 0 ? parsed.similarAccounts : formatSimilarAccounts(similarAccounts),
        recommendedActions: parsed.recommendedActions || [],
        confidence: parsed.confidence || 0.85
      };
    } catch (e) {
      console.error('[generate-account-insights] Failed to parse tool call arguments:', e);
      throw e;
    }
  }
  
  // Fallback: try to get content from message (for providers that don't support tool calling)
  const content = data.choices?.[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      return {
        engagement: parsed.engagement || {},
        buyingSignals: parsed.buyingSignals || [],
        similarAccounts: parsed.similarAccounts?.length > 0 ? parsed.similarAccounts : formatSimilarAccounts(similarAccounts),
        recommendedActions: parsed.recommendedActions || [],
        confidence: parsed.confidence || 0.75
      };
    } catch (e) {
      console.error('[generate-account-insights] Failed to parse content:', e);
      throw e;
    }
  }
  
  throw new Error('No valid response from AI');
}

function formatSimilarAccounts(similarAccounts: any[]) {
  return similarAccounts.map(a => ({
    name: a.name,
    similarity: 0.8,
    outcome: 'closed_won',
    dealSize: a.dealValue ? `$${(a.dealValue / 1000).toFixed(0)}K` : 'N/A',
    insight: `Similar industry company, ${a.salesCycleDays || 60} day sales cycle`
  }));
}

function buildInsightPrompt(
  account: any,
  score: any | null,
  leads: any[],
  similarAccounts: any[],
  icpProfile: any | null
): string {
  const leadSummary = leads.length > 0 
    ? leads.slice(0, 5).map(l => `${l.title || 'Unknown'} (${l.persona || 'Unknown persona'})`).join(', ')
    : 'No leads found';

  const similarSummary = similarAccounts.length > 0
    ? similarAccounts.map(a => `${a.name} ($${(a.dealValue || 0).toLocaleString()})`).join(', ')
    : 'No similar closed-won accounts';

  return `Analyze this B2B account and generate personalized engagement insights.

ACCOUNT DATA:
- Company: ${account.name || 'Unknown'}
- Industry: ${account.industry_norm || account.industry_raw || 'Unknown'}
- Size: ${account.employee_count || 'Unknown'} employees
- Revenue: ${account.revenue_range || 'Unknown'}
- Location: ${account.country || 'Unknown'}
- Domain: ${account.domain || 'Unknown'}

SCORING (if available):
- Overall Score: ${score?.overall || 'Not scored'}
- Fit Score: ${score?.fit || 'N/A'}
- Intent Score: ${score?.intent || 'N/A'}
- Reachability: ${score?.reachability || 'N/A'}

KNOWN CONTACTS: ${leadSummary}

SIMILAR CLOSED-WON: ${similarSummary}

ICP PROFILE: ${icpProfile?.name || 'Default'} targeting ${icpProfile?.persona_job_titles?.slice(0, 3).join(', ') || 'decision makers'}

Generate actionable, specific insights for engaging this account. Focus on:
1. Best timing and channels for outreach
2. Key messaging angles based on industry and company size
3. Observable buying signals
4. Priority actions for the sales team

Be direct and avoid generic advice.`;
}

function generateRuleBasedInsights(
  account: any,
  score: any | null,
  leads: any[],
  similarAccounts: any[],
  icpProfile: any | null
) {
  // Determine best engagement time based on location
  const timezone = getTimezoneHint(account.country);
  const bestTime = `Tuesday-Thursday, 10am-2pm ${timezone}`;
  
  // Determine channel based on industry and score
  let bestChannel = 'Email + LinkedIn';
  if (account.industry_norm?.toLowerCase().includes('tech')) {
    bestChannel = 'LinkedIn InMail, followed by email';
  } else if (score?.overall && score.overall > 80) {
    bestChannel = 'Direct phone + Email sequence';
  }

  // Generate messaging based on industry and size
  const keyMessaging = generateKeyMessaging(account, leads);
  
  // Identify buying signals
  const buyingSignals = generateBuyingSignals(account, score, leads);
  
  // Format similar accounts
  const formattedSimilar = formatSimilarAccounts(similarAccounts);

  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(account, leads, icpProfile);

  return {
    engagement: {
      bestTime,
      bestChannel,
      keyMessaging,
      urgencySignals: generateUrgencySignals(account, score)
    },
    buyingSignals,
    similarAccounts: formattedSimilar,
    recommendedActions,
    confidence: 0.7
  };
}

function getTimezoneHint(country: string | null): string {
  if (!country) return '(local time)';
  const lower = country.toLowerCase();
  if (lower.includes('united states') || lower === 'usa' || lower === 'us') return '(EST/PST)';
  if (lower.includes('united kingdom') || lower === 'uk' || lower === 'gb') return '(GMT)';
  if (lower.includes('germany') || lower.includes('france')) return '(CET)';
  if (lower.includes('japan')) return '(JST)';
  if (lower.includes('australia')) return '(AEST)';
  return `(${country} time)`;
}

function generateKeyMessaging(account: any, leads: any[]): string[] {
  const messages: string[] = [];
  
  if (account.industry_norm) {
    messages.push(`${account.industry_norm}-specific ROI and efficiency gains`);
  }
  
  if (account.employee_count) {
    if (account.employee_count > 500) {
      messages.push('Enterprise-grade scalability and security');
    } else if (account.employee_count > 100) {
      messages.push('Growth-stage flexibility with enterprise features');
    } else {
      messages.push('Quick time-to-value and ease of implementation');
    }
  }

  // Persona-specific messaging
  const personas = new Set(leads.map(l => l.persona).filter(Boolean));
  if (personas.has('Technical Decision Maker')) {
    messages.push('Technical depth: integrations, APIs, and architecture');
  }
  if (personas.has('Economic Buyer')) {
    messages.push('TCO analysis and ROI projections');
  }
  
  if (messages.length === 0) {
    messages.push('Pain point discovery and value proposition alignment');
  }

  return messages.slice(0, 4);
}

function generateBuyingSignals(account: any, score: any | null, leads: any[]): any[] {
  const signals: any[] = [];

  if (score?.overall && score.overall >= 80) {
    signals.push({
      signal: `High ICP fit score (${score.overall})`,
      strength: 'high',
      action: 'Prioritize for immediate outreach'
    });
  }

  if (leads.length >= 3) {
    signals.push({
      signal: `${leads.length} contacts identified`,
      strength: 'medium',
      action: 'Multi-threaded engagement opportunity'
    });
  }

  if (account.employee_count && account.employee_count > 200) {
    signals.push({
      signal: 'Mid-market/Enterprise company size',
      strength: 'medium',
      action: 'Higher deal potential - assign senior AE'
    });
  }

  if (account.tech_stack && account.tech_stack.length > 0) {
    signals.push({
      signal: 'Tech stack data available',
      strength: 'medium',
      action: 'Leverage integration/compatibility messaging'
    });
  }

  return signals.slice(0, 4);
}

function generateUrgencySignals(account: any, score: any | null): string[] {
  const urgency: string[] = [];
  
  if (score?.intent && score.intent > 70) {
    urgency.push('High intent score - may be actively evaluating solutions');
  }
  
  // Q4 budget planning
  const month = new Date().getMonth();
  if (month >= 9 && month <= 11) {
    urgency.push('Q4 budget planning season - ideal time for outreach');
  } else if (month >= 0 && month <= 2) {
    urgency.push('New fiscal year budgets may be available');
  }

  return urgency;
}

function generateRecommendedActions(account: any, leads: any[], icpProfile: any | null): any[] {
  const actions: any[] = [];
  let priority = 1;

  // Find decision makers in leads
  const decisionMakers = leads.filter(l => 
    l.persona?.toLowerCase().includes('decision') ||
    l.title?.toLowerCase().includes('vp') ||
    l.title?.toLowerCase().includes('director') ||
    l.title?.toLowerCase().includes('chief')
  );

  if (decisionMakers.length > 0) {
    const dm = decisionMakers[0];
    actions.push({
      priority: priority++,
      action: `Reach out to ${dm.first_name || ''} ${dm.last_name || ''} (${dm.title || 'Decision Maker'})`.trim(),
      persona: dm.persona || 'Decision Maker',
      reason: 'Key stakeholder with authority to make purchasing decisions'
    });
  }

  if (leads.length > 1) {
    actions.push({
      priority: priority++,
      action: 'Launch multi-threaded outreach sequence',
      persona: 'Multiple stakeholders',
      reason: `${leads.length} contacts available for parallel engagement`
    });
  }

  if (account.industry_norm) {
    actions.push({
      priority: priority++,
      action: `Send ${account.industry_norm}-specific case study`,
      persona: 'All contacts',
      reason: 'Industry relevance increases engagement by 40%'
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: 1,
      action: 'Research account and identify key stakeholders',
      persona: icpProfile?.persona_job_titles?.[0] || 'Decision Maker',
      reason: 'Build contact list before outreach'
    });
  }

  return actions.slice(0, 4);
}

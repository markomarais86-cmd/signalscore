import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { validateAuth, unauthorizedResponse, errorResponse, handleCorsOptions } from '../_shared/auth.ts'
import { validateUUID, ValidationError, validationErrorResponse } from '../_shared/validation.ts'

interface InsightsRequest {
  org_id?: string;  // Now optional - will use authenticated user's org if not provided
  icp_id?: string;
}

interface Insight {
  type: 'opportunity' | 'risk' | 'engagement' | 'coverage' | 'revenue' | 'persona' | 'firmographic' | 'signal';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  category?: 'action_required' | 'opportunity' | 'warning' | 'info';
  relatedSegments?: string[];
  targetAccounts?: Array<{
    account_id: string;
    account_name: string;
    score: number;
    reason: string;
  }>;
  nextAction?: 'build_campaign' | 'export_csv' | 'view_accounts' | 'enrich_data' | 'score_accounts' | 'contact_leads' | 'review_accounts';
  revenue_opportunity?: number;
}

interface LeadCoverageStats {
  totalLeads: number;
  accountsWithLeads: number;
  highFitAccountsWithLeads: number;
  highFitMissingLeads: number;
  leadCoveragePercent: string;
}

interface LeadCoverageStats {
  totalLeads: number;
  accountsWithLeads: number;
  highFitAccountsWithLeads: number;
  highFitMissingLeads: number;
  leadCoveragePercent: string;
}

// Use Lovable AI with tool calling for reliable structured output
async function callAIWithToolCalling(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1500
): Promise<Insight[]> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    console.log('[ICP Insights] No LOVABLE_API_KEY, skipping AI generation');
    return [];
  }

  const insightsTool = {
    type: "function",
    function: {
      name: "generate_insights",
      description: "Generate 8-10 actionable B2B sales insights covering: opportunities, risks, engagement gaps, coverage issues, and recommendations",
      parameters: {
        type: "object",
        properties: {
          insights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["opportunity", "risk", "engagement", "coverage", "revenue", "persona", "firmographic", "signal"],
                  description: "Category of insight: opportunity (new deals), risk (churn/loss), engagement (activity gaps), coverage (data/contact gaps), revenue (deal patterns), persona (buyer insights), firmographic (company data), signal (buying signals)"
                },
                priority: {
                  type: "string",
                  enum: ["critical", "high", "medium", "low"],
                  description: "Urgency level - critical needs immediate action"
                },
                title: {
                  type: "string",
                  description: "Short, actionable title under 50 characters"
                },
                description: {
                  type: "string",
                  description: "Detailed explanation under 100 words"
                },
                impact: {
                  type: "string",
                  description: "Expected business impact with specific numbers if possible"
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-100"
                },
                category: {
                  type: "string",
                  enum: ["action_required", "opportunity", "warning", "info"],
                  description: "Visual category for UI grouping"
                }
              },
              required: ["type", "priority", "title", "description", "impact", "confidence", "category"],
              additionalProperties: false
            },
            minItems: 6,
            maxItems: 10
          }
        },
        required: ["insights"],
        additionalProperties: false
      }
    }
  };

  try {
    console.log('[ICP Insights] Calling Lovable AI with tool calling...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [insightsTool],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ICP Insights] Lovable AI error (${response.status}): ${errorText}`);
      return [];
    }

    const data = await response.json();
    console.log('[ICP Insights] AI response received');

    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        const insights = parsed.insights || [];
        console.log(`[ICP Insights] Successfully parsed ${insights.length} insights via tool calling`);
        return insights;
      } catch (parseError) {
        console.error('[ICP Insights] Failed to parse tool arguments:', parseError);
        return [];
      }
    }

    // Fallback: try to parse from content if no tool call
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log('[ICP Insights] No tool call, trying content fallback...');
      try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : parsed.insights || [];
      } catch {
        console.log('[ICP Insights] Content is not JSON, skipping');
      }
    }

    return [];
  } catch (error) {
    console.error('[ICP Insights] AI call failed:', error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      console.error('[generate-icp-insights] Auth failed:', authResult.error);
      return unauthorizedResponse(req, authResult.error);
    }

    const { user, supabaseClient } = authResult;
    console.log(`[generate-icp-insights] Authenticated user: ${user!.id}`);

    // Get user's org_id and role
    const { data: profile, error: profileError } = await supabaseClient!
      .from('user_profiles')
      .select('org_id, role')
      .eq('user_id', user!.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error('[generate-icp-insights] Failed to get user org_id:', profileError?.message);
      return errorResponse(req, 'User profile not found');
    }

    const userOrgId = profile.org_id;
    const userRole = profile.role;
    
    // Parse request body
    let requestBody: InsightsRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is ok - we'll use the user's org
    }

    // Validate org_id if provided, otherwise use user's org
    let org_id: string;
    if (requestBody.org_id) {
      try {
        org_id = validateUUID(requestBody.org_id, 'org_id');
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
      
      // Verify user has access to requested org_id (admins can access any org)
      if (org_id !== userOrgId && userRole !== 'admin') {
        console.warn(`[generate-icp-insights] User ${user!.id} attempted to access org ${org_id} but belongs to ${userOrgId}`);
        return errorResponse(req, 'Access denied to this organization', 403);
      }
    } else {
      org_id = userOrgId;
    }

    // Validate icp_id if provided
    let icp_id: string | undefined;
    if (requestBody.icp_id) {
      try {
        icp_id = validateUUID(requestBody.icp_id, 'icp_id');
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
    }

    // Create service role client for data access (RLS will be applied via queries)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(supabase, org_id, 'generate-icp-insights');
    if (rateLimitResponse) {
      console.log(`[generate-icp-insights] Rate limited for org ${org_id}`);
      return rateLimitResponse;
    }

    console.log('Generating ICP insights for org:', org_id);

    // Get dismissed recommendations to filter them out
    const { data: dismissed, error: dismissedError } = await supabase
      .from('dismissed_recommendations')
      .select('recommendation_id, recommendation_type')
      .eq('org_id', org_id);

    if (dismissedError) {
      console.warn('Failed to fetch dismissed recommendations:', dismissedError);
    }

    const dismissedIds = new Set(dismissed?.map(d => d.recommendation_id) || []);
    console.log(`Found ${dismissedIds.size} dismissed recommendations to filter out`);

    // Get accounts and scores separately (no FK relationship between them)
    const { data: rawAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('org_id', org_id);

    if (scoresError) {
      console.warn('Failed to fetch scores:', scoresError.message);
    }

    // Merge scores onto accounts by external_id
    const scoresByExternalId: Record<string, any[]> = {};
    (scores || []).forEach((s: any) => {
      if (s.account_external_id) {
        if (!scoresByExternalId[s.account_external_id]) {
          scoresByExternalId[s.account_external_id] = [];
        }
        scoresByExternalId[s.account_external_id].push(s);
      }
    });

    const accounts = (rawAccounts || [])
      .map(a => ({ ...a, scores: scoresByExternalId[a.external_id] || [] }))
      .filter(a => a.scores.length > 0);

    // Get leads (contact data)
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select('*')
      .eq('org_id', org_id);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    // Get closed won deals
    const { data: deals, error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('*')
      .eq('org_id', org_id);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    // Calculate high-fit accounts first
    const highScoreAccounts = accounts?.filter(a => a.scores?.[0]?.overall >= 70) || [];
    const avgDealValue = deals?.reduce((sum, d) => sum + Number(d.deal_value), 0) / (deals?.length || 1);

    // Calculate REAL lead coverage stats
    const accountIds = new Set(accounts?.map(a => a.external_id) || []);
    const highFitAccountIds = new Set(highScoreAccounts.map(a => a.external_id));
    const leadsWithAccounts = leads?.filter(l => l.account_external_id && accountIds.has(l.account_external_id)) || [];
    const highFitWithLeads = new Set(
      leadsWithAccounts
        .filter(l => highFitAccountIds.has(l.account_external_id))
        .map(l => l.account_external_id)
    );

    const leadCoverageStats: LeadCoverageStats = {
      totalLeads: leads?.length || 0,
      accountsWithLeads: new Set(leadsWithAccounts.map(l => l.account_external_id)).size,
      highFitAccountsWithLeads: highFitWithLeads.size,
      highFitMissingLeads: highScoreAccounts.length - highFitWithLeads.size,
      leadCoveragePercent: highScoreAccounts.length > 0 
        ? ((highFitWithLeads.size / highScoreAccounts.length) * 100).toFixed(1)
        : '0'
    };

    console.log('Lead coverage stats:', leadCoverageStats);

    // Calculate data completeness
    const accountsWithIndustry = accounts?.filter(a => a.industry_norm)?.length || 0;
    const accountsWithRevenue = accounts?.filter(a => a.revenue_range)?.length || 0;
    const accountsWithSize = accounts?.filter(a => a.employee_count)?.length || 0;
    const accountsWithGeo = accounts?.filter(a => a.country)?.length || 0;
    const totalAccounts = accounts?.length || 1;
    const dataCompleteness = ((accountsWithIndustry + accountsWithRevenue + accountsWithSize + accountsWithGeo) / (totalAccounts * 4)) * 100;

    console.log('Data completeness:', dataCompleteness.toFixed(1) + '%');

    // Analyze data distributions
    const revenueDistribution: Record<string, number> = {};
    const industryDistribution: Record<string, number> = {};
    const sizeDistribution: Record<string, number> = {};
    const geoDistribution: Record<string, number> = {};

    accounts?.forEach(account => {
      if (account.revenue_range) {
        revenueDistribution[account.revenue_range] = (revenueDistribution[account.revenue_range] || 0) + 1;
      }
      if (account.industry_norm) {
        industryDistribution[account.industry_norm] = (industryDistribution[account.industry_norm] || 0) + 1;
      }
      if (account.employee_count) {
        const sizeRange = account.employee_count < 50 ? '1-50' :
                         account.employee_count < 200 ? '51-200' :
                         account.employee_count < 500 ? '201-500' :
                         account.employee_count < 1000 ? '501-1000' : '1000+';
        sizeDistribution[sizeRange] = (sizeDistribution[sizeRange] || 0) + 1;
      }
      if (account.country) {
        geoDistribution[account.country] = (geoDistribution[account.country] || 0) + 1;
      }
    });

    const personaDistribution: Record<string, number> = {};
    const titleDistribution: Record<string, number> = {};

    leads?.forEach(lead => {
      if (lead.persona) {
        personaDistribution[lead.persona] = (personaDistribution[lead.persona] || 0) + 1;
      }
      if (lead.title_raw) {
        titleDistribution[lead.title_raw] = (titleDistribution[lead.title_raw] || 0) + 1;
      }
    });

    // Generate insights using tool calling
    const leadCoverageNum = parseFloat(leadCoverageStats.leadCoveragePercent);
    
    // Calculate additional metrics for richer insights
    const avgScore = accounts?.reduce((sum, a) => sum + (a.scores?.[0]?.overall || 0), 0) / (accounts?.length || 1);
    const lowScoreAccounts = accounts?.filter(a => a.scores?.[0]?.overall < 40) || [];
    const mediumScoreAccounts = accounts?.filter(a => a.scores?.[0]?.overall >= 40 && a.scores?.[0]?.overall < 70) || [];
    const scoringGaps = accounts?.filter(a => !a.scores || a.scores.length === 0) || [];
    
    // Find accounts with single contact (multi-threading gap)
    const accountContactCounts: Record<string, number> = {};
    leads?.forEach(l => {
      if (l.account_external_id) {
        accountContactCounts[l.account_external_id] = (accountContactCounts[l.account_external_id] || 0) + 1;
      }
    });
    const singleContactHighFit = highScoreAccounts.filter(a => accountContactCounts[a.external_id] === 1).length;
    const noContactHighFit = highScoreAccounts.filter(a => !accountContactCounts[a.external_id]).length;
    
    // Industry concentration analysis
    const sortedIndustries = Object.entries(industryDistribution).sort((a, b) => b[1] - a[1]);
    const topIndustryConcentration = sortedIndustries[0] ? (sortedIndustries[0][1] / (accounts?.length || 1)) * 100 : 0;
    const industryDiversity = sortedIndustries.length;
    
    // Geographic opportunities
    const sortedGeos = Object.entries(geoDistribution).sort((a, b) => b[1] - a[1]);
    const underPenetratedGeos = sortedGeos.filter(([_, count]) => count < (accounts?.length || 1) * 0.05);
    
    const systemPrompt = `You are a B2B sales intelligence analyst for LaunchPulse. Generate 8-10 diverse, actionable insights.

INSIGHT CATEGORIES (generate at least one from each):
1. OPPORTUNITIES: High-fit accounts ready for outreach, untapped segments, similar-to-closed-won patterns
2. RISKS: Low engagement, score drops, stale data, churning signals
3. ENGAGEMENT: Activity gaps, accounts needing follow-up, multi-threading opportunities
4. COVERAGE: Contact gaps, missing personas, geographic expansion
5. REVENUE: Deal patterns, pipeline opportunities, segment performance

RULES:
- If lead coverage >= 85%, emphasize campaign execution and engagement insights
- If data completeness >= 80%, focus on action insights not enrichment
- Use specific numbers from data provided
- Assign category: "action_required" for critical/high priority, "opportunity" for growth, "warning" for risks, "info" for insights
- Mix priorities: 1-2 critical, 2-3 high, 3-4 medium, 1-2 low
- Each insight must be unique and actionable
- Keep titles under 50 characters
- Keep descriptions under 100 words`;

    const userPrompt = `Generate 8-10 diverse insights based on this data:

ACCOUNT METRICS:
- Total accounts: ${accounts?.length || 0}
- High-fit (score 70+): ${highScoreAccounts.length} (${((highScoreAccounts.length / (accounts?.length || 1)) * 100).toFixed(1)}%)
- Medium-fit (40-70): ${mediumScoreAccounts.length}
- Low-fit (<40): ${lowScoreAccounts.length}
- Unscored: ${scoringGaps.length}
- Average score: ${avgScore.toFixed(0)}

CONTACT COVERAGE:
- Total leads: ${leadCoverageStats.totalLeads}
- Lead coverage: ${leadCoverageStats.leadCoveragePercent}%
- High-fit with no contacts: ${noContactHighFit}
- High-fit with only 1 contact: ${singleContactHighFit} (multi-threading gap)
- Accounts missing leads: ${leadCoverageStats.highFitMissingLeads}

DATA COMPLETENESS: ${dataCompleteness.toFixed(0)}%
- Industry: ${((accountsWithIndustry / totalAccounts) * 100).toFixed(0)}%
- Revenue: ${((accountsWithRevenue / totalAccounts) * 100).toFixed(0)}%
- Size: ${((accountsWithSize / totalAccounts) * 100).toFixed(0)}%
- Geography: ${((accountsWithGeo / totalAccounts) * 100).toFixed(0)}%

DISTRIBUTIONS:
- Top industry: ${sortedIndustries[0]?.[0] || 'Unknown'} (${sortedIndustries[0]?.[1] || 0} accounts, ${topIndustryConcentration.toFixed(1)}% concentration)
- Second industry: ${sortedIndustries[1]?.[0] || 'N/A'} (${sortedIndustries[1]?.[1] || 0})
- Industry diversity: ${industryDiversity} unique industries
- Top geography: ${sortedGeos[0]?.[0] || 'Unknown'} (${sortedGeos[0]?.[1] || 0})
- Under-penetrated regions: ${underPenetratedGeos.length} (less than 5% each)
- Top persona: ${Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'} (${Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0]?.[1] || 0})

DEAL CONTEXT:
- Avg deal value: $${avgDealValue.toFixed(0)}
- Closed deals: ${deals?.length || 0}

STATUS SUMMARY:
- Coverage: ${leadCoverageNum >= 85 ? 'EXCELLENT - focus on campaigns' : leadCoverageNum >= 60 ? 'MODERATE - some gaps' : 'NEEDS IMPROVEMENT'}
- Data: ${dataCompleteness >= 80 ? 'COMPLETE' : dataCompleteness >= 60 ? 'MODERATE' : 'NEEDS ENRICHMENT'}
- Multi-threading: ${singleContactHighFit > 20 ? 'CRITICAL GAP - many single-contact accounts' : singleContactHighFit > 10 ? 'NEEDS ATTENTION' : 'HEALTHY'}

Generate insights that are immediately actionable for a sales/marketing team.`;

    const aiInsights = await callAIWithToolCalling(systemPrompt, userPrompt, 2500);

    // POST-AI VALIDATION: Filter out hallucinated insights
    const validatedAiInsights = aiInsights.filter(insight => {
      const titleLower = insight.title.toLowerCase();
      const descLower = insight.description.toLowerCase();
      
      // Filter out "missing leads" insights if coverage is good
      if ((titleLower.includes('missing lead') || titleLower.includes('no lead') || 
           titleLower.includes('lead gap') || titleLower.includes('lead coverage') ||
           descLower.includes('missing lead') || descLower.includes('without lead')) && 
          leadCoverageStats.highFitMissingLeads < 100) {
        console.log('Filtering out inaccurate AI insight about missing leads:', insight.title);
        return false;
      }
      
      // Filter out enrichment suggestions if data completeness is high
      if ((titleLower.includes('enrich') || titleLower.includes('data quality') ||
           titleLower.includes('incomplete')) && dataCompleteness > 80) {
        console.log('Filtering out unnecessary enrichment suggestion:', insight.title);
        return false;
      }
      
      // Filter out lead enrichment if coverage is excellent
      if ((titleLower.includes('enrich lead') || titleLower.includes('add lead') ||
           titleLower.includes('find lead') || titleLower.includes('discover lead')) && 
          leadCoverageNum >= 85) {
        console.log('Filtering out lead enrichment suggestion - coverage already good:', insight.title);
        return false;
      }
      
      return true;
    });

    console.log(`After validation: ${validatedAiInsights.length} AI insights (filtered ${aiInsights.length - validatedAiInsights.length})`);

    // Add DATA-DRIVEN insights based on REAL metrics
    const insights: Insight[] = [...validatedAiInsights];
    
    // Reuse calculated variables
    const topRevenue = Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0];
    const topIndustry = sortedIndustries[0];
    const secondIndustry = sortedIndustries[1];
    const topGeo = sortedGeos[0];
    const topPersona = Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0];
    
    // CRITICAL: Multi-threading gap insight
    if (singleContactHighFit > 10) {
      insights.push({
        type: 'engagement',
        priority: singleContactHighFit > 50 ? 'critical' : 'high',
        title: `${singleContactHighFit} high-fit accounts have only 1 contact`,
        description: `Multi-threading is critical for enterprise sales. These accounts have a single point of failure. Add more decision-makers to improve deal velocity.`,
        impact: `Reduce deal risk for ${singleContactHighFit} high-value accounts`,
        confidence: 95,
        category: 'action_required',
        nextAction: 'enrich_data'
      });
    }
    
    // CRITICAL: No contacts in high-fit accounts
    if (noContactHighFit > 5) {
      insights.push({
        type: 'coverage',
        priority: noContactHighFit > 20 ? 'critical' : 'high',
        title: `${noContactHighFit} high-fit accounts missing contacts`,
        description: `These are your best-fit accounts with no reachable leads. Priority for contact discovery.`,
        impact: `Unlock outreach to ${noContactHighFit} high-potential accounts`,
        confidence: 100,
        category: 'action_required',
        nextAction: 'enrich_data'
      });
    }
    
    // Lead coverage insight - ONLY if there's actually a problem
    if (leadCoverageStats.highFitMissingLeads > 100) {
      insights.push({
        type: 'coverage',
        priority: 'high',
        title: `${leadCoverageStats.highFitMissingLeads.toLocaleString()} high-fit accounts need leads`,
        description: `${leadCoverageStats.leadCoveragePercent}% lead coverage. ${leadCoverageStats.highFitAccountsWithLeads} of ${highScoreAccounts.length} high-fit accounts have reachable leads.`,
        impact: `Potential to reach ${leadCoverageStats.highFitMissingLeads} additional high-fit accounts`,
        confidence: 95,
        category: 'action_required',
        nextAction: 'enrich_data'
      });
    } else if (leadCoverageNum >= 85 && highScoreAccounts.length > 10) {
      // POSITIVE insight when coverage is excellent
      insights.push({
        type: 'opportunity',
        priority: 'medium',
        title: `Campaign-ready: ${leadCoverageStats.leadCoveragePercent}% coverage`,
        description: `${leadCoverageStats.highFitAccountsWithLeads} of ${highScoreAccounts.length} high-fit accounts have reachable leads. Your data is ready for outreach.`,
        impact: 'Strong outreach readiness - launch targeted campaigns',
        confidence: 100,
        category: 'opportunity',
        nextAction: 'build_campaign'
      });
    }

    // OPPORTUNITY: High-fit accounts ready for campaign
    if (highScoreAccounts.length > 0) {
      const campaignReady = highScoreAccounts.filter(a => accountContactCounts[a.external_id] >= 1).length;
      if (campaignReady > 10) {
        insights.push({
          type: 'opportunity',
          priority: 'high',
          title: `${campaignReady} high-fit accounts ready for outreach`,
          description: `These accounts score 70+ and have contacts. Perfect targets for your next campaign.`,
          impact: `Estimated $${Math.round(campaignReady * avgDealValue * 0.05).toLocaleString()} pipeline opportunity`,
          confidence: 90,
          category: 'opportunity',
          nextAction: 'build_campaign'
        });
      }
    }

    // Revenue segment insight
    if (topRevenue && insights.length < 12) {
      insights.push({
        type: 'revenue',
        priority: 'medium',
        title: `Target ${topRevenue[0]} segment`,
        description: `${topRevenue[1]} accounts (${((topRevenue[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in this revenue range. Strong concentration for focused campaigns.`,
        impact: `Estimated $${Math.round(topRevenue[1] * avgDealValue * 0.1).toLocaleString()} pipeline from this segment`,
        confidence: 88,
        category: 'opportunity',
        nextAction: 'build_campaign'
      });
    }

    // Industry concentration insight
    if (topIndustry && topIndustryConcentration > 30 && insights.length < 12) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `${topIndustry[0]} dominates at ${topIndustryConcentration.toFixed(0)}%`,
        description: `${topIndustry[1]} accounts in ${topIndustry[0]}. ${secondIndustry ? `${secondIndustry[0]} is second with ${secondIndustry[1]}.` : ''} Strong vertical focus.`,
        impact: 'Develop industry-specific messaging and case studies',
        confidence: 85,
        category: 'info',
        nextAction: 'view_accounts'
      });
    }

    // Industry diversity opportunity
    if (industryDiversity > 10 && insights.length < 15) {
      insights.push({
        type: 'firmographic',
        priority: 'low',
        title: `${industryDiversity} industries in your pipeline`,
        description: `Diverse industry spread offers multiple market opportunities. Consider segment-specific campaigns.`,
        impact: 'Reduce concentration risk through diversification',
        confidence: 75,
        category: 'info',
        nextAction: 'view_accounts'
      });
    }

    // Persona insight
    if (topPersona && insights.length < 12) {
      insights.push({
        type: 'persona',
        priority: 'medium',
        title: `${topPersona[0]} is your key buyer`,
        description: `${topPersona[1]} contacts (${((topPersona[1] / (leads?.length || 1)) * 100).toFixed(1)}%) match this persona. Tailor outreach to their pain points.`,
        impact: 'Higher conversion with persona-specific messaging',
        confidence: 80,
        category: 'info',
        nextAction: 'build_campaign'
      });
    }

    // Geographic insight
    if (topGeo && insights.length < 15) {
      insights.push({
        type: 'firmographic',
        priority: 'low',
        title: `${topGeo[0]} leads geography`,
        description: `${topGeo[1]} accounts (${((topGeo[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in ${topGeo[0]}. ${underPenetratedGeos.length > 0 ? `${underPenetratedGeos.length} regions under-penetrated.` : ''}`,
        impact: 'Consider geographic expansion campaigns',
        confidence: 75,
        category: 'info',
        nextAction: 'view_accounts'
      });
    }

    // Unscored accounts warning
    if (scoringGaps.length > 50) {
      insights.push({
        type: 'risk',
        priority: scoringGaps.length > 200 ? 'high' : 'medium',
        title: `${scoringGaps.length} accounts unscored`,
        description: `These accounts haven't been scored against your ICP. You may be missing opportunities or wasting effort on low-fit accounts.`,
        impact: `Score ${scoringGaps.length} accounts to prioritize correctly`,
        confidence: 100,
        category: 'warning',
        nextAction: 'score_accounts'
      });
    }

    // Low-fit accounts insight
    if (lowScoreAccounts.length > 100 && insights.length < 15) {
      const lowFitPercent = ((lowScoreAccounts.length / (accounts?.length || 1)) * 100).toFixed(0);
      insights.push({
        type: 'risk',
        priority: 'low',
        title: `${lowFitPercent}% of accounts are low-fit`,
        description: `${lowScoreAccounts.length} accounts score below 40. Consider deprioritizing or removing these from active campaigns.`,
        impact: 'Focus resources on higher-probability accounts',
        confidence: 85,
        category: 'warning',
        nextAction: 'view_accounts'
      });
    }

    // Data completeness insight - only if actually needed
    if (dataCompleteness < 70) {
      insights.push({
        type: 'coverage',
        priority: dataCompleteness < 50 ? 'high' : 'medium',
        title: `Data completeness at ${dataCompleteness.toFixed(0)}%`,
        description: `Industry: ${((accountsWithIndustry / totalAccounts) * 100).toFixed(0)}%, Revenue: ${((accountsWithRevenue / totalAccounts) * 100).toFixed(0)}%, Size: ${((accountsWithSize / totalAccounts) * 100).toFixed(0)}%, Geography: ${((accountsWithGeo / totalAccounts) * 100).toFixed(0)}%`,
        impact: 'Better data enables more accurate scoring and targeting',
        confidence: 100,
        category: 'warning',
        nextAction: 'enrich_data'
      });
    }

    // Medium-fit opportunity
    if (mediumScoreAccounts.length > 50 && insights.length < 15) {
      insights.push({
        type: 'opportunity',
        priority: 'medium',
        title: `${mediumScoreAccounts.length} medium-fit accounts to nurture`,
        description: `These accounts score 40-70. With better data or engagement, some could become high-fit targets.`,
        impact: `Potential to upgrade ${Math.round(mediumScoreAccounts.length * 0.2)} accounts to high-fit`,
        confidence: 70,
        category: 'opportunity',
        nextAction: 'enrich_data'
      });
    }

    // Sort insights by priority (critical first, then high, medium, low)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Filter out dismissed recommendations
    const filteredInsights = insights.filter(insight => {
      const insightId = `${insight.type}-${insight.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;
      return !dismissedIds.has(insightId);
    });

    console.log(`Final: ${filteredInsights.length} insights after filtering dismissed`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: filteredInsights.slice(0, 15), // Max 15 insights
        stats: {
          totalAccounts: accounts?.length || 0,
          highFitAccounts: highScoreAccounts.length,
          mediumFitAccounts: mediumScoreAccounts.length,
          lowFitAccounts: lowScoreAccounts.length,
          unscoredAccounts: scoringGaps.length,
          leadCoverage: leadCoverageStats,
          dataCompleteness: dataCompleteness.toFixed(1),
          multiThreadingGap: singleContactHighFit,
          noContactHighFit: noContactHighFit,
        },
        debug: {
          aiInsightsGenerated: aiInsights.length,
          aiInsightsValidated: validatedAiInsights.length,
          dataInsightsAdded: insights.length - validatedAiInsights.length,
          dismissedFiltered: insights.length - filteredInsights.length,
          totalBeforeLimit: filteredInsights.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating insights:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        insights: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

interface InsightsRequest {
  org_id: string;
  icp_id?: string;
}

interface Insight {
  type: 'revenue' | 'persona' | 'firmographic' | 'signal';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  relatedSegments?: string[];
  targetAccounts?: Array<{
    account_id: string;
    account_name: string;
    score: number;
    reason: string;
  }>;
  nextAction?: 'build_campaign' | 'export_csv' | 'view_accounts' | 'enrich_data' | 'score_accounts';
  revenue_opportunity?: number;
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
      description: "Generate 3 actionable B2B sales insights based on the data provided",
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
                  enum: ["revenue", "persona", "firmographic", "signal"],
                  description: "Category of insight"
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Urgency level"
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
                  description: "Expected business impact"
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-100"
                }
              },
              required: ["type", "priority", "title", "description", "impact", "confidence"],
              additionalProperties: false
            },
            minItems: 3,
            maxItems: 3
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, icp_id }: InsightsRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: org_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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

    // Get accounts with scores
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*, scores(*)')
      .eq('org_id', org_id)
      .not('scores', 'is', null);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

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
    
    const systemPrompt = `You are a B2B sales analyst. Generate exactly 3 actionable insights.

RULES:
- If lead coverage >= 85%, focus on campaign execution, NOT lead enrichment
- If data completeness >= 80%, do NOT suggest data enrichment
- Use specific numbers from the data provided
- Keep titles under 50 characters
- Keep descriptions under 100 words
- Each insight must be unique and actionable`;

    const userPrompt = `Generate 3 insights based on this data:

DATA:
- Accounts: ${accounts?.length || 0} total, ${highScoreAccounts.length} high-fit
- Leads: ${leadCoverageStats.totalLeads} total, ${leadCoverageStats.leadCoveragePercent}% coverage
- Missing leads: ${leadCoverageStats.highFitMissingLeads}
- Data completeness: ${dataCompleteness.toFixed(0)}%
- Top industry: ${Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'} (${Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[0]?.[1] || 0})
- Top revenue: ${Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'} (${Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0]?.[1] || 0})
- Top geo: ${Object.entries(geoDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'} (${Object.entries(geoDistribution).sort((a, b) => b[1] - a[1])[0]?.[1] || 0})
- Top persona: ${Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'} (${Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0]?.[1] || 0})
- Avg deal: $${avgDealValue.toFixed(0)}

Coverage status: ${leadCoverageNum >= 85 ? 'EXCELLENT - suggest campaigns' : leadCoverageNum >= 60 ? 'MODERATE' : 'NEEDS IMPROVEMENT'}
Data status: ${dataCompleteness >= 80 ? 'COMPLETE - no enrichment needed' : dataCompleteness >= 60 ? 'MODERATE' : 'NEEDS ENRICHMENT'}`;

    const aiInsights = await callAIWithToolCalling(systemPrompt, userPrompt, 1200);

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
    
    // Lead coverage insight - ONLY if there's actually a problem
    if (leadCoverageStats.highFitMissingLeads > 100) {
      insights.push({
        type: 'signal',
        priority: 'high',
        title: `${leadCoverageStats.highFitMissingLeads.toLocaleString()} high-fit accounts need leads`,
        description: `${leadCoverageStats.leadCoveragePercent}% lead coverage. ${leadCoverageStats.highFitAccountsWithLeads} of ${highScoreAccounts.length} high-fit accounts have reachable leads.`,
        impact: `Potential to reach ${leadCoverageStats.highFitMissingLeads} additional high-fit accounts`,
        confidence: 95,
        nextAction: 'enrich_data'
      });
    } else if (leadCoverageNum >= 85 && highScoreAccounts.length > 10) {
      // POSITIVE insight when coverage is excellent
      insights.push({
        type: 'signal',
        priority: 'low',
        title: `Excellent lead coverage: ${leadCoverageStats.leadCoveragePercent}%`,
        description: `${leadCoverageStats.highFitAccountsWithLeads} of ${highScoreAccounts.length} high-fit accounts have reachable leads. Your data is campaign-ready.`,
        impact: 'Strong outreach readiness - focus on campaign execution',
        confidence: 100,
        nextAction: 'build_campaign'
      });
    }

    // Expanded data-driven fallback insights
    const topRevenue = Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0];
    const topIndustry = Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[0];
    const topGeo = Object.entries(geoDistribution).sort((a, b) => b[1] - a[1])[0];
    const topPersona = Object.entries(personaDistribution).sort((a, b) => b[1] - a[1])[0];
    const secondIndustry = Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[1];

    // Always add revenue insight if we have data and need more insights
    if (topRevenue && insights.length < 5) {
      insights.push({
        type: 'revenue',
        priority: 'high',
        title: `Target ${topRevenue[0]} segment`,
        description: `${topRevenue[1]} accounts (${((topRevenue[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in this revenue range. Strong concentration for focused campaigns.`,
        impact: `Estimated ${Math.round(topRevenue[1] * avgDealValue * 0.1).toLocaleString()} pipeline from this segment`,
        confidence: 88,
        nextAction: 'build_campaign'
      });
    }

    // Industry insight
    if (topIndustry && insights.length < 5) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `${topIndustry[0]} leads your pipeline`,
        description: `${topIndustry[1]} accounts (${((topIndustry[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in ${topIndustry[0]}. ${secondIndustry ? `${secondIndustry[0]} is second with ${secondIndustry[1]} accounts.` : ''}`,
        impact: 'Focus messaging and case studies on top verticals',
        confidence: 85,
        nextAction: 'view_accounts'
      });
    }

    // Persona insight
    if (topPersona && insights.length < 5) {
      insights.push({
        type: 'persona',
        priority: 'medium',
        title: `${topPersona[0]} is your key buyer`,
        description: `${topPersona[1]} contacts (${((topPersona[1] / (leads?.length || 1)) * 100).toFixed(1)}%) match this persona. Tailor outreach to their pain points.`,
        impact: 'Higher conversion with persona-specific messaging',
        confidence: 80,
        nextAction: 'build_campaign'
      });
    }

    // Geographic insight
    if (topGeo && insights.length < 5) {
      insights.push({
        type: 'firmographic',
        priority: 'low',
        title: `${topGeo[0]} dominates geography`,
        description: `${topGeo[1]} accounts (${((topGeo[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in ${topGeo[0]}. Consider expanding to adjacent markets.`,
        impact: 'Potential for geographic expansion campaigns',
        confidence: 75,
        nextAction: 'view_accounts'
      });
    }

    // Data completeness insight - only if actually needed
    if (dataCompleteness < 70 && insights.length < 5) {
      insights.push({
        type: 'signal',
        priority: 'high',
        title: `Data completeness at ${dataCompleteness.toFixed(0)}%`,
        description: `Industry: ${((accountsWithIndustry / totalAccounts) * 100).toFixed(0)}%, Revenue: ${((accountsWithRevenue / totalAccounts) * 100).toFixed(0)}%, Size: ${((accountsWithSize / totalAccounts) * 100).toFixed(0)}%, Geography: ${((accountsWithGeo / totalAccounts) * 100).toFixed(0)}%`,
        impact: 'Better data enables more accurate scoring and targeting',
        confidence: 100,
        nextAction: 'enrich_data'
      });
    }

    // Filter out dismissed recommendations
    const filteredInsights = insights.filter(insight => {
      const insightId = `${insight.type}-${insight.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;
      return !dismissedIds.has(insightId);
    });

    console.log(`Final: ${filteredInsights.length} insights after filtering dismissed`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: filteredInsights.slice(0, 6), // Max 6 insights
        stats: {
          totalAccounts: accounts?.length || 0,
          highFitAccounts: highScoreAccounts.length,
          leadCoverage: leadCoverageStats,
          dataCompleteness: dataCompleteness.toFixed(1),
        },
        debug: {
          aiInsightsGenerated: aiInsights.length,
          aiInsightsValidated: validatedAiInsights.length,
          dataInsightsAdded: insights.length - validatedAiInsights.length,
          dismissedFiltered: insights.length - filteredInsights.length,
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

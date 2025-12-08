import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getModelConfig, getApiKey, buildHeaders, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

// Attempt to repair truncated JSON
function repairJSON(jsonStr: string): string {
  let repaired = jsonStr.trim();
  
  // Remove markdown code blocks
  if (repaired.startsWith('```')) {
    repaired = repaired.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  // Count brackets
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  
  // Fix unclosed braces first
  if (openBraces > closeBraces) {
    // Find if we're in an incomplete object
    const lastBrace = repaired.lastIndexOf('{');
    const lastCloseBrace = repaired.lastIndexOf('}');
    if (lastBrace > lastCloseBrace) {
      // Truncated in middle of object - remove incomplete object
      repaired = repaired.substring(0, lastBrace).trim();
      if (repaired.endsWith(',')) {
        repaired = repaired.slice(0, -1);
      }
    }
  }
  
  // Add missing closing brackets
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  
  return repaired;
}

// Multi-provider AI call with fallback and retry
async function callAIWithFallback(
  messages: Array<{ role: string; content: string }>, 
  maxTokens: number = 1500,
  retries: number = 2
): Promise<any> {
  const providers = getAvailableProviders();
  console.log(`[ICP Insights] Available AI providers: ${providers.join(', ')}`);
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const provider of providers) {
      try {
        const config = getModelConfig('analysis', provider);
        const headers = buildHeaders(provider);
        
        const body: any = {
          model: config.model,
          messages,
        };
        body[config.maxTokensParam] = maxTokens;
        
        console.log(`[ICP Insights] Attempt ${attempt + 1}/${retries + 1} - Trying ${provider} with model ${config.model}`);
        
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        
        if (response.ok) {
          console.log(`[ICP Insights] Success with ${provider}`);
          return await response.json();
        }
        
        const errorText = await response.text();
        console.error(`[ICP Insights] ${provider} error (${response.status}): ${errorText}`);
        lastError = new Error(`${provider}: ${response.status}`);
      } catch (error) {
        console.error(`[ICP Insights] ${provider} failed:`, error);
        lastError = error as Error;
      }
    }
    
    // Wait before retry
    if (attempt < retries) {
      console.log(`[ICP Insights] Retrying in ${(attempt + 1) * 500}ms...`);
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 500));
    }
  }
  
  throw lastError || new Error('All AI providers failed');
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

    // Generate insights using multi-provider AI with retry and JSON repair
    let aiInsights: Insight[] = [];
    let aiParseError: string | null = null;
    
    const leadCoverageNum = parseFloat(leadCoverageStats.leadCoveragePercent);
    
    // Simplified prompt for more reliable JSON output
    const systemPrompt = `You are a B2B sales analyst. Return ONLY a valid JSON array with exactly 3 insights. No markdown, no explanations.

RULES:
- If lead coverage >= 85%, focus on campaign execution, NOT lead enrichment
- If data completeness >= 80%, do NOT suggest data enrichment
- Use specific numbers from the data provided
- Keep titles under 50 characters
- Keep descriptions under 100 words

JSON SCHEMA (follow exactly):
[{"type":"revenue"|"persona"|"firmographic"|"signal","priority":"high"|"medium"|"low","title":"string","description":"string","impact":"string","confidence":number}]`;

    const userPrompt = `Return exactly 3 insights as a JSON array.

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
Data status: ${dataCompleteness >= 80 ? 'COMPLETE - no enrichment needed' : dataCompleteness >= 60 ? 'MODERATE' : 'NEEDS ENRICHMENT'}

IMPORTANT: End your response with ] to close the array.`;

    try {
      const aiData = await callAIWithFallback([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], 1200, 2);

      const aiContent = aiData.choices?.[0]?.message?.content || '';
      console.log(`[ICP Insights] Raw AI response length: ${aiContent.length} chars`);
      
      // Try to parse, with JSON repair fallback
      let jsonText = repairJSON(aiContent);
      
      try {
        const parsed = JSON.parse(jsonText);
        aiInsights = Array.isArray(parsed) ? parsed : [];
        console.log(`[ICP Insights] Parsed ${aiInsights.length} AI insights`);
      } catch (parseError) {
        console.error('[ICP Insights] JSON parse failed after repair:', parseError);
        console.error('[ICP Insights] Content preview:', aiContent.substring(0, 500));
        aiParseError = `Parse error: ${(parseError as Error).message}`;
        
        // Try extracting individual objects as last resort
        const objectMatches = aiContent.match(/\{[^{}]*"type"[^{}]*\}/g);
        if (objectMatches && objectMatches.length > 0) {
          console.log(`[ICP Insights] Attempting to extract ${objectMatches.length} individual objects`);
          for (const objStr of objectMatches) {
            try {
              const obj = JSON.parse(objStr);
              if (obj.type && obj.title && obj.description) {
                aiInsights.push(obj);
              }
            } catch { /* skip malformed object */ }
          }
          console.log(`[ICP Insights] Extracted ${aiInsights.length} valid objects`);
        }
      }
    } catch (aiError) {
      console.error('[ICP Insights] AI generation error:', aiError);
      aiParseError = `AI error: ${(aiError as Error).message}`;
    }

    // POST-AI VALIDATION: Filter out hallucinated insights (leadCoverageNum already declared at line 279)
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

    // Always add revenue insight if we have data
    if (topRevenue && insights.length < 7) {
      insights.push({
        type: 'revenue',
        priority: 'high',
        title: `Target ${topRevenue[0]} segment`,
        description: `${topRevenue[1]} accounts (${((topRevenue[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) in this revenue range. Strong concentration for focused campaigns.`,
        impact: 'High conversion probability based on account concentration',
        confidence: 88,
        relatedSegments: [topRevenue[0]],
        nextAction: 'build_campaign',
        revenue_opportunity: highScoreAccounts.length * avgDealValue * 0.15
      });
    }

    // Always add industry insight if we have data
    if (topIndustry && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'high',
        title: `Prioritize ${topIndustry[0]}`,
        description: `${topIndustry[1]} accounts in this industry. Your strongest vertical for targeted messaging.`,
        impact: 'Leverage industry expertise for higher win rates',
        confidence: 90,
        relatedSegments: [topIndustry[0]],
        nextAction: 'export_csv'
      });
    }

    // Add persona insight if available
    if (topPersona && insights.length < 7) {
      insights.push({
        type: 'persona',
        priority: 'high',
        title: `Focus on ${topPersona[0]} persona`,
        description: `${topPersona[1]} contacts with this persona. Optimize messaging and sequences for this audience.`,
        impact: 'Improve response rates with targeted persona messaging',
        confidence: 85,
        relatedSegments: [topPersona[0]],
        nextAction: 'build_campaign'
      });
    }

    // Add geographic insight
    if (topGeo && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `Expand in ${topGeo[0]}`,
        description: `${topGeo[1]} accounts in this region. Geographic concentration enables localized campaigns.`,
        impact: 'Regional focus for more relevant outreach',
        confidence: 82,
        relatedSegments: [topGeo[0]],
        nextAction: 'view_accounts'
      });
    }

    // Add secondary industry if we have few insights
    if (secondIndustry && insights.length < 5) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `Explore ${secondIndustry[0]} vertical`,
        description: `${secondIndustry[1]} accounts in your second-largest industry. Cross-sell opportunity.`,
        impact: 'Diversify pipeline with adjacent market',
        confidence: 75,
        relatedSegments: [secondIndustry[0]],
        nextAction: 'view_accounts'
      });
    }

    // Campaign readiness insight
    const campaignReadyAccounts = highScoreAccounts.filter(a => {
      const hasLead = leads?.some(l => l.account_external_id === a.external_id);
      return hasLead;
    }).length;
    
    if (campaignReadyAccounts > 0 && insights.length < 7) {
      insights.push({
        type: 'signal',
        priority: 'high',
        title: `${campaignReadyAccounts} accounts ready for outreach`,
        description: `High-fit accounts with verified leads. Launch a campaign to engage these opportunities now.`,
        impact: `Potential pipeline value: $${(campaignReadyAccounts * avgDealValue * 0.1).toLocaleString()}`,
        confidence: 95,
        nextAction: 'build_campaign'
      });
    }

    // Filter out dismissed insights
    const filteredInsights = insights.filter(insight => {
      // Create a stable ID from the insight content
      const insightId = `${insight.type}_${insight.title.toLowerCase().replace(/\s+/g, '_')}`;
      return !dismissedIds.has(insightId);
    });

    console.log(`Returning ${filteredInsights.length} insights after filtering ${insights.length - filteredInsights.length} dismissed`);

    console.log(`[ICP Insights] Returning ${filteredInsights.length} final insights (${aiInsights.length} from AI, rest data-driven)`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: filteredInsights.slice(0, 7),
        statistics: {
          total_accounts: accounts?.length || 0,
          high_score_accounts: highScoreAccounts.length,
          total_leads: leads?.length || 0,
          lead_coverage_percent: parseFloat(leadCoverageStats.leadCoveragePercent),
          high_fit_with_leads: leadCoverageStats.highFitAccountsWithLeads,
          high_fit_missing_leads: leadCoverageStats.highFitMissingLeads,
          data_completeness: parseFloat(dataCompleteness.toFixed(1)),
          total_deals: deals?.length || 0,
          avg_deal_value: avgDealValue
        },
        _debug: {
          ai_insights_count: aiInsights.length,
          ai_parse_error: aiParseError,
          fallback_used: aiInsights.length === 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('ICP insights error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
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

// Multi-provider AI call with fallback
async function callAIWithFallback(messages: Array<{ role: string; content: string }>, maxTokens: number = 2000): Promise<any> {
  const providers = getAvailableProviders();
  console.log(`[ICP Insights] Available AI providers: ${providers.join(', ')}`);
  
  for (const provider of providers) {
    try {
      const config = getModelConfig('analysis', provider);
      const headers = buildHeaders(provider);
      
      const body: any = {
        model: config.model,
        messages,
      };
      body[config.maxTokensParam] = maxTokens;
      
      console.log(`[ICP Insights] Trying ${provider} with model ${config.model}`);
      
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
    } catch (error) {
      console.error(`[ICP Insights] ${provider} failed:`, error);
    }
  }
  
  throw new Error('All AI providers failed');
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

    // Generate insights using multi-provider AI
    let aiInsights: Insight[] = [];
    
    try {
      const leadCoverageNum = parseFloat(leadCoverageStats.leadCoveragePercent);
      
      const aiData = await callAIWithFallback([
        {
          role: 'system',
          content: `You are an expert B2B sales analyst. Analyze firmographic data and provide actionable ICP insights. Return ONLY valid JSON array of insights, no markdown or explanations.

CRITICAL RULES - DO NOT VIOLATE:
- ONLY mention "missing leads" or "lead coverage issues" if High-Fit Missing Leads > 100
- ONLY mention "data quality issues" if data completeness is below 60%
- ONLY mention problems that are EXPLICITLY supported by the data provided
- If lead coverage is above 85%, DO NOT suggest lead enrichment - focus on campaign execution instead
- If data completeness is above 80%, DO NOT suggest data enrichment
- Focus on OPPORTUNITIES based on what the data shows, not problems that don't exist
- Be specific with numbers from the data provided`
        },
        {
          role: 'user',
          content: `Analyze this B2B sales data and return exactly 3-5 ICP insights as a JSON array. Each insight must follow this exact structure:

{
  "type": "revenue" | "persona" | "firmographic" | "signal",
  "priority": "high" | "medium" | "low",
  "title": "Short actionable title",
  "description": "Detailed explanation with specific data points",
  "impact": "Expected business impact",
  "confidence": 75
}

REAL DATA (use these exact numbers):
- Total Accounts: ${accounts?.length || 0}
- High-Fit Accounts (score >= 70): ${highScoreAccounts.length}
- Total Leads: ${leadCoverageStats.totalLeads}
- Lead Coverage: ${leadCoverageStats.highFitAccountsWithLeads} of ${highScoreAccounts.length} high-fit accounts have leads (${leadCoverageStats.leadCoveragePercent}%)
- High-Fit Accounts Missing Leads: ${leadCoverageStats.highFitMissingLeads}
- Data Completeness: ${dataCompleteness.toFixed(1)}%
- Revenue Distribution: ${JSON.stringify(revenueDistribution)}
- Industry Distribution: ${JSON.stringify(industryDistribution)}
- Company Size: ${JSON.stringify(sizeDistribution)}
- Geography: ${JSON.stringify(geoDistribution)}
- Personas: ${JSON.stringify(personaDistribution)}
- Top Titles: ${JSON.stringify(Object.entries(titleDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10))}
- Avg Deal: $${avgDealValue.toFixed(0)}

REMEMBER: 
- Lead coverage is ${leadCoverageStats.leadCoveragePercent}% - ${leadCoverageNum >= 85 ? 'this is GOOD, do NOT suggest enrichment' : leadCoverageNum >= 60 ? 'this is MODERATE' : 'this needs improvement'}
- Data completeness is ${dataCompleteness.toFixed(1)}% - ${dataCompleteness >= 80 ? 'this is GOOD' : dataCompleteness >= 60 ? 'this is MODERATE' : 'this needs improvement'}

Return ONLY the JSON array, no other text.`
        }
      ], 2000);

      const aiContent = aiData.choices?.[0]?.message?.content || '';
      
      // Parse AI response (handle markdown code blocks)
      let jsonText = aiContent.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }
      
      try {
        const parsed = JSON.parse(jsonText);
        aiInsights = Array.isArray(parsed) ? parsed : [];
        console.log(`Generated ${aiInsights.length} AI insights before validation`);
      } catch (parseError) {
        console.warn('Failed to parse AI response:', parseError);
      }
    } catch (aiError) {
      console.warn('AI generation error:', aiError);
    }

    // POST-AI VALIDATION: Filter out hallucinated insights
    const leadCoverageNum = parseFloat(leadCoverageStats.leadCoveragePercent);
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

    // Data-driven fallback insights for distributions
    const topRevenue = Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0];
    const topIndustry = Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[0];
    const topGeo = Object.entries(geoDistribution).sort((a, b) => b[1] - a[1])[0];

    if (topRevenue && insights.length < 7) {
      insights.push({
        type: 'revenue',
        priority: 'high',
        title: `Focus on ${topRevenue[0]} revenue range`,
        description: `${topRevenue[1]} accounts (${((topRevenue[1] / (accounts?.length || 1)) * 100).toFixed(1)}%) fall in this range, representing your largest revenue segment`,
        impact: 'High conversion probability based on historical data',
        confidence: 85,
        relatedSegments: [topRevenue[0]],
        nextAction: 'build_campaign',
        revenue_opportunity: highScoreAccounts.length * avgDealValue * 0.15
      });
    }

    if (topIndustry && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'high',
        title: `Prioritize ${topIndustry[0]} industry`,
        description: `${topIndustry[1]} accounts in this industry represent your largest market segment`,
        impact: 'Established market presence and industry expertise',
        confidence: 90,
        relatedSegments: [topIndustry[0]],
        nextAction: 'export_csv'
      });
    }

    if (topGeo && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `Expand in ${topGeo[0]}`,
        description: `${topGeo[1]} accounts in this region show strong engagement patterns`,
        impact: 'Geographic concentration advantage for targeted campaigns',
        confidence: 80,
        relatedSegments: [topGeo[0]],
        nextAction: 'view_accounts'
      });
    }

    // Filter out dismissed insights
    const filteredInsights = insights.filter(insight => {
      // Create a stable ID from the insight content
      const insightId = `${insight.type}_${insight.title.toLowerCase().replace(/\s+/g, '_')}`;
      return !dismissedIds.has(insightId);
    });

    console.log(`Returning ${filteredInsights.length} insights after filtering ${insights.length - filteredInsights.length} dismissed`);

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
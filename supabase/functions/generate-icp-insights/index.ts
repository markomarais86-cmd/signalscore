import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Analyze data
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

    const highScoreAccounts = accounts?.filter(a => a.scores?.[0]?.overall >= 70) || [];
    const avgDealValue = deals?.reduce((sum, d) => sum + Number(d.deal_value), 0) / (deals?.length || 1);

    // Generate insights using Lovable AI (simplified - no tool calling)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let aiInsights: Insight[] = [];
    
    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are an expert B2B sales analyst. Analyze firmographic data and provide actionable ICP insights. Return ONLY valid JSON array of insights, no markdown or explanations.'
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

Data:
- Revenue Distribution: ${JSON.stringify(revenueDistribution)}
- Industry Distribution: ${JSON.stringify(industryDistribution)}
- Company Size: ${JSON.stringify(sizeDistribution)}
- Geography: ${JSON.stringify(geoDistribution)}
- Personas: ${JSON.stringify(personaDistribution)}
- Top Titles: ${JSON.stringify(Object.entries(titleDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10))}
- High-Score Accounts: ${highScoreAccounts.length} of ${accounts?.length || 0}
- Avg Deal: $${avgDealValue.toFixed(0)}

Return ONLY the JSON array, no other text.`
            }
          ],
          max_tokens: 2000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';
        
        // Parse AI response (handle markdown code blocks)
        let jsonText = aiContent.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          aiInsights = Array.isArray(parsed) ? parsed : [];
          console.log(`Generated ${aiInsights.length} AI insights`);
        } catch (parseError) {
          console.warn('Failed to parse AI response:', parseError);
        }
      } else {
        console.warn('AI API error:', aiResponse.status, await aiResponse.text());
      }
    } catch (aiError) {
      console.warn('AI generation error:', aiError);
    }

    // Add data-driven fallback insights
    const insights: Insight[] = [...aiInsights];
    
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
          total_contacts: leads?.length || 0,
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

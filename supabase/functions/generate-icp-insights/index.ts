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

    // Get accounts with scores
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*, scores(*)')
      .eq('org_id', org_id)
      .not('scores', 'is', null);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('org_id', org_id);

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    // Get closed won deals
    const { data: deals, error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('*')
      .eq('org_id', org_id);

    if (dealsError) {
      throw new Error(`Failed to fetch deals: ${dealsError.message}`);
    }

    // Analyze revenue patterns
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

    // Analyze persona patterns
    const personaDistribution: Record<string, number> = {};
    const titleDistribution: Record<string, number> = {};

    contacts?.forEach(contact => {
      if (contact.persona) {
        personaDistribution[contact.persona] = (personaDistribution[contact.persona] || 0) + 1;
      }
      if (contact.title_raw) {
        titleDistribution[contact.title_raw] = (titleDistribution[contact.title_raw] || 0) + 1;
      }
    });

    // Calculate high-performing segments
    const highScoreAccounts = accounts?.filter(a => a.scores?.[0]?.overall >= 70) || [];
    const avgDealValue = deals?.reduce((sum, d) => sum + Number(d.deal_value), 0) / (deals?.length || 1);

    // Generate insights using Lovable AI with structured output (tool calling)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
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
            content: 'You are an expert B2B sales analyst. Analyze firmographic data and provide actionable ICP insights with specific recommendations.'
          },
          {
            role: 'user',
            content: `Analyze this B2B sales data and provide 5-7 specific ICP recommendations:

Revenue Distribution: ${JSON.stringify(revenueDistribution)}
Industry Distribution: ${JSON.stringify(industryDistribution)}
Company Size Distribution: ${JSON.stringify(sizeDistribution)}
Geography Distribution: ${JSON.stringify(geoDistribution)}
Persona Distribution: ${JSON.stringify(personaDistribution)}
Top Job Titles: ${JSON.stringify(Object.entries(titleDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10))}
High-Scoring Accounts: ${highScoreAccounts.length}
Total Accounts: ${accounts?.length || 0}
Average Deal Value: $${avgDealValue.toFixed(0)}
Total Closed Deals: ${deals?.length || 0}

Provide insights covering: revenue ranges, key personas/titles, company size sweet spots, geographic priorities, industry focus, buying signals, and budget/timing.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_icp_insights',
              description: 'Generate 5-7 actionable ICP insights based on sales data analysis',
              parameters: {
                type: 'object',
                properties: {
                  insights: {
                    type: 'array',
                    minItems: 5,
                    maxItems: 7,
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['revenue', 'persona', 'firmographic', 'signal'],
                          description: 'Category of the insight'
                        },
                        priority: {
                          type: 'string',
                          enum: ['high', 'medium', 'low'],
                          description: 'Priority level'
                        },
                        title: {
                          type: 'string',
                          description: 'Short, actionable title (max 100 chars)'
                        },
                        description: {
                          type: 'string',
                          description: 'Detailed explanation with specific data points'
                        },
                        impact: {
                          type: 'string',
                          description: 'Expected business impact'
                        },
                        confidence: {
                          type: 'number',
                          minimum: 0,
                          maximum: 100,
                          description: 'Confidence level (0-100)'
                        },
                        relatedSegments: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Related segments or categories'
                        }
                      },
                      required: ['type', 'priority', 'title', 'description', 'impact', 'confidence'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['insights'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_icp_insights' } }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status} ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let insights: Insight[] = [];
    
    if (toolCall && toolCall.function?.name === 'generate_icp_insights') {
      const parsedArgs = JSON.parse(toolCall.function.arguments);
      insights = parsedArgs.insights || [];
      console.log(`Generated ${insights.length} insights via tool calling`);
    } else {
      console.warn('No tool call returned, falling back to data-driven insights');
    }

    // Add data-driven insights
    const topRevenue = Object.entries(revenueDistribution).sort((a, b) => b[1] - a[1])[0];
    const topIndustry = Object.entries(industryDistribution).sort((a, b) => b[1] - a[1])[0];
    const topGeo = Object.entries(geoDistribution).sort((a, b) => b[1] - a[1])[0];

    if (topRevenue && insights.length < 7) {
      insights.push({
        type: 'revenue',
        priority: 'high',
        title: `Focus on ${topRevenue[0]} revenue range`,
        description: `${topRevenue[1]} accounts (${((topRevenue[1] / accounts.length) * 100).toFixed(1)}%) fall in this range`,
        impact: 'High conversion probability based on current data',
        confidence: 85,
        relatedSegments: [topRevenue[0]]
      });
    }

    if (topIndustry && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'high',
        title: `Prioritize ${topIndustry[0]} industry`,
        description: `${topIndustry[1]} accounts in this industry represent your largest segment`,
        impact: 'Established market presence',
        confidence: 90,
        relatedSegments: [topIndustry[0]]
      });
    }

    if (topGeo && insights.length < 7) {
      insights.push({
        type: 'firmographic',
        priority: 'medium',
        title: `Expand in ${topGeo[0]}`,
        description: `${topGeo[1]} accounts in this region show strong engagement`,
        impact: 'Geographic concentration advantage',
        confidence: 80,
        relatedSegments: [topGeo[0]]
      });
    }

    console.log(`Returning ${insights.length} total insights`);

    return new Response(
      JSON.stringify({
        success: true,
        insights: insights.slice(0, 7), // Return top 7 insights
        statistics: {
          total_accounts: accounts?.length || 0,
          high_score_accounts: highScoreAccounts.length,
          total_contacts: contacts?.length || 0,
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
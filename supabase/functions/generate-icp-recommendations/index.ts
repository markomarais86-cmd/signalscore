import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { org_id } = await req.json();
    
    // Get current accounts data for analysis
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id)
      .limit(100);

    if (accountsError) throw accountsError;

    // Get existing ICP profiles for context
    const { data: icps, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id);

    if (icpError) throw icpError;

    // Get dismissed recommendations to avoid repeating them
    const { data: dismissed } = await supabase
      .from('dismissed_recommendations')
      .select('recommendation_id')
      .eq('org_id', org_id);

    const dismissedIds = new Set(dismissed?.map(d => d.recommendation_id) || []);

    // Analyze data to generate recommendations with prioritization
    const dataAnalysis = analyzeAccountData(accounts);
    
    const prompt = `You are an expert B2B sales strategist. Analyze this CRM data and generate 5-8 prioritized, actionable recommendations.

CURRENT DATA:
- Total Accounts: ${dataAnalysis.totalAccounts}
- Top Industries: ${dataAnalysis.topIndustries.join(', ')}
- Company Sizes: ${dataAnalysis.companySizes.join(', ')}
- Top Countries: ${dataAnalysis.topCountries.join(', ')}
- Revenue Ranges: ${dataAnalysis.revenueRanges.join(', ')}
- Scored Accounts: ${accounts.filter(a => a.propensity_score).length}
- High-Fit Accounts (75+): ${accounts.filter(a => a.propensity_score >= 75).length}

EXISTING ICPs: ${icps.length > 0 ? icps.map(icp => icp.name).join(', ') : 'None'}

Generate recommendations that:
1. Are specific and actionable (with clear next steps)
2. Include priority score (1-100) based on potential impact
3. Cover different categories: revenue, firmographic, signal, quality, efficiency, growth
4. Focus on untapped opportunities or data quality improvements
5. Link to specific actions users can take

Format each recommendation as JSON with:
{
  "id": "unique-id",
  "category": "revenue|firmographic|signal|quality|efficiency|growth",
  "title": "Brief compelling title (max 60 chars)",
  "description": "One-sentence description",
  "why": "Why this matters (1-2 sentences)",
  "impact": "Expected impact (e.g., '+15% conversion', '$50K pipeline')",
  "action": "Clear CTA button text (e.g., 'View High-Fit Accounts')",
  "route": "/page-path",
  "priority": 85,
  "filter": { "key": "value" }
}

Return ONLY a JSON array of recommendations, no markdown or explanation.`;

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a B2B sales strategist. Return ONLY valid JSON arrays, no markdown formatting.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let recommendations = [];
    
    try {
      const content = aiData.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      recommendations = JSON.parse(jsonContent);
      
      // Filter out dismissed recommendations
      recommendations = recommendations.filter((r: any) => !dismissedIds.has(r.id));
      
      // Sort by priority
      recommendations.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

      // Save to recommendation_history
      for (const rec of recommendations.slice(0, 8)) {
        await supabase
          .from('recommendation_history')
          .insert({
            org_id,
            recommendation_type: rec.category || 'general',
            recommendation_data: rec,
            priority_score: rec.priority || 50,
            impact_estimate: rec.impact
          });
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', aiData.choices[0].message.content);
      // Return fallback recommendations
      recommendations = generateFallbackRecommendations(dataAnalysis, accounts);
    }

    return new Response(JSON.stringify({ 
      recommendations: recommendations.slice(0, 8),
      dataAnalysis,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-icp-recommendations:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeAccountData(accounts: any[]) {
  const industries = accounts.map(a => a.industry_norm).filter(Boolean);
  const countries = accounts.map(a => a.country).filter(Boolean);
  const revenues = accounts.map(a => a.revenue_range).filter(Boolean);
  const sizes = accounts.map(a => a.employee_count).filter(Boolean);

  const topIndustries = getTopItems(industries, 3);
  const topCountries = getTopItems(countries, 3);
  const topRevenues = getTopItems(revenues, 3);
  const companySizeRanges = categorizeSizes(sizes);

  return {
    totalAccounts: accounts.length,
    topIndustries,
    topCountries,
    revenueRanges: topRevenues,
    companySizes: companySizeRanges
  };
}

function getTopItems(items: string[], limit: number): string[] {
  const counts: { [key: string]: number } = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([item]) => item);
}

function categorizeSizes(sizes: number[]): string[] {
  const ranges = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
  const counts = {
    '1-10': 0,
    '11-50': 0,
    '51-200': 0,
    '201-1000': 0,
    '1000+': 0
  };

  sizes.forEach(size => {
    if (size <= 10) counts['1-10']++;
    else if (size <= 50) counts['11-50']++;
    else if (size <= 200) counts['51-200']++;
    else if (size <= 1000) counts['201-1000']++;
    else counts['1000+']++;
  });

  return Object.entries(counts)
    .filter(([,count]) => count > 0)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([range]) => range);
}

function generateFallbackRecommendations(dataAnalysis: any, accounts: any[]) {
  const scoredCount = accounts.filter(a => a.propensity_score).length;
  const highFitCount = accounts.filter(a => a.propensity_score >= 75).length;
  const enrichmentGaps = accounts.filter(a => !a.industry_norm || !a.employee_count || !a.revenue_range).length;
  
  return [
    {
      id: 'score-remaining',
      category: 'efficiency',
      title: 'Score Remaining Accounts',
      description: 'Prioritize high-potential accounts for faster conversions',
      why: `${dataAnalysis.totalAccounts - scoredCount} accounts are unscored. Scoring helps identify your best opportunities.`,
      impact: '+25% pipeline efficiency',
      action: 'Score Accounts',
      route: '/accounts',
      priority: 90,
      filter: { unscored: 'true' }
    },
    {
      id: 'focus-high-fit',
      category: 'revenue',
      title: `Focus on ${highFitCount} High-Fit Accounts`,
      description: 'Maximize ROI by prioritizing best-fit prospects',
      why: 'High-fit accounts (75+ score) convert 3x faster with 50% higher deal sizes.',
      impact: '+40% win rate',
      action: 'View High-Fit Accounts',
      route: '/accounts',
      priority: 85,
      filter: { min_score: '75' }
    },
    {
      id: 'enrich-data',
      category: 'quality',
      title: 'Improve Data Quality',
      description: 'Fill missing firmographic data for better scoring',
      why: `${enrichmentGaps} accounts have incomplete data affecting scoring accuracy.`,
      impact: '+15% scoring accuracy',
      action: 'Enrich Accounts',
      route: '/settings',
      priority: 75,
      filter: { tab: 'enrichment' }
    },
    {
      id: 'expand-geography',
      category: 'growth',
      title: `Expand to ${dataAnalysis.topCountries[1] || 'New'} Market`,
      description: 'Untapped geographic opportunity for revenue growth',
      why: 'Market analysis shows strong fit indicators in adjacent territories.',
      impact: '+$100K pipeline',
      action: 'Explore Market',
      route: '/accounts',
      priority: 70,
      filter: { country: dataAnalysis.topCountries[1] }
    }
  ];
}
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getModelConfig, buildHeaders, getAvailableProviders } from '../_shared/ai-config.ts';

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

// Multi-provider AI call with fallback
async function callAIWithFallback(messages: Array<{ role: string; content: string }>): Promise<any> {
  const providers = getAvailableProviders();
  console.log(`[ICP Recommendations] Available AI providers: ${providers.join(', ')}`);
  
  for (const provider of providers) {
    try {
      const config = getModelConfig('analysis', provider);
      const headers = buildHeaders(provider);
      
      const body: any = {
        model: config.model,
        messages,
      };
      body[config.maxTokensParam] = 2000;
      
      console.log(`[ICP Recommendations] Trying ${provider} with model ${config.model}`);
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        console.log(`[ICP Recommendations] Success with ${provider}`);
        return await response.json();
      }
      
      const errorText = await response.text();
      console.error(`[ICP Recommendations] ${provider} error (${response.status}): ${errorText}`);
    } catch (error) {
      console.error(`[ICP Recommendations] ${provider} failed:`, error);
    }
  }
  
  throw new Error('All AI providers failed');
}

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
    
    // Get existing ICP profiles for context (fetch first to filter accounts)
    const { data: icps, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id);

    if (icpError) throw icpError;

    // Build industry filter from active ICP profiles
    const icpIndustries = (icps || [])
      .filter(icp => icp.status === 'active' && icp.industries?.length)
      .flatMap(icp => icp.industries as string[]);

    // Get current accounts data for analysis - filter by ICP industries if available
    let accountsQuery = supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id);

    if (icpIndustries.length > 0) {
      // Filter to accounts matching ICP target industries
      accountsQuery = accountsQuery.in('industry_norm', icpIndustries);
    }

    const { data: accounts, error: accountsError } = await accountsQuery.limit(100);

    if (accountsError) throw accountsError;

    // Get onboarding config for company context
    const { data: onboardingConfig } = await supabase
      .from('org_onboarding_config')
      .select('company_name, website_url, value_proposition, target_persona_description')
      .eq('org_id', org_id)
      .maybeSingle();

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single();

    // Get dismissed recommendations to avoid repeating them
    const { data: dismissed } = await supabase
      .from('dismissed_recommendations')
      .select('recommendation_id')
      .eq('org_id', org_id);

    const dismissedIds = new Set(dismissed?.map(d => d.recommendation_id) || []);

    // Analyze data to generate recommendations with prioritization
    const dataAnalysis = analyzeAccountData(accounts || []);
    
    // Build company context from onboarding data
    const companyContext = buildCompanyContext(org?.name, onboardingConfig);
    
    const prompt = accounts && accounts.length > 0
      ? buildAccountBasedPrompt(dataAnalysis, accounts, icps || [], companyContext)
      : buildSeedPrompt(companyContext, icps || []);

    const providers = getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No AI provider configured');
    }

    let recommendations = [];
    
    try {
      const aiData = await callAIWithFallback([
        { role: 'system', content: 'You are a B2B sales strategist. Return ONLY valid JSON arrays, no markdown formatting.' },
        { role: 'user', content: prompt }
      ]);
      
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
      // Return fallback recommendations
      recommendations = accounts && accounts.length > 0 
        ? generateFallbackRecommendations(dataAnalysis, accounts)
        : generateSeedFallbackRecommendations(companyContext);
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

function buildCompanyContext(orgName: string | undefined, config: any): string {
  const parts: string[] = [];
  if (orgName) parts.push(`Company: ${orgName}`);
  if (config?.company_name) parts.push(`Brand: ${config.company_name}`);
  if (config?.website_url) parts.push(`Website: ${config.website_url}`);
  if (config?.value_proposition) parts.push(`Value Proposition: ${config.value_proposition}`);
  if (config?.target_persona_description) parts.push(`Target Persona: ${config.target_persona_description}`);
  return parts.length > 0 ? parts.join('\n') : 'No company context available';
}

function buildAccountBasedPrompt(dataAnalysis: any, accounts: any[], icps: any[], companyContext: string): string {
  return `You are an expert B2B sales strategist. Analyze this CRM data and generate 5-8 prioritized, actionable recommendations.

COMPANY CONTEXT:
${companyContext}

CURRENT DATA:
- Total Accounts: ${dataAnalysis.totalAccounts}
- Top Industries: ${dataAnalysis.topIndustries.join(', ')}
- Company Sizes: ${dataAnalysis.companySizes.join(', ')}
- Top Countries: ${dataAnalysis.topCountries.join(', ')}
- Revenue Ranges: ${dataAnalysis.revenueRanges.join(', ')}
- Scored Accounts: ${accounts.filter(a => a.propensity_score).length}
- High-Fit Accounts (75+): ${accounts.filter(a => a.propensity_score >= 75).length}

EXISTING ICPs: ${icps.length > 0 ? icps.map(icp => `${icp.name} (industries: ${(icp.industries || []).join(', ')})`).join('; ') : 'None'}

IMPORTANT: All recommendations MUST be relevant to the company's value proposition and target industries listed above. Do NOT recommend generic industries unrelated to the company context.

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
}

function buildSeedPrompt(companyContext: string, icps: any[]): string {
  return `You are an expert B2B sales strategist. A company is just getting started with their demand engine and has NO account data yet. Based on their company context, generate 5-8 seed ICP recommendations to help them define their ideal customer profile and start building their pipeline.

COMPANY CONTEXT:
${companyContext}

EXISTING ICPs: ${icps.length > 0 ? icps.map(icp => icp.name).join(', ') : 'None'}

Generate recommendations that:
1. Help define target industries, company sizes, and geographies based on their value proposition
2. Suggest specific ICP criteria they should configure
3. Recommend data sources to sync (Apollo, CRM imports)
4. Identify ideal buyer personas based on their target persona description
5. Include priority score (1-100) based on importance for getting started

Focus on ACTIONABLE first steps. These are seed recommendations to bootstrap their ICP strategy.

Format each recommendation as JSON with:
{
  "id": "unique-id",
  "category": "revenue|firmographic|signal|quality|efficiency|growth",
  "title": "Brief compelling title (max 60 chars)",
  "description": "One-sentence description",
  "why": "Why this matters (1-2 sentences)",
  "impact": "Expected impact",
  "action": "Clear CTA button text",
  "route": "/page-path",
  "priority": 85,
  "filter": { "key": "value" }
}

Return ONLY a JSON array of recommendations, no markdown or explanation.`;
}

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
  const counts = {
    '1-10': 0, '11-50': 0, '51-200': 0, '201-1000': 0, '1000+': 0
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
    { id: 'score-remaining', category: 'efficiency', title: 'Score Remaining Accounts', description: 'Prioritize high-potential accounts for faster conversions', why: `${dataAnalysis.totalAccounts - scoredCount} accounts are unscored.`, impact: '+25% pipeline efficiency', action: 'Score Accounts', route: '/accounts', priority: 90, filter: { unscored: 'true' } },
    { id: 'focus-high-fit', category: 'revenue', title: `Focus on ${highFitCount} High-Fit Accounts`, description: 'Maximize ROI by prioritizing best-fit prospects', why: 'High-fit accounts convert 3x faster with 50% higher deal sizes.', impact: '+40% win rate', action: 'View High-Fit Accounts', route: '/accounts', priority: 85, filter: { min_score: '75' } },
    { id: 'enrich-data', category: 'quality', title: 'Improve Data Quality', description: 'Fill missing firmographic data for better scoring', why: `${enrichmentGaps} accounts have incomplete data.`, impact: '+15% scoring accuracy', action: 'Enrich Accounts', route: '/settings', priority: 75, filter: { tab: 'enrichment' } },
    { id: 'expand-geography', category: 'growth', title: `Expand to ${dataAnalysis.topCountries[1] || 'New'} Market`, description: 'Untapped geographic opportunity for revenue growth', why: 'Market analysis shows strong fit indicators in adjacent territories.', impact: '+$100K pipeline', action: 'Explore Market', route: '/accounts', priority: 70, filter: { country: dataAnalysis.topCountries[1] } }
  ];
}

function generateSeedFallbackRecommendations(companyContext: string) {
  return [
    { id: 'define-icp', category: 'firmographic', title: 'Define Your Ideal Customer Profile', description: 'Set up industry, size, and geography criteria', why: 'An ICP is the foundation of your demand engine. Without it, you cannot score or prioritize accounts.', impact: 'Foundation for all targeting', action: 'Build ICP', route: '/icp-manager', priority: 95, filter: {} },
    { id: 'sync-data', category: 'quality', title: 'Connect Your Data Sources', description: 'Sync Apollo or import CRM data to populate accounts', why: 'You need account data to score and target. Apollo provides verified B2B contacts.', impact: 'Populate your pipeline', action: 'Go to Data Upload', route: '/data-upload', priority: 90, filter: {} },
    { id: 'set-personas', category: 'signal', title: 'Define Target Buyer Personas', description: 'Specify job titles and seniority levels to target', why: 'Persona targeting ensures outreach reaches decision-makers.', impact: '+30% response rates', action: 'Configure Personas', route: '/icp-manager', priority: 85, filter: {} },
    { id: 'set-geography', category: 'growth', title: 'Set Geographic Focus', description: 'Define your target markets and regions', why: 'Geographic focus prevents spreading resources too thin.', impact: 'Focused pipeline', action: 'Set Regions', route: '/icp-manager', priority: 80, filter: {} }
  ];
}

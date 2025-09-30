import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CorrelationRequest {
  org_id: string;
  icp_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, icp_id }: CorrelationRequest = await req.json();

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

    console.log('Analyzing correlations for org:', org_id);

    // Get accounts with scores
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select(`
        *,
        scores:scores(overall, fit, intent, reachability)
      `)
      .eq('org_id', org_id);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No accounts found for analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`Analyzing ${accounts.length} accounts`);

    // Get contacts to measure reachability
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('account_external_id')
      .eq('org_id', org_id);

    if (contactsError) throw contactsError;

    const contactCounts = (contacts || []).reduce((acc, c) => {
      acc[c.account_external_id] = (acc[c.account_external_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get ICP profile
    const icpQuery = supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id)
      .eq('status', 'active');
    
    if (icp_id) {
      icpQuery.eq('id', icp_id);
    }

    const { data: icpProfiles } = await icpQuery.limit(1);
    const icp = icpProfiles?.[0];

    if (!icp) {
      return new Response(
        JSON.stringify({ error: 'No active ICP profile found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Prepare data for AI analysis
    const analysisData = accounts.map(account => {
      const score = Array.isArray(account.scores) ? account.scores[0] : null;
      const contactCount = contactCounts[account.external_id] || 0;
      
      return {
        name: account.name,
        industry: account.industry_norm || account.industry_raw,
        employee_count: account.employee_count,
        revenue_range: account.revenue_range,
        country: account.country,
        score: score?.overall || 0,
        fit_score: score?.fit || 0,
        has_contacts: contactCount > 0,
        contact_count: contactCount,
        data_completeness: [
          account.industry_norm || account.industry_raw,
          account.employee_count,
          account.revenue_range,
          account.country
        ].filter(Boolean).length / 4
      };
    });

    // Use Lovable AI to analyze correlations
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiPrompt = `You are a data scientist analyzing ICP (Ideal Customer Profile) correlations.

Given this data:
- Total accounts: ${analysisData.length}
- ICP criteria: Industries [${icp.industries?.join(', ')}], Company sizes [${icp.company_sizes?.join(', ')}], Revenue ranges [${icp.revenue_ranges?.join(', ')}], Geographies [${icp.geographies?.join(', ')}]
- Account distribution: ${JSON.stringify(analysisData.slice(0, 20))}

Analyze the correlation between each ICP criterion and actual account scores. Calculate:

1. **Industry Correlation**: How well does industry match correlate with high scores?
2. **Size Correlation**: How well does company size match correlate with high scores?
3. **Revenue Correlation**: How well does revenue range match correlate with high scores?
4. **Geography Correlation**: How well does geography match correlate with high scores?
5. **Contact Availability**: How does having contacts correlate with scores?
6. **Data Quality**: How does data completeness affect scoring?

Return a JSON object with this structure:
{
  "correlations": {
    "industry": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" },
    "size": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" },
    "revenue": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" },
    "geography": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" },
    "contacts": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" },
    "data_quality": { "coefficient": 0.0-1.0, "weight": 0-100, "strength": "weak/moderate/strong" }
  },
  "recommendations": [
    "string: actionable insight 1",
    "string: actionable insight 2",
    "string: actionable insight 3"
  ],
  "top_predictors": ["criterion1", "criterion2"],
  "weak_predictors": ["criterion1"],
  "model_accuracy": 0.0-1.0
}

Base weights on actual correlation strength. Total weights should sum to 100.`;

    console.log('Calling Lovable AI for correlation analysis...');

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
            role: 'user',
            content: aiPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI Response:', aiContent);

    // Extract JSON from AI response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    const correlationAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!correlationAnalysis) {
      throw new Error('Failed to parse AI response');
    }

    // Store correlation weights in database for future use
    const { error: updateError } = await supabase
      .from('icp_profiles')
      .update({
        tam_estimate: accounts.length,
        confidence_score: Math.round((correlationAnalysis.model_accuracy || 0.5) * 100),
        match_count: accounts.filter(a => {
          const score = Array.isArray(a.scores) ? a.scores[0] : null;
          return (score?.overall || 0) >= 70;
        }).length
      })
      .eq('id', icp.id);

    if (updateError) {
      console.error('Failed to update ICP profile:', updateError);
    }

    // Log analysis to audit
    await supabase
      .from('audit_logs')
      .insert({
        org_id,
        actor: 'correlation_engine',
        action: 'correlation_analyzed',
        meta: {
          icp_id: icp.id,
          accounts_analyzed: accounts.length,
          model_accuracy: correlationAnalysis.model_accuracy,
          top_predictors: correlationAnalysis.top_predictors
        }
      });

    console.log('Correlation analysis complete');

    return new Response(
      JSON.stringify({
        success: true,
        icp_id: icp.id,
        icp_name: icp.name,
        accounts_analyzed: accounts.length,
        correlations: correlationAnalysis.correlations,
        recommendations: correlationAnalysis.recommendations,
        top_predictors: correlationAnalysis.top_predictors,
        weak_predictors: correlationAnalysis.weak_predictors,
        model_accuracy: correlationAnalysis.model_accuracy,
        analyzed_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in correlation analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

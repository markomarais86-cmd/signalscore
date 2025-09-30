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

    // Get closed won leads with their accounts
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select('external_id, status')
      .eq('org_id', org_id)
      .in('status', ['won', 'closed_won', 'qualified']);

    if (leadsError) throw leadsError;

    const wonLeadIds = new Set(
      (leads || [])
        .filter(l => l.status === 'won' || l.status === 'closed_won')
        .map(l => l.external_id)
    );

    // Get all accounts with their associated lead status
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No accounts found for analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`Analyzing ${accounts.length} accounts, ${wonLeadIds.size} closed won`);

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

    // Prepare data for statistical analysis
    const analysisData = accounts.map(account => {
      const contactCount = contactCounts[account.external_id] || 0;
      const isClosedWon = wonLeadIds.has(account.external_id);
      
      return {
        name: account.name,
        industry: account.industry_norm || account.industry_raw,
        employee_count: account.employee_count,
        revenue_range: account.revenue_range,
        country: account.country,
        is_closed_won: isClosedWon,
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

    // Calculate actual statistical correlations
    const closedWonCount = analysisData.filter(a => a.is_closed_won).length;
    
    // Helper to calculate point-biserial correlation (for binary outcome)
    const calculateCorrelation = (criterion: string, getValue: (item: any) => boolean) => {
      const matches = analysisData.filter(getValue);
      const matchWonRate = matches.filter(a => a.is_closed_won).length / matches.length;
      const noMatchWonRate = analysisData.filter(a => !getValue(a)).filter(a => a.is_closed_won).length / 
                              analysisData.filter(a => !getValue(a)).length;
      
      const correlation = matchWonRate - noMatchWonRate;
      const n = analysisData.length;
      
      // Simple significance test (chi-square approximation)
      const matchWon = matches.filter(a => a.is_closed_won).length;
      const matchTotal = matches.length;
      const noMatchWon = closedWonCount - matchWon;
      const noMatchTotal = n - matchTotal;
      
      const expected1 = (matchTotal * closedWonCount) / n;
      const expected2 = (noMatchTotal * closedWonCount) / n;
      
      const chiSquare = expected1 > 0 && expected2 > 0 ? 
        Math.pow(matchWon - expected1, 2) / expected1 + 
        Math.pow(noMatchWon - expected2, 2) / expected2 : 0;
      
      // Approximate p-value (chi-square with 1 df)
      const pValue = chiSquare > 3.841 ? 0.05 : chiSquare > 6.635 ? 0.01 : 0.1;
      
      // Handle NaN and invalid values
      const r = isNaN(correlation) ? 0 : Math.max(-1, Math.min(1, correlation));
      const matchRate = isNaN(matchWonRate) ? 0 : matchWonRate;
      const noMatchRate = isNaN(noMatchWonRate) ? 0 : noMatchWonRate;
      
      return {
        r,
        p: pValue,
        matchWonRate: matchRate,
        noMatchWonRate: noMatchRate,
        sampleSize: matchTotal
      };
    };

    const industryCorr = calculateCorrelation('industry', 
      (a) => icp.industries?.includes(a.industry) || false);
    const sizeCorr = calculateCorrelation('size', 
      (a) => icp.company_sizes?.includes(a.employee_count) || false);
    const revenueCorr = calculateCorrelation('revenue', 
      (a) => icp.revenue_ranges?.includes(a.revenue_range) || false);
    const geoCorr = calculateCorrelation('geography', 
      (a) => icp.geographies?.includes(a.country) || false);
    const contactsCorr = calculateCorrelation('contacts', (a) => a.has_contacts);
    const dataQualityCorr = calculateCorrelation('data_quality', (a) => a.data_completeness >= 0.75);

    // Use Lovable AI to analyze correlations
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiPrompt = `You are a statistician analyzing ICP (Ideal Customer Profile) effectiveness based on ACTUAL CLOSED WON DEALS.

STATISTICAL CORRELATION ANALYSIS:
- Total accounts: ${analysisData.length}
- Closed won deals: ${closedWonCount}
- Win rate: ${((closedWonCount / analysisData.length) * 100).toFixed(1)}%

ICP CRITERIA CORRELATIONS (with closed won outcomes):

1. **Industry Match** → Closed Won
   - R = ${industryCorr.r.toFixed(3)}, P = ${industryCorr.p.toFixed(3)}
   - Win rate when matched: ${(industryCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate when not matched: ${(industryCorr.noMatchWonRate * 100).toFixed(1)}%
   - Sample size: ${industryCorr.sampleSize}

2. **Company Size Match** → Closed Won
   - R = ${sizeCorr.r.toFixed(3)}, P = ${sizeCorr.p.toFixed(3)}
   - Win rate when matched: ${(sizeCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate when not matched: ${(sizeCorr.noMatchWonRate * 100).toFixed(1)}%
   - Sample size: ${sizeCorr.sampleSize}

3. **Revenue Range Match** → Closed Won
   - R = ${revenueCorr.r.toFixed(3)}, P = ${revenueCorr.p.toFixed(3)}
   - Win rate when matched: ${(revenueCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate when not matched: ${(revenueCorr.noMatchWonRate * 100).toFixed(1)}%
   - Sample size: ${revenueCorr.sampleSize}

4. **Geography Match** → Closed Won
   - R = ${geoCorr.r.toFixed(3)}, P = ${geoCorr.p.toFixed(3)}
   - Win rate when matched: ${(geoCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate when not matched: ${(geoCorr.noMatchWonRate * 100).toFixed(1)}%
   - Sample size: ${geoCorr.sampleSize}

5. **Contact Availability** → Closed Won
   - R = ${contactsCorr.r.toFixed(3)}, P = ${contactsCorr.p.toFixed(3)}
   - Win rate with contacts: ${(contactsCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate without contacts: ${(contactsCorr.noMatchWonRate * 100).toFixed(1)}%

6. **Data Quality** → Closed Won
   - R = ${dataQualityCorr.r.toFixed(3)}, P = ${dataQualityCorr.p.toFixed(3)}
   - Win rate with complete data: ${(dataQualityCorr.matchWonRate * 100).toFixed(1)}%
   - Win rate with incomplete data: ${(dataQualityCorr.noMatchWonRate * 100).toFixed(1)}%

Based on these STATISTICAL CORRELATIONS, assign weights that sum to 100. Higher R values (closer to 1) and lower P values (< 0.05 = significant) should get MORE weight.

Return JSON:
{
  "correlations": {
    "industry": { "coefficient": ${industryCorr.r}, "p_value": ${industryCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean },
    "size": { "coefficient": ${sizeCorr.r}, "p_value": ${sizeCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean },
    "revenue": { "coefficient": ${revenueCorr.r}, "p_value": ${revenueCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean },
    "geography": { "coefficient": ${geoCorr.r}, "p_value": ${geoCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean },
    "contacts": { "coefficient": ${contactsCorr.r}, "p_value": ${contactsCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean },
    "data_quality": { "coefficient": ${dataQualityCorr.r}, "p_value": ${dataQualityCorr.p}, "weight": 0-100, "strength": "weak/moderate/strong", "significant": boolean }
  },
  "recommendations": ["insight 1", "insight 2", "insight 3"],
  "top_predictors": ["criterion1", "criterion2"],
  "weak_predictors": ["criterion1"],
  "model_accuracy": 0.0-1.0
}

Mark significant=true if p < 0.05. Strength: strong if |r| > 0.5, moderate if > 0.3, else weak.`;

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

    // Store correlation weights and statistics in database
    const { error: updateError } = await supabase
      .from('icp_profiles')
      .update({
        tam_estimate: accounts.length,
        confidence_score: Math.round((correlationAnalysis.model_accuracy || 0.5) * 100),
        match_count: closedWonCount
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
        closed_won_count: closedWonCount,
        win_rate: closedWonCount / accounts.length,
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

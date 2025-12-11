import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentDecision {
  account_id: string;
  priority: 'high' | 'medium' | 'low';
  missing_fields: string[];
  estimated_data: {
    employee_count?: number;
    revenue_range?: string;
    industry?: string;
  };
  confidence: number;
  reasoning: string;
}

async function prioritizeEnrichmentWithAI(
  accounts: any[]
): Promise<EnrichmentDecision[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY || accounts.length === 0) {
    console.log('[Enrichment AI] No API key or accounts, using rule-based fallback');
    return accounts.map(account => ({
      account_id: account.id,
      priority: 'medium' as const,
      missing_fields: [
        !account.employee_count && 'employee_count',
        !account.revenue_range && 'revenue_range',
        !account.industry_raw && 'industry'
      ].filter(Boolean) as string[],
      estimated_data: {},
      confidence: 0,
      reasoning: 'Rule-based: Account has missing firmographic data'
    }));
  }

  const accountsContext = accounts.slice(0, 15).map(account => ({
    account_id: account.id,
    external_id: account.external_id,
    name: account.name,
    domain: account.domain,
    current_industry: account.industry_raw,
    current_employee_count: account.employee_count,
    current_revenue_range: account.revenue_range,
    icp_qualified: account.icp_qualified,
    propensity_score: account.propensity_score,
    missing_fields: [
      !account.employee_count && 'employee_count',
      !account.revenue_range && 'revenue_range',
      !account.industry_raw && 'industry'
    ].filter(Boolean)
  }));

  const systemPrompt = `You are an AI data enrichment specialist. Your job is to:

1. Prioritize accounts for enrichment based on:
   - ICP qualification status (prioritize ICP accounts)
   - Propensity score (higher scores = higher priority)
   - Number of missing fields
   - Domain quality (established domains over generic)

2. For accounts with domains, estimate missing data:
   - Employee count: Estimate based on domain, industry patterns
   - Revenue range: Estimate based on employee count, industry
   - Industry: Infer from company name and domain

3. Provide confidence scores (0-100) for estimates

Revenue ranges: "$1M-$10M", "$10M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B+"

Be conservative with estimates. Only provide data you're reasonably confident about (>60%).`;

  const userPrompt = `Analyze these ${accountsContext.length} accounts and prioritize for enrichment:

${JSON.stringify(accountsContext, null, 2)}

Use the enrichment_decisions tool to return your analysis with priority, estimated data where confident, and reasoning.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'enrichment_decisions',
            description: 'Return enrichment priorities and AI-estimated data',
            parameters: {
              type: 'object',
              properties: {
                decisions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      account_id: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      missing_fields: { type: 'array', items: { type: 'string' } },
                      estimated_data: {
                        type: 'object',
                        properties: {
                          employee_count: { type: 'number' },
                          revenue_range: { type: 'string' },
                          industry: { type: 'string' }
                        }
                      },
                      confidence: { type: 'number' },
                      reasoning: { type: 'string' }
                    },
                    required: ['account_id', 'priority', 'missing_fields', 'confidence', 'reasoning']
                  }
                }
              },
              required: ['decisions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'enrichment_decisions' } }
      })
    });

    if (!response.ok) {
      console.error('[Enrichment AI] API error:', response.status);
      throw new Error('AI API error');
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`[Enrichment AI] Analyzed ${parsed.decisions?.length || 0} accounts`);
      return parsed.decisions || [];
    }

    throw new Error('No tool call in response');
  } catch (error) {
    console.error('[Enrichment AI] Error, using fallback:', error);
    return accounts.map(account => ({
      account_id: account.id,
      priority: 'medium' as const,
      missing_fields: [
        !account.employee_count && 'employee_count',
        !account.revenue_range && 'revenue_range',
        !account.industry_raw && 'industry'
      ].filter(Boolean) as string[],
      estimated_data: {},
      confidence: 0,
      reasoning: 'Rule-based fallback: AI unavailable'
    }));
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { agent_id, org_id, run_id } = await req.json();

    console.log(`[Data Enrichment Agent] Starting AI-powered run for agent ${agent_id}, org ${org_id}`);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${agentError?.message}`);
    }

    // Use existing run record if provided
    let run;
    if (run_id) {
      const { data, error } = await supabase
        .from('ai_agent_runs')
        .select()
        .eq('id', run_id)
        .single();
      
      if (error) throw error;
      run = data;
    } else {
      const { data, error } = await supabase
        .from('ai_agent_runs')
        .insert({
          agent_id,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      run = data;
    }

    const batchSize = agent.parameters?.batch_size || 50;
    let recordsProcessed = 0;
    let recordsAffected = 0;
    let aiEstimatesApplied = 0;
    let apiEnrichmentsTriggered = 0;

    // Find accounts missing firmographic data
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, external_id, name, domain, industry_raw, employee_count, revenue_range, icp_qualified, propensity_score')
      .eq('org_id', org_id)
      .or('industry_raw.is.null,employee_count.is.null,revenue_range.is.null')
      .limit(batchSize);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    if (accounts && accounts.length > 0) {
      console.log(`[Data Enrichment Agent] Analyzing ${accounts.length} accounts with AI`);

      // Get AI prioritization and estimates
      const decisions = await prioritizeEnrichmentWithAI(accounts);

      // Process by priority
      const highPriority = decisions.filter(d => d.priority === 'high');
      const mediumPriority = decisions.filter(d => d.priority === 'medium');

      for (const decision of [...highPriority, ...mediumPriority]) {
        const account = accounts.find(a => a.id === decision.account_id);
        if (!account) continue;

        try {
          recordsProcessed++;

          // If AI has high confidence estimates, apply them directly
          if (decision.confidence >= 70 && decision.estimated_data && Object.keys(decision.estimated_data).length > 0) {
            const updateData: any = {
              enriched_from: 'ai_estimation',
              enriched_at: new Date().toISOString(),
              enrichment_confidence: decision.confidence
            };

            if (decision.estimated_data.employee_count && !account.employee_count) {
              updateData.employee_count = decision.estimated_data.employee_count;
            }
            if (decision.estimated_data.revenue_range && !account.revenue_range) {
              updateData.revenue_range = decision.estimated_data.revenue_range;
            }
            if (decision.estimated_data.industry && !account.industry_raw) {
              updateData.industry_raw = decision.estimated_data.industry;
            }

            if (Object.keys(updateData).length > 3) {
              const { error: updateError } = await supabase
                .from('accounts')
                .update(updateData)
                .eq('id', account.id);

              if (!updateError) {
                aiEstimatesApplied++;
                recordsAffected++;
                console.log(`[Data Enrichment] AI enriched ${account.name} with confidence ${decision.confidence}%`);
              }
            }
          }

          // For high priority accounts with domain, also try API enrichment
          if (decision.priority === 'high' && account.domain) {
            const { error: enrichError } = await supabase.functions.invoke('smart-enrich', {
              body: {
                org_id,
                account_external_id: account.external_id,
                domain: account.domain
              }
            });

            if (!enrichError) {
              apiEnrichmentsTriggered++;
              if (decision.confidence < 70) {
                recordsAffected++;
              }
            }
          }
        } catch (error) {
          console.error(`Error enriching account ${account.id}:`, error);
        }
      }
    }

    // Update run with results
    await supabase
      .from('ai_agent_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        results: {
          accounts_analyzed: accounts?.length || 0,
          ai_estimates_applied: aiEstimatesApplied,
          api_enrichments_triggered: apiEnrichmentsTriggered,
          ai_powered: true,
          batch_size: batchSize
        }
      })
      .eq('id', run.id);

    // Update agent timestamps
    const { data: nextRunCalc } = await supabase.rpc('calculate_next_run', {
      schedule: agent.schedule,
      last_run: new Date().toISOString()
    });

    await supabase
      .from('ai_agents')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunCalc,
        status: 'active'
      })
      .eq('id', agent_id);

    console.log(`[Data Enrichment Agent] Completed: ${aiEstimatesApplied} AI estimates, ${apiEnrichmentsTriggered} API calls`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        ai_estimates_applied: aiEstimatesApplied,
        api_enrichments_triggered: apiEnrichmentsTriggered,
        ai_powered: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Data Enrichment Agent] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

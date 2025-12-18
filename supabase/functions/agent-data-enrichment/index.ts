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

// Direct Apollo API enrichment for a single account
async function enrichWithApollo(domain: string): Promise<{
  employee_count?: number;
  revenue_range?: string;
  industry?: string;
} | null> {
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!APOLLO_API_KEY) {
    console.log('[Apollo] No API key configured');
    return null;
  }

  try {
    console.log(`[Apollo] Enriching domain: ${domain}`);
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_API_KEY
      },
      body: JSON.stringify({ domain })
    });

    if (!response.ok) {
      console.log(`[Apollo] API error for ${domain}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const org = data.organization;
    
    if (!org) {
      console.log(`[Apollo] No organization found for ${domain}`);
      return null;
    }

    const result: { employee_count?: number; revenue_range?: string; industry?: string } = {};
    
    if (org.estimated_num_employees) {
      result.employee_count = org.estimated_num_employees;
    }
    
    if (org.annual_revenue_printed) {
      result.revenue_range = org.annual_revenue_printed;
    } else if (org.annual_revenue) {
      // Map to revenue ranges
      const rev = org.annual_revenue;
      if (rev < 10000000) result.revenue_range = '$1M-$10M';
      else if (rev < 50000000) result.revenue_range = '$10M-$50M';
      else if (rev < 100000000) result.revenue_range = '$50M-$100M';
      else if (rev < 500000000) result.revenue_range = '$100M-$500M';
      else if (rev < 1000000000) result.revenue_range = '$500M-$1B';
      else result.revenue_range = '$1B+';
    }
    
    if (org.industry) {
      result.industry = org.industry;
    }

    console.log(`[Apollo] Enriched ${domain}:`, result);
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error(`[Apollo] Error enriching ${domain}:`, error);
    return null;
  }
}

// Direct PDL API enrichment as fallback
async function enrichWithPDL(domain: string): Promise<{
  employee_count?: number;
  revenue_range?: string;
  industry?: string;
} | null> {
  const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
  if (!PDL_API_KEY) {
    console.log('[PDL] No API key configured');
    return null;
  }

  try {
    console.log(`[PDL] Enriching domain: ${domain}`);
    const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
      headers: {
        'X-Api-Key': PDL_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`[PDL] API error for ${domain}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data || data.status !== 200) {
      console.log(`[PDL] No data found for ${domain}`);
      return null;
    }

    const result: { employee_count?: number; revenue_range?: string; industry?: string } = {};
    
    if (data.employee_count) {
      result.employee_count = data.employee_count;
    }
    
    if (data.estimated_annual_revenue) {
      result.revenue_range = data.estimated_annual_revenue;
    }
    
    if (data.industry) {
      result.industry = data.industry;
    }

    console.log(`[PDL] Enriched ${domain}:`, result);
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error(`[PDL] Error enriching ${domain}:`, error);
    return null;
  }
}

async function prioritizeEnrichmentWithAI(
  accounts: any[]
): Promise<EnrichmentDecision[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY || accounts.length === 0) {
    console.log('[Enrichment AI] No API key or accounts, using rule-based fallback');
    return accounts.map(account => ({
      account_id: account.id,
      priority: account.icp_qualified ? 'high' as const : 'medium' as const,
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

Be reasonably confident with estimates. Provide data you're at least 50% confident about.`;

  const userPrompt = `Analyze these ${accountsContext.length} accounts and prioritize for enrichment:

${JSON.stringify(accountsContext, null, 2)}

Use the enrichment_decisions tool to return your analysis with priority, estimated data where confident, and reasoning.`;

  try {
    console.log(`[Enrichment AI] Sending ${accountsContext.length} accounts to AI for analysis`);
    
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
      console.error('[Enrichment AI] API error:', response.status, await response.text());
      throw new Error('AI API error');
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`[Enrichment AI] AI returned ${parsed.decisions?.length || 0} decisions`);
      
      // Log confidence distribution
      const decisions = parsed.decisions || [];
      const highConf = decisions.filter((d: any) => d.confidence >= 50).length;
      console.log(`[Enrichment AI] ${highConf}/${decisions.length} have confidence >= 50%`);
      
      return decisions;
    }

    throw new Error('No tool call in response');
  } catch (error) {
    console.error('[Enrichment AI] Error, using fallback:', error);
    return accounts.map(account => ({
      account_id: account.id,
      priority: account.icp_qualified ? 'high' as const : 'medium' as const,
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

    console.log(`[Data Enrichment Agent] ========== STARTING RUN ==========`);
    console.log(`[Data Enrichment Agent] Agent: ${agent_id}, Org: ${org_id}`);

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
    let apolloEnrichments = 0;
    let pdlEnrichments = 0;

    // Find accounts missing firmographic data
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, external_id, name, domain, industry_raw, employee_count, revenue_range, icp_qualified, propensity_score')
      .eq('org_id', org_id)
      .or('industry_raw.is.null,employee_count.is.null,revenue_range.is.null')
      .limit(batchSize);

    if (accountsError) {
      console.error('[Data Enrichment Agent] Error fetching accounts:', accountsError);
      throw accountsError;
    }

    console.log(`[Data Enrichment Agent] Found ${accounts?.length || 0} accounts needing enrichment`);

    if (accounts && accounts.length > 0) {
      // Get AI prioritization and estimates
      const decisions = await prioritizeEnrichmentWithAI(accounts);
      console.log(`[Data Enrichment Agent] Processing ${decisions.length} AI decisions`);

      // Process by priority
      const highPriority = decisions.filter(d => d.priority === 'high');
      const mediumPriority = decisions.filter(d => d.priority === 'medium');
      console.log(`[Data Enrichment Agent] Priority breakdown: ${highPriority.length} high, ${mediumPriority.length} medium`);

      for (const decision of [...highPriority, ...mediumPriority]) {
        const account = accounts.find(a => a.id === decision.account_id);
        if (!account) {
          console.log(`[Data Enrichment Agent] Account ${decision.account_id} not found in list, skipping`);
          continue;
        }

        try {
          recordsProcessed++;
          let enrichedThisAccount = false;
          let enrichedFields: string[] = [];
          const updateData: any = {};

          console.log(`[Data Enrichment Agent] Processing: ${account.name} (${account.domain || 'no domain'}) - priority: ${decision.priority}, confidence: ${decision.confidence}%`);

          // PRIORITY FIX: Try API enrichment FIRST for accounts with valid domains
          // This ensures we use real data from Apollo/PDL when available
          if (account.domain && account.domain.length > 3 && !account.domain.includes('example')) {
            console.log(`[Data Enrichment Agent] Attempting API enrichment first for: ${account.name} (${account.domain})`);
            
            // Try Apollo first (prioritize real data)
            const apolloData = await enrichWithApollo(account.domain);
            if (apolloData && Object.keys(apolloData).length > 0) {
              if (apolloData.employee_count && !account.employee_count) {
                updateData.employee_count = apolloData.employee_count;
                enrichedFields.push('employee_count');
              }
              if (apolloData.revenue_range && !account.revenue_range) {
                updateData.revenue_range = apolloData.revenue_range;
                enrichedFields.push('revenue_range');
              }
              if (apolloData.industry && !account.industry_raw) {
                updateData.industry_raw = apolloData.industry;
                enrichedFields.push('industry');
              }
              
              if (enrichedFields.length > 0) {
                updateData.enriched_from = 'apollo';
                updateData.enriched_at = new Date().toISOString();
                updateData.enrichment_confidence = 95; // High confidence for API data
                
                const { error: updateError } = await supabase
                  .from('accounts')
                  .update(updateData)
                  .eq('id', account.id);
                  
                if (!updateError) {
                  apolloEnrichments++;
                  recordsAffected++;
                  enrichedThisAccount = true;
                  console.log(`[Data Enrichment Agent] ✓ Apollo enriched ${account.name}: ${enrichedFields.join(', ')}`);
                } else {
                  console.error(`[Data Enrichment Agent] Apollo update failed for ${account.name}:`, updateError);
                }
              }
            }
            
            // Fall back to PDL if Apollo didn't provide data
            if (!enrichedThisAccount) {
              const pdlData = await enrichWithPDL(account.domain);
              if (pdlData && Object.keys(pdlData).length > 0) {
                enrichedFields = [];
                const pdlUpdateData: any = {};
                
                if (pdlData.employee_count && !account.employee_count) {
                  pdlUpdateData.employee_count = pdlData.employee_count;
                  enrichedFields.push('employee_count');
                }
                if (pdlData.revenue_range && !account.revenue_range) {
                  pdlUpdateData.revenue_range = pdlData.revenue_range;
                  enrichedFields.push('revenue_range');
                }
                if (pdlData.industry && !account.industry_raw) {
                  pdlUpdateData.industry_raw = pdlData.industry;
                  enrichedFields.push('industry');
                }
                
                if (enrichedFields.length > 0) {
                  pdlUpdateData.enriched_from = 'pdl';
                  pdlUpdateData.enriched_at = new Date().toISOString();
                  pdlUpdateData.enrichment_confidence = 90; // High confidence for API data
                  
                  const { error: updateError } = await supabase
                    .from('accounts')
                    .update(pdlUpdateData)
                    .eq('id', account.id);
                    
                  if (!updateError) {
                    pdlEnrichments++;
                    recordsAffected++;
                    enrichedThisAccount = true;
                    console.log(`[Data Enrichment Agent] ✓ PDL enriched ${account.name}: ${enrichedFields.join(', ')}`);
                  } else {
                    console.error(`[Data Enrichment Agent] PDL update failed for ${account.name}:`, updateError);
                  }
                }
              }
            }
          }

          // FALLBACK: Use AI estimates if API enrichment didn't work and confidence >= 50%
          if (!enrichedThisAccount && decision.confidence >= 50 && decision.estimated_data && Object.keys(decision.estimated_data).length > 0) {
            console.log(`[Data Enrichment Agent] Falling back to AI estimates for ${account.name}:`, decision.estimated_data);
            enrichedFields = [];
            const aiUpdateData: any = {};
            
            if (decision.estimated_data.employee_count && !account.employee_count) {
              aiUpdateData.employee_count = decision.estimated_data.employee_count;
              enrichedFields.push('employee_count');
            }
            if (decision.estimated_data.revenue_range && !account.revenue_range) {
              aiUpdateData.revenue_range = decision.estimated_data.revenue_range;
              enrichedFields.push('revenue_range');
            }
            if (decision.estimated_data.industry && !account.industry_raw) {
              aiUpdateData.industry_raw = decision.estimated_data.industry;
              enrichedFields.push('industry');
            }

            if (enrichedFields.length > 0) {
              aiUpdateData.enriched_from = 'ai_estimation';
              aiUpdateData.enriched_at = new Date().toISOString();
              aiUpdateData.enrichment_confidence = decision.confidence;
              
              const { error: updateError } = await supabase
                .from('accounts')
                .update(aiUpdateData)
                .eq('id', account.id);

              if (!updateError) {
                aiEstimatesApplied++;
                recordsAffected++;
                enrichedThisAccount = true;
                console.log(`[Data Enrichment Agent] ✓ AI enriched ${account.name}: ${enrichedFields.join(', ')}`);
              } else {
                console.error(`[Data Enrichment Agent] AI update failed for ${account.name}:`, updateError);
              }
            }
          }

          if (!enrichedThisAccount) {
            console.log(`[Data Enrichment Agent] Could not enrich ${account.name} - no domain or no data available`);
          }
        } catch (error) {
          console.error(`[Data Enrichment Agent] Error processing account ${account.id}:`, error);
        }
      }
    }

    console.log(`[Data Enrichment Agent] ========== RUN COMPLETE ==========`);
    console.log(`[Data Enrichment Agent] Processed: ${recordsProcessed}, Affected: ${recordsAffected}`);
    console.log(`[Data Enrichment Agent] AI estimates: ${aiEstimatesApplied}, Apollo: ${apolloEnrichments}, PDL: ${pdlEnrichments}`);

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
          apollo_enrichments: apolloEnrichments,
          pdl_enrichments: pdlEnrichments,
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

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        ai_estimates_applied: aiEstimatesApplied,
        apollo_enrichments: apolloEnrichments,
        pdl_enrichments: pdlEnrichments,
        ai_powered: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Data Enrichment Agent] Fatal Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

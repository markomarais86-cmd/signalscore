import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Hard timeout: leave 10s buffer before edge function limit
const MAX_RUNTIME_MS = 45_000;

interface LeadQualificationDecision {
  lead_id: number;
  qualified: boolean;
  confidence: number;
  reasoning: string;
}

interface AIQualificationResult {
  decisions: LeadQualificationDecision[];
  summary: string;
}

async function qualifyLeadsWithAI(
  leads: any[],
  scoreMap: Map<string, number>,
  icpCriteria: any
): Promise<AIQualificationResult | null> {
  if (!LOVABLE_API_KEY) {
    console.log('[agent-lead-qualification] No LOVABLE_API_KEY, falling back to rule-based');
    return null;
  }

  const leadsContext = leads.map(lead => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    title: lead.title || 'Unknown',
    company: lead.company_name || 'Unknown',
    account_score: scoreMap.get(lead.account_external_id) || 0,
    account_external_id: lead.account_external_id,
    status: lead.status
  }));

  const systemPrompt = `You are an expert B2B lead qualification analyst. Your job is to analyze leads and determine if they should be qualified based on their fit with the Ideal Customer Profile (ICP).

Consider these factors when qualifying leads:
1. Account Fit Score (higher is better, 70+ is good)
2. Lead's title/role alignment with typical decision makers
3. Company context and potential value

Be decisive but fair. Provide clear, specific reasoning for each decision.`;

  const userPrompt = `Analyze these ${leads.length} leads and decide which should be qualified.

ICP Criteria:
${JSON.stringify(icpCriteria, null, 2)}

Leads to evaluate:
${JSON.stringify(leadsContext, null, 2)}

For each lead, decide if they should be qualified and explain why.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout for AI call

    const response = await fetch(AI_GATEWAY_URL, {
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
            name: 'qualify_leads',
            description: 'Submit qualification decisions for the analyzed leads',
            parameters: {
              type: 'object',
              properties: {
                decisions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      lead_id: { type: 'number', description: 'The lead ID' },
                      qualified: { type: 'boolean', description: 'Whether the lead should be qualified' },
                      confidence: { type: 'number', description: 'Confidence score 0-1' },
                      reasoning: { type: 'string', description: 'Explanation for the decision' }
                    },
                    required: ['lead_id', 'qualified', 'confidence', 'reasoning']
                  }
                },
                summary: { type: 'string', description: 'Overall summary of the qualification batch' }
              },
              required: ['decisions', 'summary']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'qualify_leads' } }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[agent-lead-qualification] AI Gateway error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[agent-lead-qualification] No tool call in AI response');
      return null;
    }

    const result = JSON.parse(toolCall.function.arguments) as AIQualificationResult;
    console.log(`[agent-lead-qualification] AI analyzed ${result.decisions.length} leads`);
    return result;

  } catch (error) {
    console.error('[agent-lead-qualification] AI call failed:', error);
    return null;
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

  const startTime = Date.now();
  let runId: string | null = null;

  try {
    const { agent_id, org_id, run_id } = await req.json();

    console.log(`[agent-lead-qualification] Starting for agent ${agent_id}, org ${org_id}, run_id ${run_id}`);

    // Resolve parent org for shared data (leads/accounts live under parent)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('parent_org_id')
      .eq('id', org_id)
      .single();
    const dataOrgId = orgData?.parent_org_id || org_id;
    console.log(`[agent-lead-qualification] Data org: ${dataOrgId} (child: ${dataOrgId !== org_id})`);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      console.error('[agent-lead-qualification] Failed to fetch agent:', agentError);
      throw new Error(`Agent not found: ${agentError?.message}`);
    }

    console.log(`[agent-lead-qualification] Agent loaded: ${agent.name}`);

    // Use existing run record if provided, otherwise create new one
    let run;
    if (run_id) {
      const { data, error } = await supabase
        .from('ai_agent_runs')
        .select()
        .eq('id', run_id)
        .single();
      
      if (error) {
        console.error('[agent-lead-qualification] Failed to fetch run record:', error);
        throw error;
      }
      run = data;
      runId = run_id;
      console.log(`[agent-lead-qualification] Using existing run record: ${run_id}`);
    } else {
      const { data, error: runError } = await supabase
        .from('ai_agent_runs')
        .insert({
          agent_id,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (runError || !data) {
        console.error('[agent-lead-qualification] Failed to create run record:', runError);
        throw new Error(`Failed to create run record: ${runError?.message}`);
      }
      run = data;
      runId = run.id;
      console.log(`[agent-lead-qualification] Created new run record: ${run.id}`);
    }

    // Adaptive threshold: if org has < 50 accounts scoring >= 70, lower to 50
    let minScoreThreshold = agent.parameters?.min_score_threshold || 70;
    
    const { count: highScoreCount } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .gte('overall', 70);

    if ((highScoreCount || 0) < 50) {
      const adaptedThreshold = 50;
      console.log(`[agent-lead-qualification] Only ${highScoreCount} accounts score >= 70, adapting threshold from ${minScoreThreshold} to ${adaptedThreshold}`);
      minScoreThreshold = adaptedThreshold;
    }

    console.log(`[agent-lead-qualification] Score threshold: ${minScoreThreshold}`);
    
    let recordsProcessed = 0;
    let recordsAffected = 0;
    let aiQualified = 0;
    let aiRejected = 0;
    let aiSummary = '';

    // Get high-fit account scores
    console.log(`[agent-lead-qualification] Step 1: Finding high-fit accounts with score >= ${minScoreThreshold}`);
    
    const { data: highFitScores, error: scoresError } = await supabase
      .from('scores')
      .select('account_external_id, overall')
      .eq('org_id', org_id)
      .gte('overall', minScoreThreshold)
      .order('overall', { ascending: false })
      .limit(1000);

    if (scoresError) {
      console.error('[agent-lead-qualification] Error fetching high-fit scores:', scoresError);
      throw scoresError;
    }

    const highFitAccountIds = highFitScores?.map(s => s.account_external_id).filter(Boolean) || [];
    const scoreMap = new Map(highFitScores?.map(s => [s.account_external_id, s.overall]) || []);
    console.log(`[agent-lead-qualification] Found ${highFitAccountIds.length} high-fit accounts`);

    if (highFitAccountIds.length === 0) {
      console.log('[agent-lead-qualification] No high-fit accounts found, skipping lead qualification');
    }

    // Get leads at high-fit accounts
    let leads: any[] = [];
    if (highFitAccountIds.length > 0) {
      const { data: leadsData, error: leadsError } = await supabase
        .from('Leads')
        .select('id, external_id, name, email, title, company_name, account_external_id, status')
        .eq('org_id', dataOrgId)
        .in('status', ['open', 'new'])
        .in('account_external_id', highFitAccountIds)
        .limit(500);

      if (leadsError) {
        console.error('[agent-lead-qualification] Error fetching leads:', leadsError);
        throw leadsError;
      }
      
      leads = leadsData || [];
    }
    
    console.log(`[agent-lead-qualification] Found ${leads.length} leads at high-fit accounts`);

    // Fetch active ICP criteria for AI context
    const { data: icpProfiles } = await supabase
      .from('icp_profiles')
      .select('name, industries, company_sizes, geographies, persona_job_titles, persona_seniority_levels')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .limit(3);

    const icpCriteria = icpProfiles?.[0] || { name: 'Default ICP' };

    if (leads && leads.length > 0) {
      console.log(`[agent-lead-qualification] Processing ${leads.length} leads with AI`);

      // Process in batches of 20 for AI
      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < leads.length; i += batchSize) {
        batches.push(leads.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        // Check timeout before each batch
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          console.log(`[agent-lead-qualification] ⏰ Timeout approaching after ${recordsProcessed} leads, stopping gracefully`);
          break;
        }

        recordsProcessed += batch.length;

        // Try AI-powered qualification
        const aiResult = await qualifyLeadsWithAI(batch, scoreMap, icpCriteria);

        if (aiResult) {
          // AI succeeded - use its decisions
          aiSummary = aiResult.summary;
          
          for (const decision of aiResult.decisions) {
            const lead = batch.find(l => l.id === decision.lead_id);
            if (!lead) continue;

            if (decision.qualified) {
              aiQualified++;
              const { error: updateError } = await supabase
                .from('Leads')
                .update({ 
                  status: 'qualified',
                  match_reasoning: decision.reasoning
                })
                .eq('id', lead.id);

              if (updateError) {
                console.error(`[agent-lead-qualification] Failed to update lead ${lead.id}:`, updateError);
              } else {
                recordsAffected++;
                console.log(`[agent-lead-qualification] AI Qualified: ${lead.name} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
              }
            } else {
              aiRejected++;
              // Store reasoning even for rejected leads
              await supabase
                .from('Leads')
                .update({ match_reasoning: `[Not Qualified] ${decision.reasoning}` })
                .eq('id', lead.id);
              
              console.log(`[agent-lead-qualification] AI Rejected: ${lead.name} - ${decision.reasoning}`);
            }
          }
        } else {
          // Fallback to rule-based qualification
          console.log('[agent-lead-qualification] Using rule-based fallback');
          
          for (const lead of batch) {
            const score = scoreMap.get(lead.account_external_id) || 0;
            
            const { error: updateError } = await supabase
              .from('Leads')
              .update({ 
                status: 'qualified',
                match_reasoning: `Auto-qualified: Account score ${score} exceeds threshold ${minScoreThreshold}`
              })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`[agent-lead-qualification] Failed to update lead ${lead.id}:`, updateError);
            } else {
              recordsAffected++;
              console.log(`[agent-lead-qualification] Rule-based qualified: ${lead.name} (score: ${score})`);
            }
          }
        }
      }
    }

    // Always mark run as completed — never leave it stuck
    const runResults = {
      leads_processed: recordsProcessed,
      leads_qualified: recordsAffected,
      ai_qualified: aiQualified,
      ai_rejected: aiRejected,
      threshold: minScoreThreshold,
      adapted_threshold: (highScoreCount || 0) < 50,
      ai_powered: aiQualified > 0 || aiRejected > 0,
      ai_summary: aiSummary || 'No AI analysis performed',
      timed_out: Date.now() - startTime > MAX_RUNTIME_MS,
    };

    await supabase
      .from('ai_agent_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        results: runResults
      })
      .eq('id', run.id);

    // Update agent last_run and next_run
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

    console.log(`[agent-lead-qualification] Completed: ${recordsAffected}/${recordsProcessed} leads qualified (AI: ${aiQualified} qualified, ${aiRejected} rejected)`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        ai_powered: runResults.ai_powered,
        ai_summary: aiSummary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[agent-lead-qualification] Fatal error:', error);

    // CRITICAL: Always mark the run as failed so it doesn't stay stuck
    if (runId) {
      try {
        await supabase
          .from('ai_agent_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', runId);
        console.log(`[agent-lead-qualification] Marked run ${runId} as failed`);
      } catch (updateErr) {
        console.error('[agent-lead-qualification] Failed to mark run as failed:', updateErr);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

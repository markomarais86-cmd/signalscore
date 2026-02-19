import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FollowUpDecision {
  lead_id: number;
  priority: 'high' | 'medium' | 'low';
  approach: string;
  reasoning: string;
  suggested_action: string;
}

async function prioritizeFollowUpsWithAI(
  leads: any[],
  accounts: Map<string, any>
): Promise<FollowUpDecision[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY || leads.length === 0) {
    console.log('[Follow-Up AI] No API key or leads, using rule-based fallback');
    return leads.map(lead => ({
      lead_id: lead.id,
      priority: 'medium' as const,
      approach: 'standard_followup',
      reasoning: 'Rule-based: Lead requires follow-up based on time since last contact',
      suggested_action: 'Send follow-up email'
    }));
  }

  const leadsContext = leads.slice(0, 20).map(lead => {
    const account = accounts.get(lead.account_external_id);
    return {
      lead_id: lead.id,
      name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      title: lead.title,
      email: lead.email,
      status: lead.status,
      last_updated: lead.updated_at,
      account_name: account?.name,
      account_industry: account?.industry_raw,
      account_score: account?.propensity_score,
      icp_qualified: account?.icp_qualified,
      days_since_update: Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    };
  });

  const systemPrompt = `You are an AI sales assistant that prioritizes follow-ups based on urgency and conversion potential.

Analyze each lead and determine:
1. Priority (high/medium/low) based on:
   - Account score and ICP qualification
   - Time since last contact (urgency)
   - Title/seniority (decision-maker potential)
   - Industry fit

2. Approach - suggest the best follow-up type:
   - "personalized_value" - for high-value leads
   - "quick_check_in" - for warm leads
   - "re_engagement" - for cold leads
   - "escalate_to_manager" - for stuck deals

3. Reasoning - explain why this lead needs attention now

4. Suggested action - specific next step`;

  const userPrompt = `Analyze these ${leadsContext.length} leads and prioritize them for follow-up:

${JSON.stringify(leadsContext, null, 2)}

Use the prioritize_followups tool to return your analysis.`;

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
            name: 'prioritize_followups',
            description: 'Prioritize leads for follow-up with reasoning',
            parameters: {
              type: 'object',
              properties: {
                decisions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      lead_id: { type: 'number' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      approach: { type: 'string', enum: ['personalized_value', 'quick_check_in', 're_engagement', 'escalate_to_manager'] },
                      reasoning: { type: 'string' },
                      suggested_action: { type: 'string' }
                    },
                    required: ['lead_id', 'priority', 'approach', 'reasoning', 'suggested_action']
                  }
                }
              },
              required: ['decisions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'prioritize_followups' } }
      })
    });

    if (!response.ok) {
      console.error('[Follow-Up AI] API error:', response.status);
      throw new Error('AI API error');
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`[Follow-Up AI] Prioritized ${parsed.decisions?.length || 0} leads`);
      return parsed.decisions || [];
    }

    throw new Error('No tool call in response');
  } catch (error) {
    console.error('[Follow-Up AI] Error, using fallback:', error);
    return leads.map(lead => ({
      lead_id: lead.id,
      priority: 'medium' as const,
      approach: 'standard_followup',
      reasoning: 'Rule-based fallback: AI unavailable',
      suggested_action: 'Send follow-up email'
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

    console.log(`[Follow-Up Agent] Starting AI-powered run for agent ${agent_id}, org ${org_id}`);

    // Resolve parent org for shared data (leads/accounts live under parent)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('parent_org_id')
      .eq('id', org_id)
      .single();
    const dataOrgId = orgData?.parent_org_id || org_id;
    console.log(`[Follow-Up Agent] Data org: ${dataOrgId} (child: ${dataOrgId !== org_id})`);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${agentError?.message}`);
    }

    // Use existing run record if provided, otherwise create new one
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

    const sequenceDelayDays = agent.parameters?.sequence_delay_days || 3;
    const maxLeads = agent.parameters?.max_leads || 100;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sequenceDelayDays);

    // Find leads that need follow-up
    const { data: staleLeads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, first_name, last_name, name, title, email, status, account_external_id, updated_at')
      .eq('org_id', dataOrgId)
      .in('status', ['contacted', 'qualified', 'open'])
      .lt('updated_at', cutoffDate.toISOString())
      .not('email', 'is', null)
      .limit(maxLeads);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    let recordsProcessed = 0;
    let recordsAffected = 0;
    const priorityBreakdown = { high: 0, medium: 0, low: 0 };

    if (staleLeads && staleLeads.length > 0) {
      console.log(`[Follow-Up Agent] Found ${staleLeads.length} leads to analyze`);

      // Fetch account data for context
      const accountIds = [...new Set(staleLeads.map(l => l.account_external_id).filter(Boolean))];
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('external_id, name, industry_raw, propensity_score, icp_qualified')
        .eq('org_id', dataOrgId)
        .in('external_id', accountIds);

      const accountsMap = new Map(accountsData?.map(a => [a.external_id, a]) || []);

      // Get AI prioritization
      const decisions = await prioritizeFollowUpsWithAI(staleLeads, accountsMap);

      // Process high and medium priority leads
      for (const decision of decisions) {
        if (decision.priority === 'low') continue;

        try {
          const { error: updateError } = await supabase
            .from('Leads')
            .update({
              status: 'follow_up_needed',
              updated_at: new Date().toISOString(),
              match_reasoning: `AI Follow-Up Priority: ${decision.priority.toUpperCase()}\nApproach: ${decision.approach}\nReasoning: ${decision.reasoning}\nSuggested: ${decision.suggested_action}`
            })
            .eq('id', decision.lead_id)
            .eq('org_id', org_id);

          if (!updateError) {
            recordsAffected++;
            priorityBreakdown[decision.priority]++;
          }
          recordsProcessed++;
        } catch (error) {
          console.error(`Error updating lead ${decision.lead_id}:`, error);
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
          leads_analyzed: staleLeads?.length || 0,
          leads_marked_for_followup: recordsAffected,
          priority_breakdown: priorityBreakdown,
          ai_powered: true,
          sequence_delay_days: sequenceDelayDays
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

    console.log(`[Follow-Up Agent] Completed: ${recordsAffected} leads marked (High: ${priorityBreakdown.high}, Med: ${priorityBreakdown.medium})`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        priority_breakdown: priorityBreakdown,
        ai_powered: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Follow-Up Agent] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

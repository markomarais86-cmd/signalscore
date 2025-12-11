import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MeetingDecision {
  lead_id: number;
  readiness_score: number;
  meeting_type: 'discovery' | 'demo' | 'consultation' | 'executive_briefing';
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  suggested_timing: string;
}

async function scoreMeetingReadinessWithAI(
  leads: any[],
  accounts: Map<string, any>
): Promise<MeetingDecision[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY || leads.length === 0) {
    console.log('[Meeting AI] No API key or leads, using rule-based fallback');
    return leads.map(lead => ({
      lead_id: lead.id,
      readiness_score: 70,
      meeting_type: 'discovery' as const,
      reasoning: 'Rule-based: Lead from ICP-qualified account',
      priority: 'medium' as const,
      suggested_timing: 'This week'
    }));
  }

  const leadsContext = leads.slice(0, 15).map(lead => {
    const account = accounts.get(lead.account_external_id);
    return {
      lead_id: lead.id,
      name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      title: lead.title,
      email: lead.email,
      status: lead.status,
      persona: lead.persona_matched,
      account_name: account?.name,
      account_industry: account?.industry_raw,
      account_score: account?.propensity_score,
      employee_count: account?.employee_count,
      revenue_range: account?.revenue_range,
      icp_qualified: account?.icp_qualified,
      last_funding: account?.last_funding_round,
      tech_stack: account?.tech_stack?.slice(0, 5)
    };
  });

  const systemPrompt = `You are an AI sales strategist that determines meeting readiness and optimal meeting types.

Analyze each lead and determine:

1. Readiness Score (0-100):
   - 80+: Ready now, high conversion potential
   - 60-79: Good fit, needs some nurturing
   - 40-59: Potential but not urgent
   - <40: Not ready, skip for now

2. Meeting Type based on:
   - "discovery" - Initial call to understand needs (default for new leads)
   - "demo" - Product demonstration (for leads showing product interest)
   - "consultation" - Strategic discussion (for senior executives)
   - "executive_briefing" - C-level presentation (for CxO titles at large companies)

3. Priority:
   - high: Book immediately (decision makers at qualified accounts)
   - medium: Book this week
   - low: Nurture first

4. Suggested Timing: When to schedule

Consider:
- Title/seniority (VP+, Director = higher priority)
- Account score and ICP qualification
- Company size (larger = longer sales cycle, need discovery first)
- Recent signals (funding, tech stack, hiring)`;

  const userPrompt = `Analyze these ${leadsContext.length} leads for meeting readiness:

${JSON.stringify(leadsContext, null, 2)}

Use the schedule_meetings tool to return your meeting recommendations.`;

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
            name: 'schedule_meetings',
            description: 'Return meeting readiness scores and recommendations',
            parameters: {
              type: 'object',
              properties: {
                decisions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      lead_id: { type: 'number' },
                      readiness_score: { type: 'number' },
                      meeting_type: { type: 'string', enum: ['discovery', 'demo', 'consultation', 'executive_briefing'] },
                      reasoning: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      suggested_timing: { type: 'string' }
                    },
                    required: ['lead_id', 'readiness_score', 'meeting_type', 'reasoning', 'priority', 'suggested_timing']
                  }
                }
              },
              required: ['decisions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'schedule_meetings' } }
      })
    });

    if (!response.ok) {
      console.error('[Meeting AI] API error:', response.status);
      throw new Error('AI API error');
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`[Meeting AI] Scored ${parsed.decisions?.length || 0} leads for meetings`);
      return parsed.decisions || [];
    }

    throw new Error('No tool call in response');
  } catch (error) {
    console.error('[Meeting AI] Error, using fallback:', error);
    return leads.map(lead => ({
      lead_id: lead.id,
      readiness_score: 70,
      meeting_type: 'discovery' as const,
      reasoning: 'Rule-based fallback: AI unavailable',
      priority: 'medium' as const,
      suggested_timing: 'This week'
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

    console.log(`[Meeting Scheduler Agent] Starting AI-powered run for agent ${agent_id}, org ${org_id}`);

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

    const minLeadScore = agent.parameters?.min_lead_score || 70;
    const maxLeads = agent.parameters?.max_leads || 50;
    let recordsProcessed = 0;
    let recordsAffected = 0;
    const meetingTypes = { discovery: 0, demo: 0, consultation: 0, executive_briefing: 0 };

    // Find qualified leads from ICP accounts
    const { data: qualifiedAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, industry_raw, employee_count, revenue_range, propensity_score, icp_qualified, last_funding_round, tech_stack')
      .eq('org_id', org_id)
      .eq('icp_qualified', true)
      .gte('propensity_score', minLeadScore);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    const accountExternalIds = qualifiedAccounts?.map(a => a.external_id) || [];
    const accountsMap = new Map(qualifiedAccounts?.map(a => [a.external_id, a]) || []);

    if (accountExternalIds.length > 0) {
      // Find qualified leads from these accounts
      const { data: leads, error: leadsError } = await supabase
        .from('Leads')
        .select('id, first_name, last_name, name, title, email, status, account_external_id, persona_matched')
        .eq('org_id', org_id)
        .in('account_external_id', accountExternalIds)
        .eq('status', 'qualified')
        .not('email', 'is', null)
        .limit(maxLeads);

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
        throw leadsError;
      }

      if (leads && leads.length > 0) {
        console.log(`[Meeting Scheduler] Analyzing ${leads.length} qualified leads with AI`);

        // Get AI meeting readiness scores
        const decisions = await scoreMeetingReadinessWithAI(leads, accountsMap);

        // Only schedule meetings for leads with high readiness
        const readyLeads = decisions.filter(d => d.readiness_score >= 60 && d.priority !== 'low');

        for (const decision of readyLeads) {
          try {
            const { error: updateError } = await supabase
              .from('Leads')
              .update({
                status: 'meeting_requested',
                updated_at: new Date().toISOString(),
                match_reasoning: `AI Meeting Readiness: ${decision.readiness_score}/100\nType: ${decision.meeting_type}\nPriority: ${decision.priority}\nTiming: ${decision.suggested_timing}\nReasoning: ${decision.reasoning}`
              })
              .eq('id', decision.lead_id)
              .eq('org_id', org_id);

            if (!updateError) {
              recordsAffected++;
              meetingTypes[decision.meeting_type]++;
            }
            recordsProcessed++;
          } catch (error) {
            console.error(`Error updating lead ${decision.lead_id}:`, error);
          }
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
          accounts_analyzed: qualifiedAccounts?.length || 0,
          meetings_scheduled: recordsAffected,
          meeting_types: meetingTypes,
          ai_powered: true,
          min_lead_score: minLeadScore
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

    console.log(`[Meeting Scheduler] Completed: ${recordsAffected} meetings scheduled (Discovery: ${meetingTypes.discovery}, Demo: ${meetingTypes.demo}, Consult: ${meetingTypes.consultation})`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected,
        meeting_types: meetingTypes,
        ai_powered: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Meeting Scheduler Agent] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

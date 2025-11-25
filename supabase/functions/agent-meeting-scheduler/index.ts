import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { agent_id, org_id } = await req.json();

    console.log(`[Meeting Scheduler] Starting for agent ${agent_id}, org ${org_id}`);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${agentError?.message}`);
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('ai_agent_runs')
      .insert({
        agent_id,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create run record: ${runError?.message}`);
    }

    const minLeadScore = agent.parameters?.min_lead_score || 75;
    let recordsProcessed = 0;
    let recordsAffected = 0;

    // Find high-score leads without meetings scheduled
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, external_id, name, email, account_external_id')
      .eq('org_id', org_id)
      .eq('status', 'qualified')
      .limit(25);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    }

    if (leads && leads.length > 0) {
      console.log(`[Meeting Scheduler] Processing ${leads.length} leads`);

      for (const lead of leads) {
        try {
          // Check lead's account score
          if (lead.account_external_id) {
            const { data: score } = await supabase
              .from('scores')
              .select('overall')
              .eq('org_id', org_id)
              .eq('account_external_id', lead.account_external_id)
              .order('computed_at', { ascending: false })
              .limit(1)
              .single();

            if (score && score.overall >= minLeadScore) {
              // Mark lead as meeting_requested
              await supabase
                .from('Leads')
                .update({ 
                  status: 'meeting_requested',
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
              
              recordsAffected++;
              console.log(`[Meeting Scheduler] Meeting requested for: ${lead.name} (score: ${score.overall})`);
            }
          }
          recordsProcessed++;
        } catch (error) {
          console.error(`Error processing lead ${lead.id}:`, error);
          recordsProcessed++;
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
          leads_processed: recordsProcessed,
          meetings_requested: recordsAffected,
          min_score_threshold: minLeadScore
        }
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

    console.log(`[Meeting Scheduler] Completed: ${recordsAffected}/${recordsProcessed} meetings requested`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        records_processed: recordsProcessed,
        records_affected: recordsAffected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Meeting Scheduler] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

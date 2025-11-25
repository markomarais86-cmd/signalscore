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
    const { agent_id, org_id, run_id } = await req.json();

    console.log(`[agent-lead-qualification] Starting for agent ${agent_id}, org ${org_id}, run_id ${run_id}`);

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
      console.log(`[agent-lead-qualification] Created new run record: ${run.id}`);
    }

    const minScoreThreshold = agent.parameters?.min_score_threshold || 70;
    console.log(`[agent-lead-qualification] Score threshold: ${minScoreThreshold}`);
    
    let recordsProcessed = 0;
    let recordsAffected = 0;

    // Find leads from the last 24 hours without scores
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, external_id, name, email')
      .eq('org_id', org_id)
      .gte('created_at', oneDayAgo)
      .limit(100);

    if (leadsError) {
      console.error('[agent-lead-qualification] Error fetching leads:', leadsError);
      throw leadsError;
    }
    
    console.log(`[agent-lead-qualification] Found ${leads?.length || 0} leads to process`);

    if (leads && leads.length > 0) {
      console.log(`[Lead Qualification] Processing ${leads.length} leads`);

      // Get active ICP profiles
      const { data: icps } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', org_id)
        .eq('status', 'active')
        .limit(1);

      if (icps && icps.length > 0) {
        const icpId = icps[0].id;

        // Score each lead
        for (const lead of leads) {
          try {
            // Check if lead has associated account
            const { data: accounts } = await supabase
              .from('accounts')
              .select('external_id')
              .eq('org_id', org_id)
              .eq('domain', lead.email?.split('@')[1])
              .limit(1);

            if (accounts && accounts.length > 0) {
              // Score the account
              const { data: score } = await supabase.rpc('calculate_account_score', {
                account_external_id: accounts[0].external_id,
                icp_id: icpId,
                org_id_param: org_id
              });

              recordsProcessed++;

              // If score meets threshold, mark as qualified
              if (score && score.overall >= minScoreThreshold) {
                const { error: updateError } = await supabase
                  .from('Leads')
                  .update({ status: 'qualified' })
                  .eq('id', lead.id);
                
                if (updateError) {
                  console.error(`[agent-lead-qualification] Failed to update lead ${lead.id}:`, updateError);
                } else {
                  recordsAffected++;
                  console.log(`[agent-lead-qualification] Qualified lead: ${lead.name} (score: ${score.overall})`);
                }
              }
            } else {
              recordsProcessed++;
            }
          } catch (error) {
            console.error(`Error scoring lead ${lead.id}:`, error);
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
          leads_processed: recordsProcessed,
          leads_qualified: recordsAffected,
          threshold: minScoreThreshold
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

    console.log(`[agent-lead-qualification] Completed: ${recordsAffected}/${recordsProcessed} leads qualified`);

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
    console.error('[agent-lead-qualification] Fatal error:', error);
    
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

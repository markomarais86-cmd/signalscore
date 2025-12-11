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

    console.log(`[Follow-up] Starting for agent ${agent_id}, org ${org_id}, run_id ${run_id}`);

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
      
      if (error) {
        console.error('[Follow-up] Failed to fetch run record:', error);
        throw error;
      }
      run = data;
      console.log(`[Follow-up] Using existing run record: ${run_id}`);
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
        throw new Error(`Failed to create run record: ${runError?.message}`);
      }
      run = data;
      console.log(`[Follow-up] Created new run record: ${run.id}`);
    }

    const delayDays = agent.parameters?.sequence_delay_days || 7;
    const maxLeads = agent.parameters?.max_leads || 100;
    let recordsProcessed = 0;
    let recordsAffected = 0;

    // Find leads that need follow-up:
    // - Status is 'open', 'contacted', or 'follow_up_needed'
    // - Haven't been updated in X days (stale leads)
    // - Have valid email
    const followUpDate = new Date(Date.now() - delayDays * 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`[Follow-up] Looking for leads not updated since ${followUpDate}`);
    
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, external_id, name, email, status, updated_at, account_external_id')
      .eq('org_id', org_id)
      .in('status', ['open', 'contacted', 'follow_up_needed'])
      .not('email', 'is', null)
      .lte('updated_at', followUpDate)
      .order('updated_at', { ascending: true })
      .limit(maxLeads);

    if (leadsError) {
      console.error('[Follow-up] Error fetching leads:', leadsError);
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    console.log(`[Follow-up] Found ${leads?.length || 0} stale leads to process`);

    if (leads && leads.length > 0) {
      for (const lead of leads) {
        try {
          recordsProcessed++;
          
          // Check if lead's account is ICP qualified (prioritize those)
          let priority = 'normal';
          if (lead.account_external_id) {
            const { data: account } = await supabase
              .from('accounts')
              .select('icp_qualified, name')
              .eq('org_id', org_id)
              .eq('external_id', lead.account_external_id)
              .single();
            
            if (account?.icp_qualified) {
              priority = 'high';
            }
          }

          // Update lead status to follow_up_needed with metadata
          const { error: updateError } = await supabase
            .from('Leads')
            .update({ 
              status: 'follow_up_needed',
              updated_at: new Date().toISOString(),
              match_reasoning: `Marked for follow-up (priority: ${priority}). Last activity: ${lead.updated_at}. Previous status: ${lead.status}.`
            })
            .eq('id', lead.id);
          
          if (updateError) {
            console.error(`[Follow-up] Error updating lead ${lead.id}:`, updateError);
          } else {
            recordsAffected++;
            console.log(`[Follow-up] Marked lead for follow-up: ${lead.name || lead.email} (${priority} priority)`);
          }
        } catch (error) {
          console.error(`[Follow-up] Error processing lead ${lead.id}:`, error);
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
          leads_found: leads?.length || 0,
          leads_processed: recordsProcessed,
          leads_marked_for_followup: recordsAffected,
          delay_days: delayDays,
          cutoff_date: followUpDate
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

    console.log(`[Follow-up] Completed: ${recordsAffected}/${recordsProcessed} leads marked for follow-up`);

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
    console.error('[Follow-up] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
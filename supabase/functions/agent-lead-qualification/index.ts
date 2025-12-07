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

    // Find leads with 'open' or 'new' status linked to high-fit accounts
    // Join with accounts and scores to find leads at qualified accounts
    const { data: leads, error: leadsError } = await supabase
      .from('Leads')
      .select(`
        id, external_id, name, email, account_external_id,
        accounts!inner(external_id, name),
        scores!inner(overall, fit, intent)
      `)
      .eq('org_id', org_id)
      .in('status', ['open', 'new'])
      .gte('scores.overall', minScoreThreshold)
      .order('scores.overall', { ascending: false })
      .limit(500);

    if (leadsError) {
      console.error('[agent-lead-qualification] Error fetching leads:', leadsError);
      // Fallback: simple query without joins if the join fails
      const { data: simpleLeads, error: simpleError } = await supabase
        .from('Leads')
        .select('id, external_id, name, email, account_external_id')
        .eq('org_id', org_id)
        .in('status', ['open', 'new'])
        .not('account_external_id', 'is', null)
        .limit(500);
      
      if (simpleError) throw simpleError;
      console.log(`[agent-lead-qualification] Found ${simpleLeads?.length || 0} leads (fallback query)`);
    }
    
    console.log(`[agent-lead-qualification] Found ${leads?.length || 0} leads at high-fit accounts`);

    if (leads && leads.length > 0) {
      console.log(`[Lead Qualification] Processing ${leads.length} leads`);

      // Get active ICP profiles
      const { data: icps } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', org_id)
        .eq('status', 'active')
        .limit(1);

      // Process leads that are already at high-fit accounts (from the joined query)
      for (const lead of leads) {
        try {
          recordsProcessed++;
          
          // The lead is already at a high-fit account (from the query filter)
          // Mark as qualified
          const { error: updateError } = await supabase
            .from('Leads')
            .update({ status: 'qualified' })
            .eq('id', lead.id);
          
          if (updateError) {
            console.error(`[agent-lead-qualification] Failed to update lead ${lead.id}:`, updateError);
          } else {
            recordsAffected++;
            const score = (lead as any).scores?.overall || 'N/A';
            console.log(`[agent-lead-qualification] Qualified lead: ${lead.name} (score: ${score})`);
          }
        } catch (error) {
          console.error(`Error qualifying lead ${lead.id}:`, error);
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

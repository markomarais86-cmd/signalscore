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

    console.log(`[Meeting Scheduler] Starting for agent ${agent_id}, org ${org_id}, run_id ${run_id}`);

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
        console.error('[Meeting Scheduler] Failed to fetch run record:', error);
        throw error;
      }
      run = data;
      console.log(`[Meeting Scheduler] Using existing run record: ${run_id}`);
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
      console.log(`[Meeting Scheduler] Created new run record: ${run.id}`);
    }

    const minScore = agent.parameters?.min_lead_score || 70;
    const maxLeads = agent.parameters?.max_leads || 50;
    let recordsProcessed = 0;
    let recordsAffected = 0;

    // Find leads from ICP-qualified accounts that are ready for meetings
    // Priority: leads with verified emails from high-scoring accounts
    console.log(`[Meeting Scheduler] Looking for leads from ICP-qualified accounts with score >= ${minScore}`);
    
    // First, get ICP-qualified accounts with high scores
    const { data: qualifiedAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, propensity_score')
      .eq('org_id', org_id)
      .eq('icp_qualified', true)
      .order('propensity_score', { ascending: false, nullsFirst: false })
      .limit(100);

    if (accountsError) {
      console.error('[Meeting Scheduler] Error fetching accounts:', accountsError);
    }

    console.log(`[Meeting Scheduler] Found ${qualifiedAccounts?.length || 0} ICP-qualified accounts`);

    // Also check scores table for additional scoring
    const accountExternalIds = qualifiedAccounts?.map(a => a.external_id) || [];
    
    let highScoreAccounts: string[] = [];
    if (accountExternalIds.length > 0) {
      const { data: scores } = await supabase
        .from('scores')
        .select('account_external_id, overall')
        .eq('org_id', org_id)
        .in('account_external_id', accountExternalIds)
        .gte('overall', minScore);
      
      highScoreAccounts = scores?.map(s => s.account_external_id) || [];
      console.log(`[Meeting Scheduler] ${highScoreAccounts.length} accounts have scores >= ${minScore}`);
    }

    // Combine: ICP-qualified OR high-scoring
    const targetAccounts = [...new Set([...accountExternalIds, ...highScoreAccounts])];

    if (targetAccounts.length > 0) {
      // Find leads from these accounts that haven't had meetings requested
      const { data: leads, error: leadsError } = await supabase
        .from('Leads')
        .select('id, external_id, name, email, account_external_id, status, icp_qualified')
        .eq('org_id', org_id)
        .in('account_external_id', targetAccounts)
        .in('status', ['open', 'qualified', 'contacted'])
        .not('email', 'is', null)
        .limit(maxLeads);

      if (leadsError) {
        console.error('[Meeting Scheduler] Error fetching leads:', leadsError);
      }

      console.log(`[Meeting Scheduler] Found ${leads?.length || 0} leads to process`);

      if (leads && leads.length > 0) {
        for (const lead of leads) {
          try {
            recordsProcessed++;
            
            // Get account details for context
            const account = qualifiedAccounts?.find(a => a.external_id === lead.account_external_id);
            const accountName = account?.name || 'Unknown';
            const accountScore = account?.propensity_score || 0;

            // Update lead status to meeting_requested
            const { error: updateError } = await supabase
              .from('Leads')
              .update({ 
                status: 'meeting_requested',
                updated_at: new Date().toISOString(),
                match_reasoning: `Meeting requested. Account: ${accountName} (score: ${accountScore}). ICP-qualified account with high propensity.`
              })
              .eq('id', lead.id);
            
            if (updateError) {
              console.error(`[Meeting Scheduler] Error updating lead ${lead.id}:`, updateError);
            } else {
              recordsAffected++;
              console.log(`[Meeting Scheduler] Meeting requested for: ${lead.name || lead.email} at ${accountName}`);
            }
          } catch (error) {
            console.error(`[Meeting Scheduler] Error processing lead ${lead.id}:`, error);
          }
        }
      }
    } else {
      console.log('[Meeting Scheduler] No qualified accounts found - run Lead Qualification agent first');
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
          qualified_accounts_found: targetAccounts.length,
          leads_processed: recordsProcessed,
          meetings_requested: recordsAffected,
          min_score_threshold: minScore
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
        records_affected: recordsAffected,
        qualified_accounts: targetAccounts.length
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
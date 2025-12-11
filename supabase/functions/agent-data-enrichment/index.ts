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

    console.log(`[Data Enrichment] Starting for agent ${agent_id}, org ${org_id}, run_id ${run_id}`);

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
        console.error('[Data Enrichment] Failed to fetch run record:', error);
        throw error;
      }
      run = data;
      console.log(`[Data Enrichment] Using existing run record: ${run_id}`);
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
      console.log(`[Data Enrichment] Created new run record: ${run.id}`);
    }

    const batchSize = agent.parameters?.batch_size || 50;
    let recordsProcessed = 0;
    let recordsAffected = 0;

    // Find accounts missing firmographic data
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, external_id, name, domain')
      .eq('org_id', org_id)
      .or('industry_raw.is.null,employee_count.is.null,revenue_range.is.null')
      .limit(batchSize);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
    }

    if (accounts && accounts.length > 0) {
      console.log(`[Data Enrichment] Processing ${accounts.length} accounts`);

      // Trigger enrichment for each account
      for (const account of accounts) {
        try {
          if (account.domain) {
            // Call smart-enrich edge function
            const { error: enrichError } = await supabase.functions.invoke('smart-enrich', {
              body: {
                org_id,
                account_external_id: account.external_id,
                domain: account.domain
              }
            });

            if (!enrichError) {
              recordsAffected++;
            }
          }
          recordsProcessed++;
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
          accounts_processed: recordsProcessed,
          accounts_enriched: recordsAffected,
          batch_size: batchSize
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

    console.log(`[Data Enrichment] Completed: ${recordsAffected}/${recordsProcessed} accounts enriched`);

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
    console.error('[Data Enrichment] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

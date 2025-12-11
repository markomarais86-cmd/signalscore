import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[scheduled-agent-runner] Starting scheduled agent run check');

    // Get all active agents that are due to run
    const { data: agents, error: agentsError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('status', 'active')
      .or('next_run_at.is.null,next_run_at.lte.' + new Date().toISOString());

    if (agentsError) {
      console.error('[scheduled-agent-runner] Failed to fetch agents:', agentsError);
      throw agentsError;
    }

    console.log(`[scheduled-agent-runner] Found ${agents?.length || 0} agents due to run`);

    const results = [];

    // Run each agent
    for (const agent of agents || []) {
      console.log(`[scheduled-agent-runner] Running agent: ${agent.name} (${agent.id})`);

      try {
        const { data, error } = await supabase.functions.invoke('run-agent', {
          body: {
            agent_id: agent.id,
            manual: false,
          },
        });

        if (error) {
          console.error(`[scheduled-agent-runner] Failed to run agent ${agent.id}:`, error);
          results.push({
            agent_id: agent.id,
            agent_name: agent.name,
            success: false,
            error: error.message,
          });
        } else {
          console.log(`[scheduled-agent-runner] Agent ${agent.id} completed successfully`);
          results.push({
            agent_id: agent.id,
            agent_name: agent.name,
            success: true,
            result: data,
          });
        }

        // Calculate next run time based on schedule
        const { data: nextRunData, error: nextRunError } = await supabase
          .rpc('calculate_next_run', {
            schedule: agent.schedule,
            last_run: new Date().toISOString(),
          });

        if (nextRunError) {
          console.error(`[scheduled-agent-runner] Failed to calculate next run for ${agent.id}:`, nextRunError);
        } else {
          console.log(`[scheduled-agent-runner] Next run for ${agent.name}: ${nextRunData}`);
          
          // Update the agent's next_run_at field
          const { error: updateError } = await supabase
            .from('ai_agents')
            .update({ 
              next_run_at: nextRunData,
              last_run_at: new Date().toISOString()
            })
            .eq('id', agent.id);
            
          if (updateError) {
            console.error(`[scheduled-agent-runner] Failed to update next_run_at for ${agent.id}:`, updateError);
          }
        }
      } catch (error) {
        console.error(`[scheduled-agent-runner] Exception running agent ${agent.id}:`, error);
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[scheduled-agent-runner] Completed: ${successCount}/${results.length} agents succeeded`);

    return new Response(
      JSON.stringify({
        success: true,
        agents_checked: agents?.length || 0,
        agents_run: results.length,
        successful_runs: successCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[scheduled-agent-runner] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

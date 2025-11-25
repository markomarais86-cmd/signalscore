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

    const { agent_id, manual = true } = await req.json();

    if (!agent_id) {
      console.error('Missing agent_id in request');
      throw new Error('agent_id is required');
    }

    console.log(`[run-agent] Starting agent execution: ${agent_id} (manual: ${manual})`);

    // Get agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError) {
      console.error('[run-agent] Failed to fetch agent:', agentError);
      throw new Error(`Failed to fetch agent: ${agentError.message}`);
    }

    if (!agent) {
      console.error('[run-agent] Agent not found:', agent_id);
      throw new Error(`Agent not found: ${agent_id}`);
    }

    console.log(`[run-agent] Agent found: ${agent.name} (${agent.agent_type})`);

    // Create agent run record at start
    const { data: runRecord, error: runError } = await supabase
      .from('ai_agent_runs')
      .insert({
        agent_id: agent.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      console.error('[run-agent] Failed to create run record:', runError);
      throw new Error(`Failed to create run record: ${runError.message}`);
    }

    console.log(`[run-agent] Run record created: ${runRecord.id}`);

    // Map agent types to their edge functions
    const functionMap: Record<string, string> = {
      'lead_qualification': 'agent-lead-qualification',
      'follow_up': 'agent-follow-up',
      'meeting_scheduler': 'agent-meeting-scheduler',
      'data_enrichment': 'agent-data-enrichment',
    };

    const functionName = functionMap[agent.agent_type];
    if (!functionName) {
      console.error('[run-agent] Unknown agent type:', agent.agent_type);
      
      // Update run record with error
      await supabase
        .from('ai_agent_runs')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: `Unknown agent type: ${agent.agent_type}`,
        })
        .eq('id', runRecord.id);

      throw new Error(`Unknown agent type: ${agent.agent_type}`);
    }

    console.log(`[run-agent] Invoking function: ${functionName}`);

    // Invoke the appropriate agent function
    const { data: result, error: invokeError } = await supabase.functions.invoke(functionName, {
      body: {
        agent_id: agent.id,
        org_id: agent.org_id,
        run_id: runRecord.id,
      },
    });

    if (invokeError) {
      console.error('[run-agent] Agent invocation error:', invokeError);
      
      // Update run record with error
      await supabase
        .from('ai_agent_runs')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: invokeError.message || 'Function invocation failed',
        })
        .eq('id', runRecord.id);

      throw new Error(`Agent execution failed: ${invokeError.message}`);
    }

    console.log('[run-agent] Agent run completed successfully:', result);

    // Update agent's last_run_at
    const { error: updateError } = await supabase
      .from('ai_agents')
      .update({
        last_run_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('[run-agent] Failed to update agent timestamp:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agent.id,
        agent_name: agent.name,
        run_id: runRecord.id,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[run-agent] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

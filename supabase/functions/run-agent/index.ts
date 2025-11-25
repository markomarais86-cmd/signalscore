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
      throw new Error('agent_id is required');
    }

    console.log(`Running agent: ${agent_id} (manual: ${manual})`);

    // Get agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError) throw agentError;

    // Map agent types to their edge functions
    const functionMap: Record<string, string> = {
      'lead_qualification': 'agent-lead-qualification',
      'follow_up': 'agent-follow-up',
      'meeting_scheduler': 'agent-meeting-scheduler',
      'data_enrichment': 'agent-data-enrichment',
    };

    const functionName = functionMap[agent.agent_type];
    if (!functionName) {
      throw new Error(`Unknown agent type: ${agent.agent_type}`);
    }

    console.log(`Invoking function: ${functionName}`);

    // Invoke the appropriate agent function
    const { data: result, error: invokeError } = await supabase.functions.invoke(functionName, {
      body: {
        agent_id: agent.id,
        org_id: agent.org_id,
      },
    });

    if (invokeError) {
      console.error('Agent invocation error:', invokeError);
      throw invokeError;
    }

    console.log('Agent run completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agent.id,
        agent_name: agent.name,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in run-agent function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

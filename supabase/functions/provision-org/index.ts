import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * provision-org: Auto-provisions all required infrastructure for a new child org.
 * Called after org + ICP creation in parse-icp-document.
 * 
 * Provisions:
 * 1. Agent registry entries (4 core agents)
 * 2. External data source record (Apollo)
 * 3. Default API credit alerts
 * 4. Default service health alerts
 * 
 * Idempotent — safe to call multiple times for the same org.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[provision-org] Provisioning org ${org_id}`);

    const results = {
      agents_created: 0,
      data_sources_created: 0,
      alerts_created: 0,
      skipped: [] as string[],
    };

    // 1. Register core pipeline agents (idempotent via upsert-like check)
    const coreAgents = [
      { agent_name: 'lead_qualification', agent_type: 'qualification', capabilities: ['qualify_leads', 'score_leads'] },
      { agent_name: 'data_enrichment', agent_type: 'enrichment', capabilities: ['enrich_accounts', 'enrich_contacts'] },
      { agent_name: 'follow_up', agent_type: 'engagement', capabilities: ['follow_up_leads', 'send_sequences'] },
      { agent_name: 'meeting_scheduler', agent_type: 'scheduling', capabilities: ['schedule_meetings', 'calendar_sync'] },
    ];

    for (const agent of coreAgents) {
      const { data: existing } = await supabase
        .from('ai_agent_registry')
        .select('id')
        .eq('org_id', org_id)
        .eq('agent_name', agent.agent_name)
        .maybeSingle();

      if (existing) {
        results.skipped.push(`agent:${agent.agent_name}`);
        continue;
      }

      const { error } = await supabase
        .from('ai_agent_registry')
        .insert({
          org_id,
          agent_name: agent.agent_name,
          agent_type: agent.agent_type,
          capabilities: agent.capabilities,
          status: 'active',
        });

      if (error) {
        console.error(`[provision-org] Failed to register agent ${agent.agent_name}:`, error.message);
      } else {
        results.agents_created++;
      }
    }

    // 2. Create external data source record (Apollo)
    const { data: existingSource } = await supabase
      .from('external_data_sources')
      .select('id')
      .eq('org_id', org_id)
      .eq('provider', 'apollo')
      .maybeSingle();

    if (existingSource) {
      results.skipped.push('data_source:apollo');
    } else {
      const { error } = await supabase
        .from('external_data_sources')
        .insert({
          org_id,
          provider: 'apollo',
          api_key_configured: false,
          is_active: false,
        });

      if (error) {
        console.error('[provision-org] Failed to create data source:', error.message);
      } else {
        results.data_sources_created++;
      }
    }

    // 3. Create default alerts
    const defaultAlerts = [
      {
        name: 'Low API Credits',
        alert_type: 'api_credits_low',
        threshold_value: 100,
        threshold_operator: 'lt',
        notification_channels: { webhook: true, slack: true, email: false },
      },
      {
        name: 'Service Degraded',
        alert_type: 'service_degraded',
        threshold_value: 3,
        threshold_operator: 'gte',
        notification_channels: { webhook: true, slack: true, email: false },
      },
    ];

    for (const alert of defaultAlerts) {
      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('org_id', org_id)
        .eq('alert_type', alert.alert_type)
        .maybeSingle();

      if (existingAlert) {
        results.skipped.push(`alert:${alert.alert_type}`);
        continue;
      }

      const { error } = await supabase
        .from('alerts')
        .insert({
          org_id,
          name: alert.name,
          alert_type: alert.alert_type,
          threshold_value: alert.threshold_value,
          threshold_operator: alert.threshold_operator,
          notification_channels: alert.notification_channels,
          is_active: true,
        });

      if (error) {
        console.error(`[provision-org] Failed to create alert ${alert.alert_type}:`, error.message);
      } else {
        results.alerts_created++;
      }
    }

    console.log(`[provision-org] Complete:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, org_id, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[provision-org] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

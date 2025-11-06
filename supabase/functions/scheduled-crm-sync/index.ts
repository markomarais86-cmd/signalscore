import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationConfig {
  id: string;
  org_id: string;
  provider_name: string;
  status: string;
  config: {
    sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
    last_scheduled_sync?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[scheduled-crm-sync] Starting scheduled sync job');

    // Get current hour to determine which syncs to run
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Get all active integrations with sync frequency configured
    const { data: integrations, error: fetchError } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('status', 'active')
      .in('provider_name', ['salesforce', 'hubspot'])
      .not('config->sync_frequency', 'is', null);

    if (fetchError) {
      console.error('Error fetching integrations:', fetchError);
      throw fetchError;
    }

    if (!integrations || integrations.length === 0) {
      console.log('[scheduled-crm-sync] No integrations configured for auto-sync');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No integrations to sync',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scheduled-crm-sync] Found ${integrations.length} integrations to check`);

    const syncResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (const integration of integrations) {
      const config = integration.config as IntegrationConfig['config'];
      const syncFrequency = config?.sync_frequency || 'manual';

      // Determine if this integration should sync now
      let shouldSync = false;

      if (syncFrequency === 'hourly') {
        shouldSync = true; // Sync every hour
      } else if (syncFrequency === 'daily' && currentHour === 2) {
        shouldSync = true; // Sync at 2 AM
      } else if (syncFrequency === 'weekly' && currentDay === 1 && currentHour === 2) {
        shouldSync = true; // Sync Monday at 2 AM
      }

      if (!shouldSync) {
        console.log(`[scheduled-crm-sync] Skipping ${integration.provider_name} for org ${integration.org_id} - not scheduled now`);
        continue;
      }

      console.log(`[scheduled-crm-sync] Syncing ${integration.provider_name} for org ${integration.org_id}`);

      try {
        // Determine which sync function to call
        const syncFunctionName = integration.provider_name === 'salesforce' 
          ? 'salesforce-sync' 
          : 'hubspot-sync';

        // Call the appropriate sync function
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/${syncFunctionName}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              org_id: integration.org_id,
              integration_config_id: integration.id,
              full_sync: false, // Incremental sync for scheduled runs
            }),
          }
        );

        const result = await syncResponse.json();

        if (syncResponse.ok && result.success) {
          successCount++;
          syncResults.push({
            provider: integration.provider_name,
            org_id: integration.org_id,
            status: 'success',
            stats: {
              accounts: result.accounts || 0,
              contacts: result.contacts || 0,
              leads: result.leads || 0
            }
          });

          // Update last scheduled sync time
          await supabase
            .from('integration_configs')
            .update({
              config: {
                ...config,
                last_scheduled_sync: new Date().toISOString()
              }
            })
            .eq('id', integration.id);

          console.log(`[scheduled-crm-sync] Successfully synced ${integration.provider_name} for org ${integration.org_id}`);
        } else {
          failureCount++;
          syncResults.push({
            provider: integration.provider_name,
            org_id: integration.org_id,
            status: 'failed',
            error: result.error || 'Unknown error'
          });

          console.error(`[scheduled-crm-sync] Failed to sync ${integration.provider_name} for org ${integration.org_id}:`, result.error);
        }
      } catch (error: any) {
        failureCount++;
        syncResults.push({
          provider: integration.provider_name,
          org_id: integration.org_id,
          status: 'failed',
          error: error.message
        });

        console.error(`[scheduled-crm-sync] Error syncing ${integration.provider_name} for org ${integration.org_id}:`, error);
      }
    }

    console.log(`[scheduled-crm-sync] Completed: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scheduled sync completed: ${successCount} successful, ${failureCount} failed`,
        synced: successCount,
        failed: failureCount,
        results: syncResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[scheduled-crm-sync] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

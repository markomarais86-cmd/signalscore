import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sync_log_id, org_id } = await req.json();

    if (!sync_log_id || !org_id) {
      throw new Error('Missing required parameters: sync_log_id and org_id');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[retry-crm-sync] Retrying sync log:', sync_log_id);

    // Get the failed sync log
    const { data: syncLog, error: logError } = await supabase
      .from('integration_sync_logs')
      .select('*')
      .eq('id', sync_log_id)
      .eq('org_id', org_id)
      .single();

    if (logError || !syncLog) {
      throw new Error('Sync log not found');
    }

    if (syncLog.status !== 'failed') {
      throw new Error('Can only retry failed syncs');
    }

    // Update status to retrying
    await supabase
      .from('integration_sync_logs')
      .update({
        status: 'retrying',
        error_message: null,
        error_details: null
      })
      .eq('id', sync_log_id);

    // Determine which function to call based on sync type
    let retryFunction: string;
    let retryBody: any;

    if (syncLog.sync_type === 'campaign_push') {
      // Retry campaign push
      retryFunction = 'push-campaign-to-crm';
      
      // Reconstruct the request from metadata
      retryBody = {
        org_id: syncLog.org_id,
        campaign_name: syncLog.metadata?.campaign_name || 'Retry Campaign',
        contacts: syncLog.metadata?.contacts || [],
        batch_metadata: syncLog.metadata?.batch_metadata || {}
      };
    } else if (syncLog.sync_type === 'scheduled_sync' || syncLog.sync_type === 'manual_sync') {
      // Retry CRM sync
      retryFunction = 'salesforce-sync';
      
      retryBody = {
        org_id: syncLog.org_id,
        full_sync: false
      };
    } else {
      throw new Error(`Unsupported sync type for retry: ${syncLog.sync_type}`);
    }

    console.log(`[retry-crm-sync] Invoking ${retryFunction} for retry`);

    // Invoke the appropriate function
    const { data, error: invokeError } = await supabase.functions.invoke(retryFunction, {
      body: retryBody
    });

    if (invokeError) {
      console.error('[retry-crm-sync] Retry function failed:', invokeError);
      
      // Update sync log with new failure
      await supabase
        .from('integration_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: `Retry failed: ${invokeError.message}`,
          error_details: { retry_error: invokeError }
        })
        .eq('id', sync_log_id);

      throw invokeError;
    }

    console.log('[retry-crm-sync] Retry successful:', data);

    // The called function will update the sync log, so we just return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync retry initiated successfully',
        result: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[retry-crm-sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

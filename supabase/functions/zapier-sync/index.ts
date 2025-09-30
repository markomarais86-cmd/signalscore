import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZapierSyncRequest {
  event_type: 'account_created' | 'contact_created' | 'lead_created' | 'score_updated';
  data: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_type, data }: ZapierSyncRequest = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    // Get user's org_id
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Get active webhooks for this event type
    const { data: webhooks, error: webhooksError } = await supabaseClient
      .from('zapier_webhooks')
      .select('*')
      .eq('org_id', userProfile.org_id)
      .eq('event_type', event_type)
      .eq('is_active', true);

    if (webhooksError) throw webhooksError;

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active webhooks found for this event type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send data to all active webhooks
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type,
            timestamp: new Date().toISOString(),
            data,
          }),
        });

        // Update last triggered timestamp
        await supabaseClient
          .from('zapier_webhooks')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', webhook.id);

        if (!response.ok) {
          throw new Error(`Webhook ${webhook.name} failed: ${response.statusText}`);
        }

        return { webhook: webhook.name, status: 'success' };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Zapier sync complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          successful,
          failed,
          details: results,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in zapier-sync function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

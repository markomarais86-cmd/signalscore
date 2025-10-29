import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const OAUTH_CONFIG: Record<string, {
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}> = {
  salesforce: {
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    clientIdEnv: 'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET'
  },
  hubspot: {
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET'
  },
  outreach: {
    tokenUrl: 'https://api.outreach.io/oauth/token',
    clientIdEnv: 'OUTREACH_CLIENT_ID',
    clientSecretEnv: 'OUTREACH_CLIENT_SECRET'
  },
  salesloft: {
    tokenUrl: 'https://accounts.salesloft.com/oauth/token',
    clientIdEnv: 'SALESLOFT_CLIENT_ID',
    clientSecretEnv: 'SALESLOFT_CLIENT_SECRET'
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find tokens expiring in the next 10 minutes
    const expiryThreshold = new Date(Date.now() + 10 * 60 * 1000);
    const { data: expiringCreds, error: fetchError } = await supabase
      .from('integration_credentials')
      .select(`
        id,
        org_id,
        integration_config_id,
        encrypted_value,
        expires_at,
        integration_configs!inner(provider_name, status)
      `)
      .eq('credential_type', 'oauth_token')
      .eq('integration_configs.status', 'connected')
      .lt('expires_at', expiryThreshold.toISOString());

    if (fetchError) {
      console.error('Failed to fetch expiring credentials:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expiringCreds || expiringCreds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tokens need refreshing',
          refreshed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let refreshedCount = 0;
    let failedCount = 0;

    // Refresh each token
    for (const cred of expiringCreds) {
      try {
        const provider = (cred.integration_configs as any).provider_name;
        const config = OAUTH_CONFIG[provider];

        if (!config) {
          console.error(`Unsupported provider for refresh: ${provider}`);
          failedCount++;
          continue;
        }

        const clientId = Deno.env.get(config.clientIdEnv);
        const clientSecret = Deno.env.get(config.clientSecretEnv);

        if (!clientId || !clientSecret) {
          console.error(`Missing OAuth credentials for ${provider}`);
          failedCount++;
          continue;
        }

        // Parse existing tokens
        const tokens = JSON.parse(cred.encrypted_value);
        
        if (!tokens.refresh_token) {
          console.error(`No refresh token for ${provider}, config: ${cred.integration_config_id}`);
          
          // Mark integration as error
          await supabase
            .from('integration_configs')
            .update({
              status: 'error',
              error_message: 'OAuth token expired. Please reconnect.',
              error_count: 1
            })
            .eq('id', cred.integration_config_id);
          
          failedCount++;
          continue;
        }

        // Request new token
        const refreshResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            client_id: clientId,
            client_secret: clientSecret
          })
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error(`Token refresh failed for ${provider}:`, errorText);
          
          // Mark integration as error
          await supabase
            .from('integration_configs')
            .update({
              status: 'error',
              error_message: 'Failed to refresh OAuth token. Please reconnect.',
              error_count: 1
            })
            .eq('id', cred.integration_config_id);
          
          failedCount++;
          continue;
        }

        const newTokens = await refreshResponse.json();
        const expiresIn = newTokens.expires_in || 3600;
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

        // Update credentials with new tokens
        const updatedTokenData = JSON.stringify({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token, // Some providers don't return new refresh token
          token_type: newTokens.token_type || tokens.token_type,
          scope: newTokens.scope || tokens.scope,
          instance_url: newTokens.instance_url || tokens.instance_url
        });

        const { error: updateError } = await supabase
          .from('integration_credentials')
          .update({
            encrypted_value: updatedTokenData,
            expires_at: newExpiresAt.toISOString()
          })
          .eq('id', cred.id);

        if (updateError) {
          console.error(`Failed to update credentials for ${provider}:`, updateError);
          failedCount++;
          continue;
        }

        console.log(`Successfully refreshed token for ${provider}, config: ${cred.integration_config_id}`);
        refreshedCount++;

      } catch (error) {
        console.error(`Error refreshing token:`, error);
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Token refresh completed`,
        refreshed: refreshedCount,
        failed: failedCount,
        total: expiringCreds.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth refresh error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

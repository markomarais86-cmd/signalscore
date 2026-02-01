import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors (user denied permission)
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || error;
      return redirectWithError(
        'OAuth authorization failed',
        errorDescription
      );
    }

    if (!code || !state) {
      return redirectWithError(
        'Missing OAuth parameters',
        'code or state parameter missing'
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state')
      .select('*')
      .eq('state_token', state)
      .single();

    if (stateError || !stateData) {
      return redirectWithError(
        'Invalid OAuth state',
        'State token not found or expired'
      );
    }

    // Check if state token is expired
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      // Clean up expired state
      await supabase.from('oauth_state').delete().eq('state_token', state);
      return redirectWithError(
        'OAuth flow expired',
        'Please try connecting again'
      );
    }

    const provider = stateData.provider;
    const config = OAUTH_CONFIG[provider];

    if (!config) {
      return redirectWithError(
        'Unsupported provider',
        `Provider ${provider} is not supported`
      );
    }

    const clientId = Deno.env.get(config.clientIdEnv);
    const clientSecret = Deno.env.get(config.clientSecretEnv);

    if (!clientId || !clientSecret) {
      return redirectWithError(
        'OAuth not configured',
        `Missing credentials for ${provider}`
      );
    }

    // Exchange authorization code for access token
    const callbackUrl = `${SUPABASE_URL}/functions/v1/oauth-callback`;
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return redirectWithError(
        'Token exchange failed',
        'Failed to obtain access token'
      );
    }

    const tokens = await tokenResponse.json();
    const expiresIn = tokens.expires_in || 3600; // Default 1 hour
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Create or update integration config
    const { data: existingConfig } = await supabase
      .from('integration_configs')
      .select('id')
      .eq('org_id', stateData.org_id)
      .eq('provider_name', provider)
      .single();

    let configId: string;

    if (existingConfig) {
      // Update existing config
      const { error: updateError } = await supabase
        .from('integration_configs')
        .update({
          status: 'connected',
          error_message: null,
          error_count: 0,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', existingConfig.id);

      if (updateError) {
        console.error('Failed to update config:', updateError);
      }
      configId = existingConfig.id;
    } else {
      // Create new config
      const { data: newConfig, error: insertError } = await supabase
        .from('integration_configs')
        .insert({
          org_id: stateData.org_id,
          provider_name: provider,
          integration_type: 'crm',
          status: 'connected',
          created_by: stateData.metadata?.initiated_by
        })
        .select('id')
        .single();

      if (insertError || !newConfig) {
        console.error('Failed to create config:', insertError);
        return redirectWithError(
          'Failed to save integration',
          'Database error'
        );
      }
      configId = newConfig.id;
    }

    // Store encrypted tokens
    const tokenData = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope,
      instance_url: tokens.instance_url // Salesforce-specific
    });

    // Delete existing credentials for this config
    await supabase
      .from('integration_credentials')
      .delete()
      .eq('integration_config_id', configId);

    // Insert new credentials
    const { error: credError } = await supabase
      .from('integration_credentials')
      .insert({
        org_id: stateData.org_id,
        integration_config_id: configId,
        credential_type: 'oauth_token',
        encrypted_value: tokenData, // In production, encrypt this
        expires_at: tokenExpiresAt.toISOString(),
        created_by: stateData.metadata?.initiated_by
      });

    if (credError) {
      console.error('Failed to store credentials:', credError);
      return redirectWithError(
        'Failed to store credentials',
        'Database error'
      );
    }

    // Clean up state token
    await supabase.from('oauth_state').delete().eq('state_token', state);

    console.log(`OAuth flow completed for ${provider}, org: ${stateData.org_id}`);

    // Redirect back to app with success
    const redirectUrl = new URL(stateData.redirect_url);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('provider', provider);

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirectWithError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

function redirectWithError(error: string, description: string): Response {
  // Redirect to production app with error parameters
  const redirectUrl = new URL('https://launchpulse.io/settings');
  redirectUrl.searchParams.set('oauth_error', error);
  redirectUrl.searchParams.set('oauth_error_description', description);
  
  return Response.redirect(redirectUrl.toString(), 302);
}

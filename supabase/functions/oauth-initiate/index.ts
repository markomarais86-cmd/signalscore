import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OAuthInitiateRequest {
  provider: 'salesforce' | 'hubspot' | 'outreach' | 'salesloft';
  redirect_url: string;
}

const OAUTH_CONFIG: Record<string, {
  authUrl: string;
  clientIdEnv: string;
  scopes: string[];
}> = {
  salesforce: {
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    clientIdEnv: 'SALESFORCE_CLIENT_ID',
    scopes: ['api', 'refresh_token', 'offline_access']
  },
  hubspot: {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read']
  },
  outreach: {
    authUrl: 'https://api.outreach.io/oauth/authorize',
    clientIdEnv: 'OUTREACH_CLIENT_ID',
    scopes: ['prospects.read', 'accounts.read', 'sequences.read']
  },
  salesloft: {
    authUrl: 'https://accounts.salesloft.com/oauth/authorize',
    clientIdEnv: 'SALESLOFT_CLIENT_ID',
    scopes: ['people.read', 'accounts.read']
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: OAuthInitiateRequest = await req.json();
    const { provider, redirect_url } = body;

    // Validate provider
    if (!OAUTH_CONFIG[provider]) {
      return new Response(
        JSON.stringify({ error: `Unsupported provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = OAUTH_CONFIG[provider];
    const clientId = Deno.env.get(config.clientIdEnv);
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: `OAuth not configured for ${provider}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure state token
    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store state token in database
    const { error: insertError } = await supabase
      .from('oauth_state')
      .insert({
        org_id: profile.org_id,
        state_token: stateToken,
        provider,
        redirect_url,
        expires_at: expiresAt.toISOString(),
        metadata: {
          initiated_by: user.id,
          initiated_at: new Date().toISOString()
        }
      });

    if (insertError) {
      console.error('Failed to store OAuth state:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build authorization URL
    const callbackUrl = `${SUPABASE_URL}/functions/v1/oauth-callback`;
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', stateToken);

    // Add provider-specific parameters
    if (provider === 'salesforce') {
      authUrl.searchParams.set('prompt', 'login consent');
    }

    console.log(`OAuth flow initiated for ${provider}, org: ${profile.org_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        stateToken // Return for debugging in development only
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth initiate error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

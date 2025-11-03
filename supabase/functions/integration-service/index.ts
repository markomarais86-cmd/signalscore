import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface IntegrationConfig {
  id?: string;
  provider_name: string;
  integration_type: 'crm' | 'data_enrichment' | 'sales_engagement' | 'forecasting' | 'webhook';
  config?: Record<string, any>;
  sync_frequency?: string;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      throw new Error('User not associated with an organization');
    }

    // Read action from request body
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    
    console.log('[integration-service] Action:', action, 'Body:', body);

    switch (action) {
      case 'list':
        return await listIntegrations(supabase, profile.org_id);
      
      case 'connect':
        return await connectIntegration(supabase, profile.org_id, req);
      
      case 'disconnect':
        return await disconnectIntegration(supabase, profile.org_id, req);
      
      case 'test':
        return await testConnection(supabase, profile.org_id, body);
      
      case 'check-secrets':
        return await checkSecrets(body.provider);
      
      case 'sync':
        return await triggerSync(supabase, profile.org_id, req);
      
      case 'status':
        return await getIntegrationStatus(supabase, profile.org_id, req);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Integration service error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function listIntegrations(supabase: any, orgId: string) {
  const { data: configs, error } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get recent sync logs for each integration
  const configsWithStats = await Promise.all(
    configs.map(async (config: any) => {
      const { data: recentSyncs } = await supabase
        .from('integration_sync_logs')
        .select('*')
        .eq('integration_config_id', config.id)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        ...config,
        recent_syncs: recentSyncs || [],
        has_credentials: await hasCredentials(supabase, config.id)
      };
    })
  );

  return new Response(
    JSON.stringify({ integrations: configsWithStats }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function connectIntegration(supabase: any, orgId: string, req: Request) {
  const body = await req.json();
  const { provider_name, integration_type, api_key, config } = body;

  // Check if integration already exists
  const { data: existing } = await supabase
    .from('integration_configs')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider_name', provider_name)
    .single();

  let configId: string;

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('integration_configs')
      .update({
        status: 'connected',
        config: config || {},
        is_active: true,
        error_message: null,
        error_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    configId = existing.id;
  } else {
    // Create new
    const { data, error } = await supabase
      .from('integration_configs')
      .insert({
        org_id: orgId,
        provider_name,
        integration_type,
        status: 'connected',
        config: config || {},
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    configId = data.id;
  }

  // Store API key if provided
  if (api_key) {
    const keyPrefix = api_key.substring(0, 4) + '...' + api_key.substring(api_key.length - 4);
    
    // Delete old credentials
    await supabase
      .from('integration_credentials')
      .delete()
      .eq('integration_config_id', configId);

    // Insert new credential
    const { error: credError } = await supabase
      .from('integration_credentials')
      .insert({
        org_id: orgId,
        integration_config_id: configId,
        credential_type: 'api_key',
        encrypted_value: api_key, // In production, this should be encrypted
        key_prefix: keyPrefix
      });

    if (credError) throw credError;
  }

  // Log the connection
  await supabase
    .from('audit_logs')
    .insert({
      org_id: orgId,
      action: 'integration_connected',
      actor: 'system',
      meta: { provider: provider_name }
    });

  return new Response(
    JSON.stringify({ success: true, config_id: configId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function disconnectIntegration(supabase: any, orgId: string, req: Request) {
  const body = await req.json();
  const { provider_name } = body;

  const { error } = await supabase
    .from('integration_configs')
    .update({
      status: 'disconnected',
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('org_id', orgId)
    .eq('provider_name', provider_name);

  if (error) throw error;

  await supabase
    .from('audit_logs')
    .insert({
      org_id: orgId,
      action: 'integration_disconnected',
      actor: 'system',
      meta: { provider: provider_name }
    });

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function testConnection(supabase: any, orgId: string, body: any) {
  const { provider_name, api_key } = body;
  
  console.log('[testConnection] Testing:', provider_name);

  let result: TestConnectionResult;

  try {
    // Test based on provider
    switch (provider_name.toLowerCase()) {
      case 'zoominfo':
        result = await testZoomInfo(api_key);
        break;
      case 'apollo':
        result = await testApollo(api_key);
        break;
      case 'clearbit':
        result = await testClearbit(api_key);
        break;
      case 'peopledatalabs':
      case 'pdl':
        result = await testPDL(api_key);
        break;
      default:
        result = {
          success: false,
          message: 'Provider not supported for testing'
        };
    }

    // Update integration status if test successful
    if (result.success) {
      await supabase
        .from('integration_configs')
        .update({
          status: 'connected',
          error_message: null,
          error_count: 0
        })
        .eq('org_id', orgId)
        .eq('provider_name', provider_name);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        details: error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function triggerSync(supabase: any, orgId: string, req: Request) {
  const body = await req.json();
  const { provider_name } = body;

  // Get integration config
  const { data: config, error: configError } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider_name', provider_name)
    .single();

  if (configError) throw configError;

  // Create sync log
  const { data: syncLog, error: logError } = await supabase
    .from('integration_sync_logs')
    .insert({
      org_id: orgId,
      integration_config_id: config.id,
      sync_status: 'running',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (logError) throw logError;

  // Update config status
  await supabase
    .from('integration_configs')
    .update({
      status: 'syncing',
      last_sync_at: new Date().toISOString()
    })
    .eq('id', config.id);

  // Trigger async sync (in production, this would be a separate process)
  // For now, simulate completion
  setTimeout(async () => {
    await supabase
      .from('integration_sync_logs')
      .update({
        sync_status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: 5000,
        records_processed: 100
      })
      .eq('id', syncLog.id);

    await supabase
      .from('integration_configs')
      .update({ status: 'connected' })
      .eq('id', config.id);
  }, 5000);

  return new Response(
    JSON.stringify({ success: true, sync_log_id: syncLog.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getIntegrationStatus(supabase: any, orgId: string, req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');

  const query = supabase
    .from('integration_configs')
    .select('*, integration_sync_logs(*)')
    .eq('org_id', orgId);

  if (provider) {
    query.eq('provider_name', provider);
  }

  const { data, error } = await query;

  if (error) throw error;

  return new Response(
    JSON.stringify({ integrations: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper functions for testing integrations
async function testZoomInfo(apiKey: string): Promise<TestConnectionResult> {
  try {
    const response = await fetch('https://api.zoominfo.com/lookup/person', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com'
      })
    });

    if (response.status === 401) {
      return { success: false, message: 'Invalid API key' };
    }

    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : 'Connection failed'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testApollo(apiKey: string): Promise<TestConnectionResult> {
  try {
    const response = await fetch('https://api.apollo.io/v1/auth/health', {
      headers: {
        'X-Api-Key': apiKey
      }
    });

    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : 'Invalid API key'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testClearbit(apiKey: string): Promise<TestConnectionResult> {
  try {
    const response = await fetch('https://company.clearbit.com/v2/companies/domain/clearbit.com', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : 'Invalid API key'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testPDL(apiKey: string): Promise<TestConnectionResult> {
  try {
    const response = await fetch('https://api.peopledatalabs.com/v5/person/enrich', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com'
      })
    });

    if (response.status === 402) {
      return {
        success: false,
        message: 'PDL account requires payment or has no credits remaining',
        details: { status: 402, statusText: 'Payment Required' }
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key - check your PDL_API_KEY secret',
        details: { status: 401, statusText: 'Unauthorized' }
      };
    }

    return {
      success: response.status === 200 || response.status === 404, // 404 means API key works but no data
      message: response.ok || response.status === 404 ? 'Connection successful - PDL is ready to use' : `Connection failed (${response.status})`,
      details: { status: response.status, statusText: response.statusText }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function checkSecrets(provider: string | null) {
  console.log('[checkSecrets] Checking provider:', provider);

  const envVarMap: { [key: string]: string } = {
    'pdl': 'PDL_API_KEY',
    'clearbit': 'CLEARBIT_API_KEY'
  };

  if (!provider || !envVarMap[provider]) {
    return new Response(
      JSON.stringify({ error: 'Invalid provider' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const envVar = envVarMap[provider];
  const isConfigured = !!Deno.env.get(envVar);

  return new Response(
    JSON.stringify({ 
      configured: isConfigured,
      provider,
      envVar,
      message: isConfigured 
        ? `${envVar} is configured in Supabase Secrets` 
        : `${envVar} is not configured - add it via Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function hasCredentials(supabase: any, configId: string): Promise<boolean> {
  const { data } = await supabase
    .from('integration_credentials')
    .select('id')
    .eq('integration_config_id', configId)
    .limit(1);

  return data && data.length > 0;
}
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
        return await connectIntegration(supabase, profile.org_id, body);
      
      case 'disconnect':
        return await disconnectIntegration(supabase, profile.org_id, body);
      
      case 'test':
        return await testConnection(supabase, profile.org_id, body);
      
      case 'check-secrets':
        return await checkSecrets(body.provider);
      
      case 'sync':
      case 'triggerSync':
        return await triggerSync(supabase, profile.org_id, body);
      
      case 'status':
        return await getIntegrationStatus(supabase, profile.org_id, req);
      
      case 'getFields':
        return await getFields(supabase, profile.org_id, body);
      
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

async function connectIntegration(supabase: any, orgId: string, body: any) {
  const { provider_name, integration_type, api_key, config, salesforce_credentials, sync_frequency } = body;

  // Build the config object with sync frequency
  const integrationConfig = {
    ...(config || {}),
    sync_frequency: sync_frequency || 'manual'
  };

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
        config: integrationConfig,
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
        config: integrationConfig
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

  // Store Salesforce credentials if provided
  if (salesforce_credentials) {
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
        credential_type: 'basic_auth',
        encrypted_value: JSON.stringify(salesforce_credentials), // Store all creds as JSON
        key_prefix: salesforce_credentials.username?.substring(0, 8) + '...'
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
    JSON.stringify({ 
      success: true, 
      config_id: configId,
      integration_id: configId  // Alias for backward compatibility
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function disconnectIntegration(supabase: any, orgId: string, body: any) {
  const { provider_name } = body;

  const { error } = await supabase
    .from('integration_configs')
    .update({
      status: 'disconnected',
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
  const { provider_name, api_key, salesforce_credentials } = body;
  
  console.log('[testConnection] Testing:', provider_name);

  let result: TestConnectionResult;

  try {
    // Test based on provider
    switch (provider_name.toLowerCase()) {
      case 'salesforce':
        if (!salesforce_credentials) {
          result = { success: false, message: 'Salesforce credentials required' };
        } else {
          result = await testSalesforce(
            salesforce_credentials.instanceUrl,
            salesforce_credentials.username,
            salesforce_credentials.password,
            salesforce_credentials.securityToken
          );
        }
        break;
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

async function triggerSync(supabase: any, orgId: string, body: any) {
  const { provider_name, integration_id, full_sync = false } = body;

  // Get integration config
  let config;
  if (integration_id) {
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('id', integration_id)
      .eq('org_id', orgId)
      .single();
    if (error) throw error;
    config = data;
  } else {
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('org_id', orgId)
      .eq('provider_name', provider_name)
      .single();
    if (error) throw error;
    config = data;
  }

  // If it's Salesforce, call the dedicated sync function
  if (config.provider_name.toLowerCase() === 'salesforce') {
    console.log('Calling Salesforce sync edge function');
    
    try {
      const syncResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/salesforce-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            org_id: orgId,
            integration_config_id: config.id,
            full_sync: full_sync,
          }),
        }
      );

      const result = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(result.error || 'Salesforce sync failed');
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('Salesforce sync error:', error);
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
  }

  // If it's HubSpot, call the dedicated sync function
  if (config.provider_name.toLowerCase() === 'hubspot') {
    console.log('Calling HubSpot sync edge function');
    
    try {
      const syncResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/hubspot-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            org_id: orgId,
            integration_config_id: config.id,
            full_sync: full_sync,
          }),
        }
      );

      const result = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(result.error || 'HubSpot sync failed');
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('HubSpot sync error:', error);
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
  }

  // For other providers, create sync log and simulate
  const { data: syncLog, error: logError } = await supabase
    .from('integration_sync_logs')
    .insert({
      org_id: orgId,
      integration_config_id: config.id,
      status: 'in_progress',
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

  // Simulate completion for other providers
  setTimeout(async () => {
    await supabase
      .from('integration_sync_logs')
      .update({
        status: 'completed',
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
async function testSalesforce(
  instanceUrl: string,
  username: string,
  password: string,
  securityToken: string
): Promise<TestConnectionResult> {
  try {
    // Ensure instance URL has proper format
    const cleanUrl = instanceUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    const loginUrl = `https://${cleanUrl}/services/Soap/u/58.0`;
    
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8" ?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>${username}</n1:username>
      <n1:password>${password}${securityToken}</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>`;

    console.log('[testSalesforce] Attempting login to:', loginUrl);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'login',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    console.log('[testSalesforce] Response status:', response.status);
    
    if (responseText.includes('<sessionId>')) {
      return { success: true, message: 'Salesforce connection successful' };
    } else if (responseText.includes('INVALID_LOGIN')) {
      return {
        success: false,
        message: 'Invalid credentials. Please check your username, password, and security token.',
      };
    } else if (responseText.includes('faultcode')) {
      // Extract error message from SOAP fault
      const errorMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
      return {
        success: false,
        message: `Salesforce error: ${errorMsg}`,
      };
    } else {
      return {
        success: false,
        message: `Salesforce connection failed: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    console.error('[testSalesforce] Error:', error);
    return {
      success: false,
      message: `Salesforce connection error: ${error.message}`,
    };
  }
}

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

async function getFields(supabase: any, orgId: string, body: any) {
  const { provider, integration_id } = body;

  try {
    // Get integration config and credentials
    const { data: config, error: configError } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('id', integration_id)
      .eq('org_id', orgId)
      .single();

    if (configError) throw configError;

    const { data: credential } = await supabase
      .from('integration_credentials')
      .select('encrypted_credentials')
      .eq('integration_config_id', integration_id)
      .single();

    if (!credential?.encrypted_credentials) {
      throw new Error('No credentials found');
    }

    let fields = {
      accounts: [],
      contacts: [],
      leads: []
    };

    if (provider === 'salesforce') {
      // Get Salesforce fields via REST API
      const creds = credential.encrypted_credentials as any;
      
      // Get session ID first
      const sessionResponse = await fetch(
        `${creds.instance_url}/services/Soap/u/58.0`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml', 'SOAPAction': 'login' },
          body: `<?xml version="1.0" encoding="utf-8"?>
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
              <soapenv:Body>
                <urn:login>
                  <urn:username>${creds.username}</urn:username>
                  <urn:password>${creds.password}${creds.security_token}</urn:password>
                </urn:login>
              </soapenv:Body>
            </soapenv:Envelope>`
        }
      );

      const sessionText = await sessionResponse.text();
      const sessionIdMatch = sessionText.match(/<sessionId>([^<]+)<\/sessionId>/);
      const serverUrlMatch = sessionText.match(/<serverUrl>([^<]+)<\/serverUrl>/);

      if (!sessionIdMatch || !serverUrlMatch) {
        throw new Error('Failed to authenticate with Salesforce');
      }

      const sessionId = sessionIdMatch[1];
      const baseUrl = serverUrlMatch[1].replace(/\/services\/.*/, '');

      // Fetch Account fields
      const accountFieldsResponse = await fetch(
        `${baseUrl}/services/data/v58.0/sobjects/Account/describe`,
        { headers: { 'Authorization': `Bearer ${sessionId}` } }
      );
      const accountFieldsData = await accountFieldsResponse.json();
      fields.accounts = accountFieldsData.fields?.slice(0, 50).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && !f.defaultedOnCreate
      })) || [];

      // Fetch Contact fields
      const contactFieldsResponse = await fetch(
        `${baseUrl}/services/data/v58.0/sobjects/Contact/describe`,
        { headers: { 'Authorization': `Bearer ${sessionId}` } }
      );
      const contactFieldsData = await contactFieldsResponse.json();
      fields.contacts = contactFieldsData.fields?.slice(0, 50).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && !f.defaultedOnCreate
      })) || [];

      // Fetch Lead fields
      const leadFieldsResponse = await fetch(
        `${baseUrl}/services/data/v58.0/sobjects/Lead/describe`,
        { headers: { 'Authorization': `Bearer ${sessionId}` } }
      );
      const leadFieldsData = await leadFieldsResponse.json();
      fields.leads = leadFieldsData.fields?.slice(0, 50).map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && !f.defaultedOnCreate
      })) || [];

    } else if (provider === 'hubspot') {
      // Get HubSpot fields via REST API
      const creds = credential.encrypted_credentials as any;
      const accessToken = creds.access_token;

      // Fetch Company properties
      const companyPropsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/properties/companies',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const companyPropsData = await companyPropsResponse.json();
      fields.accounts = companyPropsData.results?.slice(0, 50).map((p: any) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        required: false
      })) || [];

      // Fetch Contact properties
      const contactPropsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/properties/contacts',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const contactPropsData = await contactPropsResponse.json();
      fields.contacts = contactPropsData.results?.slice(0, 50).map((p: any) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        required: false
      })) || [];

      // Fetch Deal properties
      const dealPropsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/properties/deals',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const dealPropsData = await dealPropsResponse.json();
      fields.leads = dealPropsData.results?.slice(0, 50).map((p: any) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        required: false
      })) || [];
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        fields 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching fields:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function hasCredentials(supabase: any, configId: string): Promise<boolean> {
  const { data } = await supabase
    .from('integration_credentials')
    .select('id')
    .eq('integration_config_id', configId)
    .limit(1);

  return data && data.length > 0;
}
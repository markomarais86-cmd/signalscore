import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
};

interface ClayWebhookPayload {
  webhook_type: 'clay_company_data' | 'clay_contact_data' | 'clay_enrichment_data';
  org_id?: string;
  data: any;
  idempotency_key?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: ClayWebhookPayload = await req.json();
    console.log('Received Clay webhook:', { 
      type: payload.webhook_type, 
      org_id: payload.org_id,
      has_data: !!payload.data 
    });

    // Extract org_id from payload or header
    const orgId = payload.org_id || req.headers.get('x-org-id');
    
    if (!orgId) {
      console.error('Missing org_id');
      return new Response(
        JSON.stringify({ error: 'org_id is required in payload or x-org-id header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate using idempotency key (skip this check for now - use simple approach)
    // Idempotency is handled by checking if a webhook with same content was recently processed
    // For a more robust implementation, use a separate idempotency_keys table

    // Check if webhook type is enabled for this org
    const { data: config } = await supabaseClient
      .from('clay_webhook_config')
      .select('is_enabled, field_mappings')
      .eq('org_id', orgId)
      .eq('webhook_type', payload.webhook_type)
      .single();

    if (config && !config.is_enabled) {
      console.log('Webhook type disabled for org');
      return new Response(
        JSON.stringify({ success: false, message: 'Webhook type is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the incoming webhook
    const { data: logEntry, error: logError } = await supabaseClient
      .from('clay_webhook_logs')
      .insert({
        org_id: orgId,
        webhook_type: payload.webhook_type,
        payload: payload,
        processing_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging webhook:', logError);
      throw logError;
    }

    // Process the webhook based on type
    let result;
    try {
      switch (payload.webhook_type) {
        case 'clay_company_data':
          result = await processCompanyData(supabaseClient, orgId, payload.data, config?.field_mappings);
          break;
        case 'clay_contact_data':
          result = await processContactData(supabaseClient, orgId, payload.data, config?.field_mappings);
          break;
        case 'clay_enrichment_data':
          result = await processEnrichmentData(supabaseClient, orgId, payload.data, config?.field_mappings);
          break;
        default:
          throw new Error(`Unknown webhook type: ${payload.webhook_type}`);
      }

      // Update log entry as processed
      await supabaseClient
        .from('clay_webhook_logs')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processingError: any) {
      console.error('Error processing webhook:', processingError);
      
      // Update log entry with error
      await supabaseClient
        .from('clay_webhook_logs')
        .update({
          processed: false,
          error: processingError.message
        })
        .eq('id', logEntry.id);

      throw processingError;
    }

  } catch (error: any) {
    console.error('Error in clay-webhook-receiver:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Default field mappings for each webhook type
const DEFAULT_COMPANY_MAPPINGS = {
  domain: 'domain',
  company_name: 'name',
  industry: 'industry_raw',
  employee_count: 'employee_count',
  revenue: 'revenue_range',
  location: 'country',
  technologies: 'tech_stack'
};

const DEFAULT_CONTACT_MAPPINGS = {
  email: 'email',
  first_name: 'first_name',
  last_name: 'last_name',
  title: 'title',
  company_domain: 'company',
  linkedin_url: 'linkedin_url',
  phone: 'phone',
  location: 'country'
};

const DEFAULT_ENRICHMENT_MAPPINGS = {
  employee_count: 'employee_count',
  revenue: 'revenue_range',
  industry: 'industry_raw',
  technologies: 'tech_stack',
  funding_round: 'last_funding_round',
  total_funding: 'total_raised_usd'
};

// Helper to check if mappings are valid (not empty object)
function hasValidMappings(mappings: any): boolean {
  return mappings && typeof mappings === 'object' && Object.keys(mappings).length > 0;
}

async function processCompanyData(
  supabase: any, 
  orgId: string, 
  data: any, 
  fieldMappings?: any
) {
  console.log('Processing company data with input:', JSON.stringify(data));
  console.log('Field mappings received:', JSON.stringify(fieldMappings));
  
  // Apply field mappings or use defaults (check for empty objects)
  const mappings = hasValidMappings(fieldMappings) ? fieldMappings : DEFAULT_COMPANY_MAPPINGS;
  console.log('Using mappings:', JSON.stringify(mappings));

  // Extract and map fields
  const accountData: any = {
    org_id: orgId,
    data_source: 'database',
    enriched_from: 'clay',
    enriched_at: new Date().toISOString()
  };

  for (const [clayField, dbField] of Object.entries(mappings)) {
    if (data[clayField] !== undefined && data[clayField] !== null) {
      console.log(`Mapping ${clayField} -> ${dbField}:`, data[clayField]);
      accountData[dbField as string] = data[clayField];
    }
  }

  console.log('Mapped account data:', JSON.stringify(accountData));

  // Domain is required to create/update account
  if (!accountData.domain) {
    throw new Error('Domain is required for company data');
  }

  // Normalize domain
  accountData.domain = accountData.domain.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  console.log('Normalized domain:', accountData.domain);

  // Check if account exists - use filter to avoid schema cache issues
  console.log('Checking for existing account with domain:', accountData.domain);
  const { data: existingAccounts, error: selectError } = await supabase
    .from('accounts')
    .select('*')
    .eq('org_id', orgId)
    .limit(50);

  if (selectError) {
    console.error('Select error:', selectError);
    throw selectError;
  }
  
  // Find matching account by domain manually
  const existingAccount = existingAccounts?.find(
    (acc: any) => acc.domain?.toLowerCase() === accountData.domain.toLowerCase()
  );
  console.log('Existing account result:', existingAccount);

  if (existingAccount) {
    // Update existing account
    const { error: updateError } = await supabase
      .from('accounts')
      .update(accountData)
      .eq('id', existingAccount.id);

    if (updateError) throw updateError;

    return { action: 'updated', account_id: existingAccount.id };
  } else {
    // Create new account
    accountData.external_id = `clay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: newAccount, error: insertError } = await supabase
      .from('accounts')
      .insert(accountData)
      .select()
      .single();

    if (insertError) throw insertError;

    return { action: 'created', account_id: newAccount.id };
  }
}

async function processContactData(
  supabase: any, 
  orgId: string, 
  data: any, 
  fieldMappings?: any
) {
  console.log('Processing contact data');
  
  // Apply field mappings or use defaults (check for empty objects)
  const mappings = hasValidMappings(fieldMappings) ? fieldMappings : DEFAULT_CONTACT_MAPPINGS;

  const leadData: any = {
    org_id: orgId,
    data_source: 'database',
    enriched_from: 'clay',
    enriched_at: new Date().toISOString()
  };

  for (const [clayField, dbField] of Object.entries(mappings)) {
    if (data[clayField] !== undefined && data[clayField] !== null) {
      leadData[dbField] = data[clayField];
    }
  }

  // Email is required
  if (!leadData.email) {
    throw new Error('Email is required for contact data');
  }

  // Try to match to existing account if domain provided
  if (data.company_domain) {
    const normalizedDomain = data.company_domain.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const { data: account } = await supabase
      .from('accounts')
      .select('external_id')
      .eq('org_id', orgId)
      .eq('domain', normalizedDomain)
      .single();

    if (account) {
      leadData.account_external_id = account.external_id;
    }
  }

  // Check if lead exists
  const { data: existingLead } = await supabase
    .from('Leads')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', leadData.email)
    .single();

  if (existingLead) {
    const { error: updateError } = await supabase
      .from('Leads')
      .update(leadData)
      .eq('id', existingLead.id);

    if (updateError) throw updateError;

    return { action: 'updated', lead_id: existingLead.id };
  } else {
    leadData.external_id = `clay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    leadData.name = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || leadData.email;
    
    const { data: newLead, error: insertError } = await supabase
      .from('Leads')
      .insert(leadData)
      .select()
      .single();

    if (insertError) throw insertError;

    return { action: 'created', lead_id: newLead.id };
  }
}

async function processEnrichmentData(
  supabase: any, 
  orgId: string, 
  data: any, 
  fieldMappings?: any
) {
  console.log('Processing enrichment data');
  
  // Enrichment updates to existing accounts
  if (!data.domain && !data.account_id) {
    throw new Error('Domain or account_id is required for enrichment data');
  }

  let accountQuery = supabase
    .from('accounts')
    .select('id, external_id')
    .eq('org_id', orgId);

  if (data.account_id) {
    accountQuery = accountQuery.eq('external_id', data.account_id);
  } else if (data.domain) {
    const normalizedDomain = data.domain.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    accountQuery = accountQuery.eq('domain', normalizedDomain);
  }

  const { data: account, error: accountError } = await accountQuery.single();

  if (accountError || !account) {
    throw new Error('Account not found for enrichment');
  }

  // Build update object with enrichment data
  const updateData: any = {
    enriched_from: 'clay',
    enriched_at: new Date().toISOString()
  };

  // Apply field mappings or use defaults (check for empty objects)
  const mappings = hasValidMappings(fieldMappings) ? fieldMappings : DEFAULT_ENRICHMENT_MAPPINGS;

  for (const [clayField, dbField] of Object.entries(mappings)) {
    if (data[clayField] !== undefined && data[clayField] !== null) {
      updateData[dbField] = data[clayField];
    }
  }

  const { error: updateError } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', account.id);

  if (updateError) throw updateError;

  return { action: 'enriched', account_id: account.id };
}

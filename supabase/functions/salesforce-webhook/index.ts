import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { corsHeaders } from '../_shared/cors.ts';

interface WebhookLog {
  org_id: string;
  webhook_type: 'outbound_message' | 'platform_event' | 'change_data_capture';
  object_type: string;
  record_id: string;
  action: 'created' | 'updated' | 'deleted' | 'undeleted';
  payload: any;
  processed: boolean;
  error_message?: string;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const contentType = req.headers.get('content-type') || '';
    let webhookData: any;
    let webhookType: 'outbound_message' | 'platform_event' | 'change_data_capture';

    // Determine webhook type based on content type
    if (contentType.includes('text/xml') || contentType.includes('application/soap+xml')) {
      // Outbound Message (SOAP XML)
      console.log('Received Salesforce Outbound Message');
      webhookType = 'outbound_message';
      const xmlBody = await req.text();
      webhookData = await parseOutboundMessage(xmlBody);
    } else {
      // Platform Event or Change Data Capture (JSON)
      console.log('Received Salesforce Platform Event or CDC');
      const jsonBody = await req.json();
      
      // Detect if it's CDC or Platform Event
      if (jsonBody.data?.event?.replayId) {
        webhookType = 'change_data_capture';
        webhookData = parseCDCEvent(jsonBody);
      } else {
        webhookType = 'platform_event';
        webhookData = parsePlatformEvent(jsonBody);
      }
    }

    console.log('Parsed webhook data:', webhookData);

    // Validate webhook authenticity
    const validationResult = await validateWebhook(req, webhookData);
    if (!validationResult.valid) {
      console.error('Webhook validation failed:', validationResult.reason);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization ID from webhook data or use verification
    const org_id = webhookData.org_id || await getOrgIdFromIntegration(supabaseClient, webhookData.organization_id);

    if (!org_id) {
      console.error('Could not determine organization ID');
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log webhook receipt
    const webhookLog: WebhookLog = {
      org_id,
      webhook_type: webhookType,
      object_type: webhookData.objectType,
      record_id: webhookData.recordId,
      action: webhookData.action,
      payload: webhookData.raw,
      processed: false,
    };

    const { data: logEntry, error: logError } = await supabaseClient
      .from('webhook_logs')
      .insert(webhookLog)
      .select()
      .single();

    if (logError) {
      console.error('Error logging webhook:', logError);
    }

    // Process the webhook data
    try {
      await processWebhookData(supabaseClient, org_id, webhookData);

      // Mark as processed
      if (logEntry) {
        await supabaseClient
          .from('webhook_logs')
          .update({ processed: true })
          .eq('id', logEntry.id);
      }

      // Return appropriate response based on webhook type
      if (webhookType === 'outbound_message') {
        // Salesforce expects SOAP acknowledgment
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">
      <Ack>true</Ack>
    </notificationsResponse>
  </soapenv:Body>
</soapenv:Envelope>`,
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'text/xml' 
            } 
          }
        );
      } else {
        // Platform Event / CDC expects JSON
        return new Response(
          JSON.stringify({ success: true, processed: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error: any) {
      console.error('Error processing webhook:', error);

      // Mark as failed
      if (logEntry) {
        await supabaseClient
          .from('webhook_logs')
          .update({ 
            processed: false,
            error_message: error.message 
          })
          .eq('id', logEntry.id);
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function parseOutboundMessage(xmlBody: string): Promise<any> {
  console.log('Parsing Outbound Message XML:', xmlBody.substring(0, 500));

  // Extract organization ID
  const orgIdMatch = xmlBody.match(/<OrganizationId>([^<]+)<\/OrganizationId>/);
  const organizationId = orgIdMatch ? orgIdMatch[1] : null;

  // Extract session ID for validation
  const sessionIdMatch = xmlBody.match(/<SessionId>([^<]+)<\/SessionId>/);
  const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;

  // Extract notification records
  const notifications: any[] = [];
  const notificationRegex = /<Notification>([\s\S]*?)<\/Notification>/g;
  let match;

  while ((match = notificationRegex.exec(xmlBody)) !== null) {
    const notification = match[1];
    
    // Extract sObject
    const sObjectMatch = notification.match(/<sObject[^>]*>([\s\S]*?)<\/sObject>/);
    if (sObjectMatch) {
      const sObject = sObjectMatch[1];
      
      // Extract object type
      const typeMatch = sObject.match(/xsi:type="sf:([^"]+)"/);
      const objectType = typeMatch ? typeMatch[1] : 'Unknown';
      
      // Extract Id
      const idMatch = sObject.match(/<sf:Id>([^<]+)<\/sf:Id>/);
      const recordId = idMatch ? idMatch[1] : null;
      
      // Extract all fields
      const fields: Record<string, any> = {};
      const fieldRegex = /<sf:([^>]+)>([^<]*)<\/sf:[^>]+>/g;
      let fieldMatch;
      
      while ((fieldMatch = fieldRegex.exec(sObject)) !== null) {
        fields[fieldMatch[1]] = fieldMatch[2];
      }

      notifications.push({
        objectType,
        recordId,
        action: 'updated' as const,
        fields,
        organization_id: organizationId,
        session_id: sessionId,
        raw: notification,
      });
    }
  }

  return notifications[0] || { organization_id: organizationId, session_id: sessionId, raw: xmlBody };
}

function parsePlatformEvent(jsonBody: any): any {
  console.log('Parsing Platform Event:', JSON.stringify(jsonBody, null, 2));

  // Platform Events have a specific structure
  const event = jsonBody.data?.payload || jsonBody;
  const recordId = event.RecordId__c || event.Id__c;
  const objectType = event.ObjectType__c || 'Unknown';
  const action = event.Action__c?.toLowerCase() || 'updated';

  return {
    objectType,
    recordId,
    action: mapAction(action),
    fields: event,
    organization_id: jsonBody.organizationId || event.OrganizationId__c,
    raw: jsonBody,
  };
}

function parseCDCEvent(jsonBody: any): any {
  console.log('Parsing CDC Event:', JSON.stringify(jsonBody, null, 2));

  // Change Data Capture events
  const event = jsonBody.data?.event;
  const payload = jsonBody.data?.payload;
  
  const changeType = event?.changeType || 'UPDATE';
  const entityName = event?.entityName;
  const recordIds = event?.recordIds || [];

  return {
    objectType: entityName || 'Unknown',
    recordId: recordIds[0] || payload?.Id,
    action: mapCDCAction(changeType),
    fields: payload || {},
    organization_id: jsonBody.organizationId,
    change_type: changeType,
    replay_id: event?.replayId,
    raw: jsonBody,
  };
}

function mapAction(action: string): 'created' | 'updated' | 'deleted' | 'undeleted' {
  const actionMap: Record<string, 'created' | 'updated' | 'deleted' | 'undeleted'> = {
    'create': 'created',
    'created': 'created',
    'update': 'updated',
    'updated': 'updated',
    'delete': 'deleted',
    'deleted': 'deleted',
    'undelete': 'undeleted',
    'undeleted': 'undeleted',
  };
  return actionMap[action.toLowerCase()] || 'updated';
}

function mapCDCAction(changeType: string): 'created' | 'updated' | 'deleted' | 'undeleted' {
  const actionMap: Record<string, 'created' | 'updated' | 'deleted' | 'undeleted'> = {
    'CREATE': 'created',
    'UPDATE': 'updated',
    'DELETE': 'deleted',
    'UNDELETE': 'undeleted',
  };
  return actionMap[changeType] || 'updated';
}

async function validateWebhook(req: Request, webhookData: any): Promise<{ valid: boolean; reason?: string }> {
  // For Outbound Messages, validate using organization ID and optionally session ID
  if (webhookData.session_id) {
    // In production, you would validate the session ID against Salesforce
    // For now, we'll accept if organization_id is present
    if (!webhookData.organization_id) {
      return { valid: false, reason: 'Missing organization ID' };
    }
  }

  // Additional validation: Check if the organization has Salesforce integration
  // This would be implemented based on your security requirements

  return { valid: true };
}

async function getOrgIdFromIntegration(supabaseClient: any, salesforceOrgId: string): Promise<string | null> {
  // Look up the organization ID based on Salesforce org ID
  // This assumes you store the Salesforce org ID in integration_configs
  const { data, error } = await supabaseClient
    .from('integration_configs')
    .select('org_id')
    .eq('provider_name', 'salesforce')
    .contains('config', { salesforce_org_id: salesforceOrgId })
    .single();

  if (error || !data) {
    console.error('Could not find org for Salesforce org ID:', salesforceOrgId);
    return null;
  }

  return data.org_id;
}

async function processWebhookData(supabaseClient: any, org_id: string, webhookData: any) {
  const { objectType, recordId, action, fields } = webhookData;

  console.log(`Processing ${action} on ${objectType} record ${recordId}`);

  switch (objectType) {
    case 'Account':
      await processAccountUpdate(supabaseClient, org_id, recordId, action, fields);
      break;
    case 'Contact':
      await processContactUpdate(supabaseClient, org_id, recordId, action, fields);
      break;
    case 'Lead':
      await processLeadUpdate(supabaseClient, org_id, recordId, action, fields);
      break;
    default:
      console.log(`Unhandled object type: ${objectType}`);
  }
}

async function processAccountUpdate(
  supabaseClient: any,
  org_id: string,
  recordId: string,
  action: string,
  fields: any
) {
  if (action === 'deleted') {
    // Soft delete or mark as deleted
    await supabaseClient
      .from('accounts')
      .delete()
      .eq('org_id', org_id)
      .eq('external_id', recordId);
    console.log(`Deleted account ${recordId}`);
    return;
  }

  // Map Salesforce fields to our schema
  const accountData: any = {
    org_id,
    external_id: recordId,
    data_source: 'crm',
    updated_at: new Date().toISOString(),
  };

  if (fields.Name) accountData.name = fields.Name;
  if (fields.Website) accountData.domain = normalizeDomain(fields.Website);
  if (fields.Industry) accountData.industry_raw = fields.Industry;
  if (fields.NumberOfEmployees) accountData.employee_count = parseInt(fields.NumberOfEmployees);
  if (fields.AnnualRevenue) accountData.revenue_range = mapRevenueRange(parseFloat(fields.AnnualRevenue));
  if (fields.BillingCountry) accountData.country = fields.BillingCountry;
  if (fields.BillingState) accountData.state_province = fields.BillingState;
  if (fields.Phone) accountData.phone = fields.Phone;

  // Upsert account
  const { error } = await supabaseClient
    .from('accounts')
    .upsert(accountData, {
      onConflict: 'org_id,external_id',
    });

  if (error) {
    console.error(`Error upserting account ${recordId}:`, error);
    throw error;
  }

  console.log(`${action === 'created' ? 'Created' : 'Updated'} account ${recordId}`);
}

async function processContactUpdate(
  supabaseClient: any,
  org_id: string,
  recordId: string,
  action: string,
  fields: any
) {
  if (action === 'deleted') {
    await supabaseClient
      .from('Leads')
      .delete()
      .eq('org_id', org_id)
      .eq('external_id', recordId);
    console.log(`Deleted contact ${recordId}`);
    return;
  }

  const contactData: any = {
    org_id,
    external_id: recordId,
    contact_external_id: recordId,
    data_source: 'crm',
    status: 'open',
    updated_at: new Date().toISOString(),
  };

  if (fields.AccountId) contactData.account_external_id = fields.AccountId;
  if (fields.FirstName) contactData.first_name = fields.FirstName;
  if (fields.LastName) contactData.last_name = fields.LastName;
  if (fields.FirstName || fields.LastName) {
    contactData.name = `${fields.FirstName || ''} ${fields.LastName || ''}`.trim();
  }
  if (fields.Email) contactData.email = fields.Email;
  if (fields.Phone) contactData.phone = fields.Phone;
  if (fields.MobilePhone) contactData.mobile = fields.MobilePhone;
  if (fields.Title) {
    contactData.title = fields.Title;
    contactData.title_raw = fields.Title;
  }

  const { error } = await supabaseClient
    .from('Leads')
    .upsert(contactData, {
      onConflict: 'org_id,external_id',
    });

  if (error) {
    console.error(`Error upserting contact ${recordId}:`, error);
    throw error;
  }

  console.log(`${action === 'created' ? 'Created' : 'Updated'} contact ${recordId}`);
}

async function processLeadUpdate(
  supabaseClient: any,
  org_id: string,
  recordId: string,
  action: string,
  fields: any
) {
  if (action === 'deleted') {
    await supabaseClient
      .from('Leads')
      .delete()
      .eq('org_id', org_id)
      .eq('external_id', recordId);
    console.log(`Deleted lead ${recordId}`);
    return;
  }

  const leadData: any = {
    org_id,
    external_id: recordId,
    data_source: 'crm',
    updated_at: new Date().toISOString(),
  };

  if (fields.Company) leadData.company = fields.Company;
  if (fields.FirstName) leadData.first_name = fields.FirstName;
  if (fields.LastName) leadData.last_name = fields.LastName;
  if (fields.FirstName || fields.LastName) {
    leadData.name = `${fields.FirstName || ''} ${fields.LastName || ''}`.trim();
  }
  if (fields.Email) leadData.email = fields.Email;
  if (fields.Phone) leadData.phone = fields.Phone;
  if (fields.MobilePhone) leadData.mobile = fields.MobilePhone;
  if (fields.Title) {
    leadData.title = fields.Title;
    leadData.title_raw = fields.Title;
  }
  if (fields.Status) leadData.status = mapLeadStatus(fields.Status);
  if (fields.Industry) leadData.industry = fields.Industry;
  if (fields.Website) leadData.website = fields.Website;
  if (fields.Country) leadData.country = fields.Country;
  if (fields.State) leadData.state_province = fields.State;

  const { error } = await supabaseClient
    .from('Leads')
    .upsert(leadData, {
      onConflict: 'org_id,external_id',
    });

  if (error) {
    console.error(`Error upserting lead ${recordId}:`, error);
    throw error;
  }

  console.log(`${action === 'created' ? 'Created' : 'Updated'} lead ${recordId}`);
}

function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function mapRevenueRange(revenue: number | null): string | null {
  if (!revenue) return null;
  if (revenue < 1000000) return '$0-1M';
  if (revenue < 10000000) return '$1M-10M';
  if (revenue < 50000000) return '$10M-50M';
  if (revenue < 100000000) return '$50M-100M';
  if (revenue < 500000000) return '$100M-500M';
  return '$500M+';
}

function mapLeadStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Open - Not Contacted': 'open',
    'Working - Contacted': 'working',
    'Closed - Converted': 'converted',
    'Closed - Not Converted': 'closed',
  };
  return statusMap[status] || 'open';
}

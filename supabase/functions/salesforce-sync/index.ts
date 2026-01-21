import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const SALESFORCE_API_VERSION = 'v58.0';

interface SalesforceCredentials {
  username: string;
  password: string;
  securityToken: string;
  instanceUrl?: string;
}

interface SalesforceSyncRequest {
  org_id: string;
  integration_config_id: string;
  full_sync?: boolean;
}

interface SalesforceLoginResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { org_id, integration_config_id, full_sync = false } = await req.json() as SalesforceSyncRequest;

    console.log(`Starting Salesforce sync for org ${org_id}, integration ${integration_config_id}`);

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabaseClient
      .from('integration_sync_logs')
      .insert({
        org_id,
        integration_config_id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
      throw new Error('Failed to create sync log');
    }

    const syncLogId = syncLog.id;

    try {
      // Get integration config and credentials
      const { data: integration, error: integrationError } = await supabaseClient
        .from('integration_configs')
        .select(`
          *,
          integration_credentials (
            credential_type,
            encrypted_value
          )
        `)
        .eq('id', integration_config_id)
        .single();

      if (integrationError || !integration) {
        throw new Error('Integration configuration not found');
      }

      // Parse credentials
      const credentials = parseCredentials(integration.integration_credentials);
      
      // Authenticate with Salesforce
      console.log('Authenticating with Salesforce...');
      const authData = await authenticateSalesforce(credentials);

      // Get last sync timestamp for incremental sync
      const lastSyncAt = full_sync ? null : integration.last_sync_at;

      // Sync Accounts
      console.log('Syncing Salesforce Accounts...');
      const accountStats = await syncAccounts(supabaseClient, org_id, authData, lastSyncAt);

      // Sync Contacts
      console.log('Syncing Salesforce Contacts...');
      const contactStats = await syncContacts(supabaseClient, org_id, authData, lastSyncAt);

      // Sync Leads
      console.log('Syncing Salesforce Leads...');
      const leadStats = await syncLeads(supabaseClient, org_id, authData, lastSyncAt);

      // Calculate totals
      const totalProcessed = accountStats.processed + contactStats.processed + leadStats.processed;
      const totalCreated = accountStats.created + contactStats.created + leadStats.created;
      const totalUpdated = accountStats.updated + contactStats.updated + leadStats.updated;
      const totalFailed = accountStats.failed + contactStats.failed + leadStats.failed;

      // Update sync log with success
      await supabaseClient
        .from('integration_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: totalProcessed,
          records_created: totalCreated,
          records_updated: totalUpdated,
          records_failed: totalFailed,
          duration_ms: Date.now() - new Date(syncLog.started_at).getTime(),
          metadata: {
            accounts: accountStats,
            contacts: contactStats,
            leads: leadStats,
          },
        })
        .eq('id', syncLogId);

      // Update integration last_sync_at
      await supabaseClient
        .from('integration_configs')
        .update({
          last_sync_at: new Date().toISOString(),
          status: 'connected',
          error_count: 0,
        })
        .eq('id', integration_config_id);

      console.log(`Sync completed successfully: ${totalProcessed} records processed`);

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total_processed: totalProcessed,
            total_created: totalCreated,
            total_updated: totalUpdated,
            total_failed: totalFailed,
            accounts: accountStats,
            contacts: contactStats,
            leads: leadStats,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Sync error:', error);

      // Update sync log with failure
      await supabaseClient
        .from('integration_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
          duration_ms: Date.now() - new Date(syncLog.started_at).getTime(),
        })
        .eq('id', syncLogId);

      // Update integration error count
      const { data: currentIntegration } = await supabaseClient
        .from('integration_configs')
        .select('error_count')
        .eq('id', integration_config_id)
        .single();

      await supabaseClient
        .from('integration_configs')
        .update({
          status: 'error',
          error_message: error.message,
          error_count: (currentIntegration?.error_count || 0) + 1,
        })
        .eq('id', integration_config_id);

      throw error;
    }
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseCredentials(credentialRecords: any[]): SalesforceCredentials {
  const creds: any = {};
  
  for (const record of credentialRecords) {
    if (record.credential_type === 'username') {
      creds.username = record.encrypted_value;
    } else if (record.credential_type === 'password') {
      creds.password = record.encrypted_value;
    } else if (record.credential_type === 'security_token') {
      creds.securityToken = record.encrypted_value;
    } else if (record.credential_type === 'instance_url') {
      creds.instanceUrl = record.encrypted_value;
    }
  }

  if (!creds.username || !creds.password || !creds.securityToken) {
    throw new Error('Missing required Salesforce credentials');
  }

  return creds;
}

async function authenticateSalesforce(credentials: SalesforceCredentials): Promise<SalesforceLoginResponse> {
  const loginUrl = credentials.instanceUrl || 'https://login.salesforce.com';
  
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:enterprise.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${credentials.username}</urn:username>
      <urn:password>${credentials.password}${credentials.securityToken}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(`${loginUrl}/services/Soap/c/${SALESFORCE_API_VERSION.replace('v', '')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'SOAPAction': 'login',
    },
    body: soapBody,
  });

  if (!response.ok) {
    throw new Error(`Salesforce authentication failed: ${response.statusText}`);
  }

  const xmlText = await response.text();
  
  // Parse session ID and server URL from SOAP response
  const sessionIdMatch = xmlText.match(/<sessionId>([^<]+)<\/sessionId>/);
  const serverUrlMatch = xmlText.match(/<serverUrl>([^<]+)<\/serverUrl>/);

  if (!sessionIdMatch || !serverUrlMatch) {
    throw new Error('Failed to parse Salesforce authentication response');
  }

  const instanceUrl = serverUrlMatch[1].split('/services')[0];

  return {
    access_token: sessionIdMatch[1],
    instance_url: instanceUrl,
    id: '',
    token_type: 'Bearer',
    issued_at: new Date().toISOString(),
    signature: '',
  };
}

async function syncAccounts(
  supabaseClient: any,
  org_id: string,
  authData: SalesforceLoginResponse,
  lastSyncAt: string | null
) {
  let processed = 0, created = 0, updated = 0, failed = 0;

  try {
    const whereClause = lastSyncAt 
      ? `WHERE SystemModstamp > ${new Date(lastSyncAt).toISOString()}` 
      : '';

    const query = `SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue, BillingCountry, BillingState, Phone ${whereClause}`;
    const records = await querySalesforce(authData, query);

    console.log(`Processing ${records.length} Salesforce Accounts`);

    for (const record of records) {
      try {
        processed++;

        const accountData = {
          org_id,
          external_id: record.Id,
          name: record.Name,
          domain: record.Website ? normalizeDomain(record.Website) : null,
          industry_raw: record.Industry,
          employee_count: record.NumberOfEmployees,
          revenue_range: mapRevenueRange(record.AnnualRevenue),
          country: record.BillingCountry,
          state_province: record.BillingState,
          phone: record.Phone,
          data_source: 'crm',
          updated_at: new Date().toISOString(),
        };

        // Upsert account
        const { error } = await supabaseClient
          .from('accounts')
          .upsert(accountData, {
            onConflict: 'org_id,external_id',
          });

        if (error) {
          console.error(`Error upserting account ${record.Id}:`, error);
          failed++;
        } else {
          // Check if it was an insert or update
          const { data: existing } = await supabaseClient
            .from('accounts')
            .select('id')
            .eq('org_id', org_id)
            .eq('external_id', record.Id)
            .single();

          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
      } catch (error) {
        console.error(`Error processing account ${record.Id}:`, error);
        failed++;
      }
    }
  } catch (error) {
    console.error('Error syncing accounts:', error);
  }

  return { processed, created, updated, failed };
}

async function syncContacts(
  supabaseClient: any,
  org_id: string,
  authData: SalesforceLoginResponse,
  lastSyncAt: string | null
) {
  let processed = 0, created = 0, updated = 0, failed = 0;

  try {
    const whereClause = lastSyncAt 
      ? `WHERE SystemModstamp > ${new Date(lastSyncAt).toISOString()}` 
      : '';

    const query = `SELECT Id, AccountId, FirstName, LastName, Email, Phone, MobilePhone, Title ${whereClause}`;
    const records = await querySalesforce(authData, query.replace('SELECT', 'SELECT Id, AccountId, FirstName, LastName, Email, Phone, MobilePhone, Title FROM Contact'));

    console.log(`Processing ${records.length} Salesforce Contacts`);

    for (const record of records) {
      try {
        processed++;

        const contactData = {
          org_id,
          external_id: record.Id,
          contact_external_id: record.Id,
          account_external_id: record.AccountId,
          first_name: record.FirstName,
          last_name: record.LastName,
          name: `${record.FirstName || ''} ${record.LastName || ''}`.trim(),
          email: record.Email,
          phone: record.Phone,
          mobile: record.MobilePhone,
          title: record.Title,
          title_raw: record.Title,
          data_source: 'crm',
          status: 'open',
          updated_at: new Date().toISOString(),
        };

        // Upsert contact as lead
        const { error } = await supabaseClient
          .from('Leads')
          .upsert(contactData, {
            onConflict: 'org_id,external_id',
          });

        if (error) {
          console.error(`Error upserting contact ${record.Id}:`, error);
          failed++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error(`Error processing contact ${record.Id}:`, error);
        failed++;
      }
    }
  } catch (error) {
    console.error('Error syncing contacts:', error);
  }

  return { processed, created, updated, failed };
}

async function syncLeads(
  supabaseClient: any,
  org_id: string,
  authData: SalesforceLoginResponse,
  lastSyncAt: string | null
) {
  let processed = 0, created = 0, updated = 0, failed = 0;

  try {
    const whereClause = lastSyncAt 
      ? `WHERE SystemModstamp > ${new Date(lastSyncAt).toISOString()}` 
      : '';

    const query = `SELECT Id, Company, FirstName, LastName, Email, Phone, MobilePhone, Title, Status, Industry, Website, Country, State FROM Lead ${whereClause}`;
    const records = await querySalesforce(authData, query);

    console.log(`Processing ${records.length} Salesforce Leads`);

    for (const record of records) {
      try {
        processed++;

        const leadData = {
          org_id,
          external_id: record.Id,
          first_name: record.FirstName,
          last_name: record.LastName,
          name: `${record.FirstName || ''} ${record.LastName || ''}`.trim(),
          company: record.Company,
          email: record.Email,
          phone: record.Phone,
          mobile: record.MobilePhone,
          title: record.Title,
          title_raw: record.Title,
          status: mapLeadStatus(record.Status),
          industry: record.Industry,
          website: record.Website,
          country: record.Country,
          state_province: record.State,
          data_source: 'crm',
          updated_at: new Date().toISOString(),
        };

        // Upsert lead
        const { error } = await supabaseClient
          .from('Leads')
          .upsert(leadData, {
            onConflict: 'org_id,external_id',
          });

        if (error) {
          console.error(`Error upserting lead ${record.Id}:`, error);
          failed++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error(`Error processing lead ${record.Id}:`, error);
        failed++;
      }
    }
  } catch (error) {
    console.error('Error syncing leads:', error);
  }

  return { processed, created, updated, failed };
}

async function querySalesforce(authData: SalesforceLoginResponse, soql: string): Promise<any[]> {
  const allRecords: any[] = [];
  let nextRecordsUrl: string | null = null;

  do {
    const url = nextRecordsUrl
      ? `${authData.instance_url}${nextRecordsUrl}`
      : `${authData.instance_url}/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce query failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    allRecords.push(...data.records);

    nextRecordsUrl = data.nextRecordsUrl || null;
  } while (nextRecordsUrl);

  return allRecords;
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

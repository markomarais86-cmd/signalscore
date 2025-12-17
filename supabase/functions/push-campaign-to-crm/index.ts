import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  isCircuitOpen, 
  recordSuccess, 
  recordFailure 
} from "../_shared/circuit-breaker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERVICE_NAME = 'salesforce';

interface SalesforceCredentials {
  access_token: string;
  refresh_token: string;
  instance_url: string;
}

interface Contact {
  email: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  company?: string;
  phone?: string;
  mobile?: string;
}

const BATCH_SIZE = 25; // Salesforce Composite API limit

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let syncLogId: string | null = null;

  try {
    const {
      org_id,
      campaign_name,
      campaign_id,
      contacts,
      batch_metadata
    } = await req.json();

    console.log('[push-campaign-to-crm] Starting CRM push:', {
      org_id,
      campaign_name,
      campaign_id,
      contact_count: contacts?.length
    });

    if (!org_id || !campaign_name || !contacts || contacts.length === 0) {
      throw new Error('Missing required fields: org_id, campaign_name, and contacts');
    }

    // Check circuit breaker before making Salesforce calls
    const { isOpen, state, cooldownRemaining } = await isCircuitOpen(SERVICE_NAME, supabase);
    if (isOpen) {
      console.log(`[push-campaign-to-crm] Circuit breaker OPEN, skipping CRM push`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Salesforce service temporarily unavailable. Retry in ${Math.round((cooldownRemaining || 0) / 1000)}s`,
          circuit_state: state 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('integration_sync_logs')
      .insert({
        org_id,
        provider_name: 'salesforce',
        sync_type: 'campaign_push',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: { campaign_name, contact_count: contacts.length }
      })
      .select('id')
      .single();

    if (syncLogError) {
      console.error('[push-campaign-to-crm] Failed to create sync log:', syncLogError);
    } else {
      syncLogId = syncLog.id;
    }

    // Get Salesforce integration config
    const { data: integrationConfig, error: configError } = await supabase
      .from('integration_configs')
      .select('id, config')
      .eq('org_id', org_id)
      .eq('provider_name', 'salesforce')
      .eq('status', 'connected')
      .maybeSingle();

    if (configError || !integrationConfig) {
      throw new Error('Salesforce integration not found or inactive. Please connect Salesforce in Settings.');
    }

    // Get Salesforce credentials
    const { data: credentialRecords, error: credError } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('integration_config_id', integrationConfig.id)
      .eq('credential_type', 'oauth_token');

    if (credError || !credentialRecords || credentialRecords.length === 0) {
      throw new Error('Salesforce credentials not found. Please reconnect Salesforce.');
    }

    const credentials: SalesforceCredentials = JSON.parse(credentialRecords[0].encrypted_value);
    
    if (!credentials.access_token || !credentials.instance_url) {
      throw new Error('Invalid Salesforce credentials. Please reconnect Salesforce.');
    }

    console.log('[push-campaign-to-crm] Using Salesforce instance:', credentials.instance_url);

    // Create or get Salesforce Campaign
    let sfCampaignId = campaign_id;
    let sfCampaignUrl = '';

    if (!sfCampaignId) {
      console.log('[push-campaign-to-crm] Creating new Salesforce campaign:', campaign_name);
      
      const startTime = Date.now();
      const campaignResponse = await fetch(`${credentials.instance_url}/services/data/v59.0/sobjects/Campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Name: campaign_name,
          IsActive: true,
          Status: 'In Progress',
          Type: 'ICP Signal Campaign',
          Description: `Campaign created from ICP Signal Platform. ICP: ${batch_metadata?.icp_name || 'Custom'}. ${contacts.length} contacts.`
        })
      });
      const responseTime = Date.now() - startTime;

      if (!campaignResponse.ok) {
        const errorText = await campaignResponse.text();
        console.error('[push-campaign-to-crm] Campaign creation failed:', errorText);
        
        // Record failure for 5xx and rate limit errors
        if (campaignResponse.status >= 500 || campaignResponse.status === 429) {
          await recordFailure(SERVICE_NAME, `Campaign creation failed: ${campaignResponse.status}`, supabase);
        }
        
        throw new Error(`Failed to create Salesforce campaign: ${errorText}`);
      }

      // Record success
      await recordSuccess(SERVICE_NAME, responseTime, supabase);
      
      const campaignData = await campaignResponse.json();
      sfCampaignId = campaignData.id;
      console.log('[push-campaign-to-crm] Created campaign with ID:', sfCampaignId);
    }

    sfCampaignUrl = `${credentials.instance_url}/lightning/r/Campaign/${sfCampaignId}/view`;

    let membersAdded = 0;
    let membersUpdated = 0;
    const errors: any[] = [];

    // Process contacts in batches using Composite API
    console.log('[push-campaign-to-crm] Processing contacts in batches...');
    
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      console.log(`[push-campaign-to-crm] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contacts.length / BATCH_SIZE)}`);

      // Build composite request for lead queries
      const compositeRequest = {
        allOrNone: false,
        compositeRequest: batch.map((contact: Contact, idx: number) => ({
          method: "GET",
          url: `/services/data/v59.0/query?q=${encodeURIComponent(`SELECT Id FROM Lead WHERE Email = '${contact.email.replace(/'/g, "\\'")}' LIMIT 1`)}`,
          referenceId: `lead_${idx}`
        }))
      };

      // Query for existing leads
      const queryResponse = await fetch(`${credentials.instance_url}/services/data/v59.0/composite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(compositeRequest)
      });

      if (!queryResponse.ok) {
        throw new Error(`Batch query failed: ${await queryResponse.text()}`);
      }

      const queryResults = await queryResponse.json();
      
      // Prepare leads to create and campaign members to add
      const leadsToCreate: any[] = [];
      const leadIdsForCampaign: string[] = [];

      batch.forEach((contact: Contact, idx: number) => {
        const queryResult = queryResults.compositeResponse[idx];
        
        if (queryResult.httpStatusCode === 200 && queryResult.body.totalSize > 0) {
          // Lead exists
          leadIdsForCampaign.push(queryResult.body.records[0].Id);
        } else {
          // Need to create lead
          leadsToCreate.push({
            contact,
            index: idx
          });
        }
      });

      // Batch create new leads
      if (leadsToCreate.length > 0) {
        const createLeadsRequest = {
          allOrNone: false,
          compositeRequest: leadsToCreate.map(({ contact, index }) => ({
            method: "POST",
            url: "/services/data/v59.0/sobjects/Lead",
            referenceId: `create_lead_${index}`,
            body: {
              FirstName: contact.first_name || '',
              LastName: contact.last_name || 'Unknown',
              Email: contact.email,
              Title: contact.title || '',
              Company: contact.company || 'Unknown',
              Phone: contact.phone || '',
              MobilePhone: contact.mobile || '',
              LeadSource: 'ICP Signal Platform',
              Status: 'Open - Not Contacted'
            }
          }))
        };

        const createResponse = await fetch(`${credentials.instance_url}/services/data/v59.0/composite`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createLeadsRequest)
        });

        if (!createResponse.ok) {
          throw new Error(`Batch lead creation failed: ${await createResponse.text()}`);
        }

        const createResults = await createResponse.json();
        
        createResults.compositeResponse.forEach((result: any, idx: number) => {
          if (result.httpStatusCode === 201 && result.body.success) {
            leadIdsForCampaign.push(result.body.id);
            console.log(`[push-campaign-to-crm] Created new lead: ${result.body.id}`);
          } else {
            errors.push({
              contact_email: leadsToCreate[idx].contact.email,
              error: `Lead creation failed: ${JSON.stringify(result.body)}`
            });
          }
        });
      }

      // Batch add campaign members
      if (leadIdsForCampaign.length > 0) {
        const addMembersRequest = {
          allOrNone: false,
          compositeRequest: leadIdsForCampaign.map((leadId, idx) => ({
            method: "POST",
            url: "/services/data/v59.0/sobjects/CampaignMember",
            referenceId: `member_${idx}`,
            body: {
              CampaignId: sfCampaignId,
              LeadId: leadId,
              Status: 'Sent'
            }
          }))
        };

        const memberResponse = await fetch(`${credentials.instance_url}/services/data/v59.0/composite`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(addMembersRequest)
        });

        if (!memberResponse.ok) {
          throw new Error(`Batch member addition failed: ${await memberResponse.text()}`);
        }

        const memberResults = await memberResponse.json();
        
        memberResults.compositeResponse.forEach((result: any, idx: number) => {
          if (result.httpStatusCode === 201 && result.body.success) {
            membersAdded++;
            console.log(`[push-campaign-to-crm] Added campaign member: ${leadIdsForCampaign[idx]}`);
          } else if (result.body.errorCode === 'DUPLICATE_VALUE') {
            membersUpdated++;
            console.log(`[push-campaign-to-crm] Campaign member already exists: ${leadIdsForCampaign[idx]}`);
          } else {
            errors.push({
              lead_id: leadIdsForCampaign[idx],
              error: `Member addition failed: ${JSON.stringify(result.body)}`
            });
          }
        });
      }
    }

    // Log to campaign_snapshots for audit and deduplication
    const exportedEmails = contacts.map((c: any) => c.email);
    
    const { error: snapshotError } = await supabase
      .from('campaign_snapshots')
      .insert({
        org_id,
        campaign_name,
        total_accounts: batch_metadata?.source_accounts || 0,
        total_contacts: contacts.length,
        exported_at: new Date().toISOString(),
        sync_destination: 'salesforce',
        sync_status: 'completed',
        exported_emails: exportedEmails,
        icp_id: batch_metadata?.icp_id || null,
        icp_name: batch_metadata?.icp_name || 'Custom Campaign',
        persona_filters_applied: batch_metadata?.persona_criteria || {},
        firmographic_filters: batch_metadata?.icp_criteria || {},
        export_type: 'campaign_builder'
      });

    if (snapshotError) {
      console.error('[push-campaign-to-crm] Error logging snapshot:', snapshotError);
    }

    // Update sync log with success
    if (syncLogId) {
      await supabase
        .from('integration_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: contacts.length,
          records_created: membersAdded,
          records_updated: membersUpdated,
          records_failed: errors.length,
          error_details: errors.length > 0 ? { errors } : null
        })
        .eq('id', syncLogId);
    }

    console.log(`[push-campaign-to-crm] Successfully pushed ${membersAdded} contacts to Salesforce (batch processing)`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: sfCampaignId,
        campaign_url: sfCampaignUrl,
        members_added: membersAdded,
        members_updated: membersUpdated,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[push-campaign-to-crm] Error:', error);
    
    // Update sync log with failure
    if (syncLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('integration_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
          error_details: { error: error.message, stack: error.stack }
        })
        .eq('id', syncLogId);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

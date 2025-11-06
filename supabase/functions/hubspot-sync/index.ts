import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    jobtitle?: string;
    company?: string;
    associatedcompanyid?: string;
  };
}

interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    country?: string;
    city?: string;
    state?: string;
  };
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    closedate?: string;
    pipeline?: string;
  };
  associations?: {
    companies?: { id: string }[];
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      throw new Error('User not associated with an organization');
    }

    const { org_id, integration_config_id, full_sync = false } = await req.json();

    if (org_id !== profile.org_id) {
      throw new Error('Unauthorized: org_id mismatch');
    }

    console.log(`Starting HubSpot sync for org ${org_id}`);

    // Get integration credentials
    const { data: credential } = await supabase
      .from('integration_credentials')
      .select('encrypted_credentials')
      .eq('integration_config_id', integration_config_id)
      .single();

    if (!credential?.encrypted_credentials) {
      throw new Error('No HubSpot credentials found');
    }

    const { access_token } = credential.encrypted_credentials as { access_token: string };

    if (!access_token) {
      throw new Error('No access token found');
    }

    const headers = {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    };

    let totalAccounts = 0;
    let totalContacts = 0;
    let totalLeads = 0;
    const errors: string[] = [];

    // Start sync log
    const { data: syncLog } = await supabase
      .from('integration_sync_logs')
      .insert({
        integration_config_id,
        sync_type: full_sync ? 'full' : 'incremental',
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      // Sync Companies (Accounts)
      console.log('Fetching HubSpot companies...');
      let companiesUrl = 'https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name,domain,industry,numberofemployees,annualrevenue,country,city,state';
      
      while (companiesUrl) {
        const companiesResponse = await fetch(companiesUrl, { headers });
        
        if (!companiesResponse.ok) {
          const errorText = await companiesResponse.text();
          throw new Error(`HubSpot API error: ${companiesResponse.status} - ${errorText}`);
        }

        const companiesData = await companiesResponse.json();
        const companies: HubSpotCompany[] = companiesData.results || [];

        for (const company of companies) {
          try {
            const accountData = {
              org_id,
              external_id: `hubspot_company_${company.id}`,
              name: company.properties.name || 'Unknown Company',
              domain: company.properties.domain || null,
              industry_raw: company.properties.industry || null,
              industry_norm: company.properties.industry || null,
              employee_count: company.properties.numberofemployees 
                ? parseInt(company.properties.numberofemployees) 
                : null,
              revenue_range: company.properties.annualrevenue || null,
              country: company.properties.country || null,
              data_source: 'crm',
            };

            await supabase
              .from('accounts')
              .upsert(accountData, {
                onConflict: 'org_id,external_id',
              });

            totalAccounts++;
          } catch (error) {
            console.error(`Error syncing company ${company.id}:`, error);
            errors.push(`Company ${company.id}: ${error.message}`);
          }
        }

        companiesUrl = companiesData.paging?.next?.link || null;
      }

      // Sync Contacts
      console.log('Fetching HubSpot contacts...');
      let contactsUrl = 'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,jobtitle,company,associatedcompanyid';
      
      while (contactsUrl) {
        const contactsResponse = await fetch(contactsUrl, { headers });
        
        if (!contactsResponse.ok) {
          const errorText = await contactsResponse.text();
          throw new Error(`HubSpot API error: ${contactsResponse.status} - ${errorText}`);
        }

        const contactsData = await contactsResponse.json();
        const contacts: HubSpotContact[] = contactsData.results || [];

        for (const contact of contacts) {
          try {
            if (!contact.properties.email) {
              continue; // Skip contacts without email
            }

            const contactData = {
              org_id,
              external_id: `hubspot_contact_${contact.id}`,
              account_external_id: contact.properties.associatedcompanyid 
                ? `hubspot_company_${contact.properties.associatedcompanyid}`
                : null,
              first_name: contact.properties.firstname || null,
              last_name: contact.properties.lastname || null,
              email: contact.properties.email,
              title_raw: contact.properties.jobtitle || null,
            };

            await supabase
              .from('contacts')
              .upsert(contactData, {
                onConflict: 'org_id,external_id',
              });

            totalContacts++;
          } catch (error) {
            console.error(`Error syncing contact ${contact.id}:`, error);
            errors.push(`Contact ${contact.id}: ${error.message}`);
          }
        }

        contactsUrl = contactsData.paging?.next?.link || null;
      }

      // Sync Deals (as Leads)
      console.log('Fetching HubSpot deals...');
      let dealsUrl = 'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,dealstage,amount,closedate,pipeline';
      
      while (dealsUrl) {
        const dealsResponse = await fetch(dealsUrl, { headers });
        
        if (!dealsResponse.ok) {
          const errorText = await dealsResponse.text();
          throw new Error(`HubSpot API error: ${dealsResponse.status} - ${errorText}`);
        }

        const dealsData = await dealsResponse.json();
        const deals: HubSpotDeal[] = dealsData.results || [];

        for (const deal of deals) {
          try {
            // Get associated company
            const associationsUrl = `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/companies`;
            const associationsResponse = await fetch(associationsUrl, { headers });
            let companyId = null;

            if (associationsResponse.ok) {
              const associationsData = await associationsResponse.json();
              if (associationsData.results && associationsData.results.length > 0) {
                companyId = `hubspot_company_${associationsData.results[0].id}`;
              }
            }

            const leadData = {
              org_id,
              external_id: `hubspot_deal_${deal.id}`,
              name: deal.properties.dealname || 'Unknown Deal',
              status: deal.properties.dealstage || 'open',
              account_external_id: companyId,
            };

            await supabase
              .from('Leads')
              .upsert(leadData, {
                onConflict: 'org_id,external_id',
              });

            totalLeads++;
          } catch (error) {
            console.error(`Error syncing deal ${deal.id}:`, error);
            errors.push(`Deal ${deal.id}: ${error.message}`);
          }
        }

        dealsUrl = dealsData.paging?.next?.link || null;
      }

      // Update sync log as completed
      await supabase
        .from('integration_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: totalAccounts + totalContacts + totalLeads,
          records_created: totalAccounts + totalContacts + totalLeads,
          records_updated: 0,
          records_failed: errors.length,
          error_details: errors.length > 0 ? { errors } : null,
        })
        .eq('id', syncLog.id);

      // Update integration config last_sync_at
      await supabase
        .from('integration_configs')
        .update({
          last_sync_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', integration_config_id);

      console.log(`HubSpot sync completed: ${totalAccounts} accounts, ${totalContacts} contacts, ${totalLeads} deals`);

      return new Response(
        JSON.stringify({
          success: true,
          accounts: totalAccounts,
          contacts: totalContacts,
          leads: totalLeads,
          errors: errors.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('HubSpot sync error:', error);

      // Update sync log as failed
      if (syncLog) {
        await supabase
          .from('integration_sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { error: error.message },
          })
          .eq('id', syncLog.id);
      }

      throw error;
    }

  } catch (error) {
    console.error('Error in hubspot-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

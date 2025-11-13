import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { corsHeaders } from '../_shared/cors.ts';

const SALESFORCE_API_VERSION = 'v58.0';

interface FetchAccountsRequest {
  org_id: string;
  integration_config_id: string;
  filters?: {
    searchTerm?: string;
    industry?: string;
    country?: string;
    fitScore?: number;
  };
  pagination?: {
    cursor?: string;
    pageSize?: number;
  };
}

interface SalesforceLoginResponse {
  access_token: string;
  instance_url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      org_id, 
      integration_config_id, 
      filters = {}, 
      pagination = {} 
    } = await req.json() as FetchAccountsRequest;

    const { searchTerm, industry, country, fitScore } = filters;
    const { cursor, pageSize = 25 } = pagination;

    console.log(`Fetching real-time accounts for org ${org_id}, integration ${integration_config_id}`);

    // Get integration config and credentials
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integration_configs')
      .select(`
        *,
        integration_credentials (
          credential_type,
          encrypted_value,
          encrypted_credentials
        )
      `)
      .eq('id', integration_config_id)
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration configuration not found');
    }

    let accounts = [];
    let newCursor = null;
    let hasMore = false;
    let totalCount = 0;

    if (integration.integration_type === 'salesforce') {
      // Salesforce logic
      const credentials = integration.integration_credentials?.find(
        (c: any) => c.credential_type === 'username'
      );
      
      if (!credentials?.encrypted_value) {
        throw new Error('Salesforce credentials not found');
      }

      const { username, password, securityToken } = credentials.encrypted_value as any;
      
      // Authenticate with Salesforce
      const loginSoap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${username}</urn:username>
      <urn:password>${password}${securityToken}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

      const loginResponse = await fetch('https://login.salesforce.com/services/Soap/u/58.0', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': 'login',
        },
        body: loginSoap,
      });

      if (!loginResponse.ok) {
        throw new Error('Salesforce authentication failed');
      }

      const loginText = await loginResponse.text();
      const sessionIdMatch = loginText.match(/<sessionId>([^<]+)<\/sessionId>/);
      const serverUrlMatch = loginText.match(/<serverUrl>([^<]+)<\/serverUrl>/);

      if (!sessionIdMatch || !serverUrlMatch) {
        throw new Error('Failed to parse Salesforce login response');
      }

      const accessToken = sessionIdMatch[1];
      const instanceUrl = serverUrlMatch[1].split('/services')[0];

      // Build SOQL query
      let whereConditions = [];
      
      if (searchTerm) {
        whereConditions.push(`(Name LIKE '%${searchTerm}%' OR Website LIKE '%${searchTerm}%')`);
      }
      
      if (industry) {
        whereConditions.push(`Industry = '${industry}'`);
      }
      
      if (country) {
        whereConditions.push(`BillingCountry = '${country}'`);
      }
      
      if (cursor) {
        whereConditions.push(`LastModifiedDate < ${cursor}`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const soql = `SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue, BillingCountry, BillingState, LastModifiedDate 
                    FROM Account 
                    ${whereClause}
                    ORDER BY LastModifiedDate DESC 
                    LIMIT ${pageSize + 1}`;

      const queryUrl = `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}/query/?q=${encodeURIComponent(soql)}`;

      const accountsResponse = await fetch(queryUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('Salesforce query failed:', errorText);
        throw new Error('Failed to fetch Salesforce accounts');
      }

      const sfData = await accountsResponse.json();
      const sfAccounts = sfData.records || [];

      // Check if there are more records
      hasMore = sfAccounts.length > pageSize;
      const accountsToProcess = hasMore ? sfAccounts.slice(0, pageSize) : sfAccounts;
      
      if (hasMore && accountsToProcess.length > 0) {
        newCursor = accountsToProcess[accountsToProcess.length - 1].LastModifiedDate;
      }

      totalCount = sfData.totalSize || 0;

      // Map Salesforce accounts to our format
      accounts = accountsToProcess.map((sfAccount: any) => ({
        external_id: sfAccount.Id,
        name: sfAccount.Name,
        domain: sfAccount.Website,
        industry_raw: sfAccount.Industry,
        employee_count: sfAccount.NumberOfEmployees,
        revenue_range: sfAccount.AnnualRevenue ? `$${(sfAccount.AnnualRevenue / 1000000).toFixed(1)}M` : null,
        country: sfAccount.BillingCountry,
        state_province: sfAccount.BillingState,
        data_source: 'crm',
        contacts: 0,
      }));

    } else if (integration.integration_type === 'hubspot') {
      // HubSpot logic
      const credential = integration.integration_credentials?.[0];
      
      if (!credential?.encrypted_credentials) {
        throw new Error('HubSpot credentials not found');
      }

      const { access_token } = credential.encrypted_credentials as any;

      if (!access_token) {
        throw new Error('No HubSpot access token found');
      }

      // Build HubSpot API URL with filters
      const properties = 'name,domain,industry,numberofemployees,annualrevenue,country,state';
      let apiUrl = `https://api.hubapi.com/crm/v3/objects/companies?limit=${pageSize + 1}&properties=${properties}`;
      
      if (cursor) {
        apiUrl += `&after=${cursor}`;
      }

      // Note: HubSpot search filters would require the Search API which has different syntax
      // For simplicity, we'll fetch and filter client-side for now
      
      const companiesResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!companiesResponse.ok) {
        const errorText = await companiesResponse.text();
        console.error('HubSpot query failed:', errorText);
        throw new Error('Failed to fetch HubSpot companies');
      }

      const hubspotData = await companiesResponse.json();
      let companies = hubspotData.results || [];

      // Apply client-side filters
      if (searchTerm) {
        companies = companies.filter((c: any) => 
          c.properties.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.properties.domain?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (industry) {
        companies = companies.filter((c: any) => c.properties.industry === industry);
      }

      if (country) {
        companies = companies.filter((c: any) => c.properties.country === country);
      }

      // Check if there are more records
      hasMore = companies.length > pageSize;
      const companiesToProcess = hasMore ? companies.slice(0, pageSize) : companies;
      
      if (hubspotData.paging?.next?.after) {
        newCursor = hubspotData.paging.next.after;
      }

      totalCount = hubspotData.total || 0;

      // Map HubSpot companies to our format
      accounts = companiesToProcess.map((company: any) => ({
        external_id: company.id,
        name: company.properties.name,
        domain: company.properties.domain,
        industry_raw: company.properties.industry,
        employee_count: company.properties.numberofemployees ? parseInt(company.properties.numberofemployees) : null,
        revenue_range: company.properties.annualrevenue,
        country: company.properties.country,
        state_province: company.properties.state,
        data_source: 'crm',
        contacts: 0,
      }));
    } else {
      throw new Error(`Unsupported integration type: ${integration.integration_type}`);
    }

    // Join with ICP scores from local DB
    const externalIds = accounts.map((acc: any) => acc.external_id);
    
    if (externalIds.length > 0) {
      const { data: scores } = await supabaseClient
        .from('scores')
        .select('account_external_id, overall, fit, intent, reachability, last_scored_at')
        .eq('org_id', org_id)
        .in('account_external_id', externalIds)
        .order('last_scored_at', { ascending: false });

      // Create a map of latest scores by external_id
      const scoresMap = new Map();
      scores?.forEach(score => {
        if (!scoresMap.has(score.account_external_id)) {
          scoresMap.set(score.account_external_id, {
            overall: score.overall,
            fit: score.fit,
            intent: score.intent,
            reachability: score.reachability,
          });
        }
      });

      // Merge scores into accounts
      accounts = accounts.map((account: any) => ({
        ...account,
        score: scoresMap.get(account.external_id) || null,
      }));

      // Apply fit score filter if provided
      if (fitScore) {
        accounts = accounts.filter((acc: any) => 
          acc.score && acc.score.overall >= fitScore
        );
      }
    }

    return new Response(
      JSON.stringify({
        accounts,
        cursor: newCursor,
        hasMore,
        totalCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in fetch-crm-accounts:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        accounts: [],
        cursor: null,
        hasMore: false,
        totalCount: 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

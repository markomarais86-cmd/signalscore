import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  org_id: string;
  provider: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, provider }: SyncRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Syncing data from ${provider} for org ${org_id}`);

    let totalAccounts = 0;
    let totalContacts = 0;

    // Get the organization's active ICP profile
    const { data: icpProfile, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id)
      .eq('is_primary', true)
      .single();

    if (icpError && icpError.code !== 'PGRST116') {
      console.error('Error fetching ICP:', icpError);
    }

    console.log(`Using ICP profile: ${icpProfile?.name || 'None'}`);

    // Provider-specific sync logic
    if (provider === 'apollo') {
      const apolloKey = Deno.env.get('APOLLO_API_KEY');
      if (!apolloKey) {
        throw new Error('APOLLO_API_KEY not configured');
      }

      // Build Apollo API request body based on ICP
      const requestBody: any = {
        page: 1,
        per_page: 1, // We only need pagination data, not actual results
      };

      if (icpProfile) {
        // Map geographies to Apollo locations
        if (icpProfile.geographies && icpProfile.geographies.length > 0) {
          requestBody.organization_locations = icpProfile.geographies;
        }

        // Map company_sizes to employee ranges
        if (icpProfile.company_sizes && icpProfile.company_sizes.length > 0) {
          const employeeRanges = icpProfile.company_sizes.map((size: string) => {
            switch(size) {
              case '1-10': return '1,10';
              case '11-50': return '11,50';
              case '51-200': return '51,200';
              case '201-500': return '201,500';
              case '501-1000': return '501,1000';
              case '1001-5000': return '1001,5000';
              case '5001-10000': return '5001,10000';
              case '10000+': return '10001,max';
              default: return null;
            }
          }).filter(Boolean);
          
          if (employeeRanges.length > 0) {
            requestBody.organization_num_employees_ranges = employeeRanges;
          }
        }

        // Map revenue_ranges to Apollo revenue filter
        if (icpProfile.revenue_ranges && icpProfile.revenue_ranges.length > 0) {
          // Apollo uses min/max in dollars
          // Example ranges: "$1M-$10M", "$10M-$50M", etc.
          const revenueMap: any = {
            '$0-$1M': { min: 0, max: 1000000 },
            '$1M-$10M': { min: 1000000, max: 10000000 },
            '$10M-$50M': { min: 10000000, max: 50000000 },
            '$50M-$100M': { min: 50000000, max: 100000000 },
            '$100M-$500M': { min: 100000000, max: 500000000 },
            '$500M-$1B': { min: 500000000, max: 1000000000 },
            '$1B+': { min: 1000000000, max: null }
          };
          
          // For simplicity, use the first revenue range
          const firstRange = icpProfile.revenue_ranges[0];
          if (revenueMap[firstRange]) {
            requestBody.revenue_range = revenueMap[firstRange];
          }
        }

        // Map industries (Apollo uses free-text search for industries)
        if (icpProfile.industries && icpProfile.industries.length > 0) {
          requestBody.organization_industry_tag_ids = icpProfile.industries;
        }
      }

      console.log('Apollo API request:', JSON.stringify(requestBody, null, 2));

      // Query Apollo for TAM estimate
      const response = await fetch('https://api.apollo.io/v1/organizations/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apolloKey,
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Apollo response:', JSON.stringify(data, null, 2));
        
        // Extract TAM from pagination data
        totalAccounts = data.pagination?.total_entries || 0;
        
        console.log(`✅ Apollo TAM for ICP "${icpProfile?.name}": ${totalAccounts.toLocaleString()} accounts`);
      } else {
        const errorText = await response.text();
        throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
      }
    }

    // Update provider sync status
    await supabase
      .from('external_data_sources')
      .update({
        total_accounts: totalAccounts,
        total_contacts: totalContacts,
        last_synced_at: new Date().toISOString(),
      })
      .eq('org_id', org_id)
      .eq('provider', provider);

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        totalAccounts,
        totalContacts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

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
      // Start with minimal required parameters to avoid validation errors
      const requestBody: any = {
        page: 1,
        per_page: 1, // We only need pagination data, not actual results
      };

      if (icpProfile) {
        // Map geographies to Apollo locations (use country names)
        if (icpProfile.geographies && icpProfile.geographies.length > 0) {
          requestBody.organization_locations = icpProfile.geographies;
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

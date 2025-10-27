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

    // Provider-specific sync logic
    if (provider === 'zoominfo') {
      const zoomInfoKey = Deno.env.get('ZOOMINFO_API_KEY');
      if (!zoomInfoKey) {
        throw new Error('ZOOMINFO_API_KEY not configured');
      }

      // Example: Fetch companies from ZoomInfo
      // This is a simplified example - real implementation would paginate, handle rate limits, etc.
      const response = await fetch('https://api.zoominfo.com/companies', {
        headers: {
          'Authorization': `Bearer ${zoomInfoKey}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Process and insert data
        totalAccounts = data.companies?.length || 0;
      }
    } else if (provider === 'apollo') {
      const apolloKey = Deno.env.get('APOLLO_API_KEY');
      if (!apolloKey) {
        throw new Error('APOLLO_API_KEY not configured');
      }

      // Apollo.io sync logic
      const response = await fetch('https://api.apollo.io/v1/organizations/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apolloKey,
        },
        body: JSON.stringify({
          page: 1,
          per_page: 100,
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Process and insert data
        totalAccounts = data.organizations?.length || 0;
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

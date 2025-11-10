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

        // Map company sizes to Apollo employee ranges
        // Format: ["min,max"] where min is lowest company_size and max is highest
        if (icpProfile.company_sizes && icpProfile.company_sizes.length > 0) {
          const minEmployees = Math.min(...icpProfile.company_sizes);
          const maxEmployees = Math.max(...icpProfile.company_sizes);
          requestBody.organization_num_employees_ranges = [`${minEmployees},${maxEmployees}`];
          console.log(`Employee range filter: ${minEmployees}-${maxEmployees}`);
        }

        // Map revenue ranges to Apollo revenue filter
        // Parse revenue_ranges array to get min/max values
        if (icpProfile.revenue_ranges && icpProfile.revenue_ranges.length > 0) {
          const parseRevenue = (range: string): number => {
            // Extract numbers from formats like "$1M-$5M", "$5B+"
            const match = range.match(/\$?([\d.]+)([MBK])?/);
            if (match) {
              const value = parseFloat(match[1]);
              const multiplier = match[2] === 'B' ? 1000000000 : match[2] === 'M' ? 1000000 : match[2] === 'K' ? 1000 : 1;
              return value * multiplier;
            }
            return 0;
          };

          // Get minimum revenue from first range
          const firstRange = icpProfile.revenue_ranges[0];
          const minRevenue = parseRevenue(firstRange);
          
          if (minRevenue > 0) {
            requestBody.revenue_range = { min: minRevenue };
            console.log(`Revenue filter: min $${(minRevenue / 1000000).toFixed(1)}M`);
          }
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

      // Now query Apollo for contact/lead counts using people search
      const peopleRequestBody: any = {
        page: 1,
        per_page: 1, // We only need pagination data
      };

      // Apply filters to contacts search
      if (icpProfile) {
        if (icpProfile.geographies && icpProfile.geographies.length > 0) {
          peopleRequestBody.person_locations = icpProfile.geographies;
        }

        // Map persona job titles to Apollo person_titles
        if (icpProfile.persona_job_titles && icpProfile.persona_job_titles.length > 0) {
          peopleRequestBody.person_titles = icpProfile.persona_job_titles;
        }

        // Map seniority levels
        if (icpProfile.persona_seniority_levels && icpProfile.persona_seniority_levels.length > 0) {
          peopleRequestBody.person_seniorities = icpProfile.persona_seniority_levels;
        }

        // Add company size filter (but NOT org location to avoid overly restrictive filtering)
        if (icpProfile.company_sizes && icpProfile.company_sizes.length > 0) {
          const minEmployees = Math.min(...icpProfile.company_sizes);
          const maxEmployees = Math.max(...icpProfile.company_sizes);
          peopleRequestBody.organization_num_employees_ranges = [`${minEmployees},${maxEmployees}`];
        }
      }

      console.log('🔍 Contact search filters:', {
        person_locations: peopleRequestBody.person_locations?.length || 0,
        person_titles: peopleRequestBody.person_titles?.length || 0,
        person_seniorities: peopleRequestBody.person_seniorities?.length || 0,
        org_employee_range: peopleRequestBody.organization_num_employees_ranges
      });

      console.log('Apollo contacts search request:', JSON.stringify(peopleRequestBody, null, 2));

      const peopleResponse = await fetch('https://api.apollo.io/v1/contacts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apolloKey,
        },
        body: JSON.stringify(peopleRequestBody)
      });

      if (peopleResponse.ok) {
        const peopleData = await peopleResponse.json();
        console.log('Apollo contacts response:', JSON.stringify(peopleData, null, 2));
        
        // Extract contact count from pagination data
        totalContacts = peopleData.pagination?.total_entries || 0;
        
        console.log(`✅ Apollo contacts for ICP "${icpProfile?.name}": ${totalContacts.toLocaleString()} leads`);
      } else {
        const errorText = await peopleResponse.text();
        console.error(`Apollo contacts search error: ${peopleResponse.status} - ${errorText}`);
        // Don't throw error for contacts search - we still have account data
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

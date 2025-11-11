import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const { org_id, provider } = await req.json() as SyncRequest;

    if (!org_id || !provider) {
      throw new Error('Missing required parameters: org_id and provider');
    }

    console.log(`Starting sync for org ${org_id} with provider ${provider}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the primary ICP for this organization
    const { data: icpData, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id)
      .eq('is_primary', true)
      .single();

    if (icpError || !icpData) {
      throw new Error(`No primary ICP found for org ${org_id}`);
    }

    console.log('Found primary ICP:', icpData.name);

    let syncResult;

    if (provider === 'apollo') {
      const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
      if (!apolloApiKey) {
        throw new Error('Apollo API key not configured');
      }

      // Build Apollo search criteria from ICP
      const requestBody: any = {
        page: 1,
        per_page: 1, // We only need aggregations, not actual records
        // Request aggregations for comprehensive breakdowns
        aggregations: [
          'country',
          'state',
          'city',
          'industry',
          'organization_num_employees_ranges',
          'estimated_num_employees',
          'revenue_range'
        ]
      };

      // Add geography filters
      if (icpData.geographies && icpData.geographies.length > 0) {
        requestBody.organization_locations = icpData.geographies;
      }

      // Add company size filters
      if (icpData.company_sizes && icpData.company_sizes.length > 0) {
        requestBody.organization_num_employees_ranges = icpData.company_sizes;
      }

      // Add revenue filters
      if (icpData.revenue_ranges && icpData.revenue_ranges.length > 0) {
        requestBody.revenue_range = icpData.revenue_ranges;
      }

      // Add industry filters
      if (icpData.industries && icpData.industries.length > 0) {
        requestBody.organization_industry_tag_ids = icpData.industries;
      }

      console.log('Calling Apollo API with filters:', JSON.stringify(requestBody, null, 2));

      const apolloResponse = await fetch('https://api.apollo.io/v1/organizations/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apolloApiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!apolloResponse.ok) {
        const errorText = await apolloResponse.text();
        throw new Error(`Apollo API error: ${apolloResponse.status} - ${errorText}`);
      }

      const apolloData = await apolloResponse.json();
      console.log('Apollo API response received');

      const totalAccounts = apolloData.pagination?.total_entries || 0;
      
      // Estimate contacts based on ICP criteria
      let contactMultiplier = 3.5; // Base multiplier
      
      // Adjust multiplier based on seniority levels
      if (icpData.persona_seniority_levels && icpData.persona_seniority_levels.length > 0) {
        const hasExecutive = icpData.persona_seniority_levels.some((level: string) => 
          level.toLowerCase().includes('c-level') || 
          level.toLowerCase().includes('vp') ||
          level.toLowerCase().includes('director')
        );
        if (hasExecutive) contactMultiplier *= 0.8; // Fewer executives per company
      }
      
      // Adjust multiplier based on company sizes
      if (icpData.company_sizes && icpData.company_sizes.length > 0) {
        const hasLargeCompanies = icpData.company_sizes.some((size: string) => 
          size.includes('1000') || size.includes('5000')
        );
        if (hasLargeCompanies) contactMultiplier *= 1.5; // More contacts in larger companies
      }

      const totalContacts = Math.round(totalAccounts * contactMultiplier);

      // Transform aggregations into breakdown format
      const aggregations = apolloData.aggregations || {};
      
      // Geography breakdown
      const geographyBreakdown: any = {};
      if (aggregations.country) {
        for (const [country, count] of Object.entries(aggregations.country)) {
          const accountCount = count as number;
          geographyBreakdown[country] = {
            accounts: accountCount,
            contacts: Math.round(accountCount * contactMultiplier),
            percentage: (accountCount / totalAccounts) * 100
          };
        }
      }

      // Industry breakdown
      const industryBreakdown: any = {};
      if (aggregations.industry) {
        for (const [industry, count] of Object.entries(aggregations.industry)) {
          const accountCount = count as number;
          industryBreakdown[industry] = {
            accounts: accountCount,
            percentage: (accountCount / totalAccounts) * 100
          };
        }
      }

      // Company size breakdown
      const companySizeBreakdown: any = {};
      if (aggregations.organization_num_employees_ranges) {
        for (const [range, count] of Object.entries(aggregations.organization_num_employees_ranges)) {
          const accountCount = count as number;
          companySizeBreakdown[range] = {
            accounts: accountCount,
            percentage: (accountCount / totalAccounts) * 100
          };
        }
      }

      // Revenue breakdown
      const revenueBreakdown: any = {};
      if (aggregations.revenue_range) {
        for (const [range, count] of Object.entries(aggregations.revenue_range)) {
          const accountCount = count as number;
          revenueBreakdown[range] = {
            accounts: accountCount,
            percentage: (accountCount / totalAccounts) * 100
          };
        }
      }

      console.log('Transformed breakdowns:', {
        geographyCount: Object.keys(geographyBreakdown).length,
        industryCount: Object.keys(industryBreakdown).length,
        companySizeCount: Object.keys(companySizeBreakdown).length,
        revenueCount: Object.keys(revenueBreakdown).length
      });

      // Update external_data_sources with all breakdown data
      const { error: updateError } = await supabase
        .from('external_data_sources')
        .upsert({
          org_id,
          provider: 'apollo',
          total_accounts: totalAccounts,
          total_contacts: totalContacts,
          geography_breakdown: geographyBreakdown,
          industry_breakdown: industryBreakdown,
          company_size_breakdown: companySizeBreakdown,
          revenue_breakdown: revenueBreakdown,
          last_synced_at: new Date().toISOString(),
          is_active: true,
          api_key_configured: true
        }, {
          onConflict: 'org_id,provider'
        });

      if (updateError) {
        throw new Error(`Failed to update external_data_sources: ${updateError.message}`);
      }

      syncResult = {
        provider: 'apollo',
        totalAccounts,
        totalContacts,
        breakdowns: {
          geography: Object.keys(geographyBreakdown).length,
          industry: Object.keys(industryBreakdown).length,
          companySize: Object.keys(companySizeBreakdown).length,
          revenue: Object.keys(revenueBreakdown).length
        }
      };
    } else {
      throw new Error(`Provider ${provider} not yet supported`);
    }

    console.log('Sync completed successfully:', syncResult);

    return new Response(
      JSON.stringify({
        success: true,
        ...syncResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in sync-external-provider:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
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

      // Helper function to map company sizes to Apollo ranges
      const mapCompanySizesToApolloRanges = (sizes: number[]): string[] => {
        const rangeMapping: Record<number, string> = {
          1: '1,10',
          10: '11,50',
          50: '51,200',
          200: '201,500',
          500: '501,1000',
          1000: '1001,5000',
          2000: '1001,5000',
          5000: '5001,10000',
          10000: '10001,999999'
        };
        
        const ranges = sizes.map(size => rangeMapping[size]).filter(Boolean);
        return [...new Set(ranges)]; // Remove duplicates
      };

      // Helper function to parse revenue range strings and get min/max values
      const parseRevenueRanges = (revenueRanges: string[]): { min: number | null, max: number | null } => {
        const parseAmount = (str: string): number => {
          // Remove $, commas, and convert M/B to numbers
          const clean = str.replace(/[$,]/g, '').trim();
          if (clean.includes('B')) {
            return parseFloat(clean.replace('B', '')) * 1000000000;
          } else if (clean.includes('M')) {
            return parseFloat(clean.replace('M', '')) * 1000000;
          } else if (clean.includes('K')) {
            return parseFloat(clean.replace('K', '')) * 1000;
          }
          return parseFloat(clean);
        };

        let minRevenue: number | null = null;
        let maxRevenue: number | null = null;

        for (const range of revenueRanges) {
          // Handle ranges like "$1M-$5M", "$5M-$10M", "$10B+"
          if (range.includes('-')) {
            const parts = range.split('-');
            const rangeMin = parseAmount(parts[0]);
            const rangeMax = parseAmount(parts[1]);
            
            if (minRevenue === null || rangeMin < minRevenue) minRevenue = rangeMin;
            if (maxRevenue === null || rangeMax > maxRevenue) maxRevenue = rangeMax;
          } else if (range.includes('+')) {
            // Handle ranges like "$10B+"
            const rangeMin = parseAmount(range.replace('+', ''));
            if (minRevenue === null || rangeMin < minRevenue) minRevenue = rangeMin;
            // No max for "+" ranges
          }
        }

        return { min: minRevenue, max: maxRevenue };
      };

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

      // Add company size filters - convert to Apollo comma-separated format
      if (icpData.company_sizes && icpData.company_sizes.length > 0) {
        const apolloRanges = mapCompanySizesToApolloRanges(icpData.company_sizes);
        if (apolloRanges.length > 0) {
          requestBody.organization_num_employees_ranges = apolloRanges;
        }
      }

      // Add revenue filters - parse and convert to Apollo's flat bracket notation
      if (icpData.revenue_ranges && icpData.revenue_ranges.length > 0) {
        const { min, max } = parseRevenueRanges(icpData.revenue_ranges);
        // Apollo uses bracket notation: revenue_range[min] and revenue_range[max]
        if (min !== null) {
          requestBody['revenue_range[min]'] = min;
        }
        if (max !== null) {
          requestBody['revenue_range[max]'] = max;
        }
      }

      // Skip industry filters - Apollo expects numeric tag IDs, not names

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
      console.log('Apollo response structure:', {
        accountCount: apolloData.pagination?.total_entries,
        hasAggregations: !!apolloData.aggregations,
        aggregationKeys: apolloData.aggregations ? Object.keys(apolloData.aggregations) : [],
        sampleAggregation: apolloData.aggregations ? JSON.stringify(Object.values(apolloData.aggregations)[0]?.slice(0, 2)) : null
      });

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

      // Transform Apollo aggregations into structured breakdowns
      const aggregations = apolloData.aggregations || {};
      console.log('Processing aggregations with keys:', Object.keys(aggregations));
      
      // Helper function to safely process aggregation arrays
      const processAggregation = (aggData: any[], totalCount: number, includeContacts = false) => {
        if (!aggData || !Array.isArray(aggData)) return {};
        
        const result: Record<string, any> = {};
        for (const item of aggData.slice(0, 50)) { // Limit to top 50
          const name = item.display_name || item.name || item.value || 'Unknown';
          const count = item.count || item.doc_count || 0;
          
          result[name] = {
            accounts: count,
            percentage: totalCount > 0 ? parseFloat(((count / totalCount) * 100).toFixed(1)) : 0
          };
          
          if (includeContacts) {
            result[name].contacts = Math.round(count * contactMultiplier);
          }
        }
        return result;
      };
      
      // Geography breakdown - try multiple possible keys
      const geographyBreakdown = processAggregation(
        aggregations.person_locations || 
        aggregations.organization_locations || 
        aggregations.country ||
        aggregations.countries ||
        [],
        totalAccounts,
        true
      );
      console.log('Geography breakdown entries:', Object.keys(geographyBreakdown).length);

      // Industry breakdown - try multiple possible keys
      const industryBreakdown = processAggregation(
        aggregations.organization_industry_tag_ids || 
        aggregations.industry ||
        aggregations.industries ||
        [],
        totalAccounts
      );
      console.log('Industry breakdown entries:', Object.keys(industryBreakdown).length);

      // Company size breakdown
      const companySizeBreakdown = processAggregation(
        aggregations.organization_num_employees_ranges || 
        aggregations.employee_ranges ||
        aggregations.company_size ||
        [],
        totalAccounts
      );
      console.log('Company size breakdown entries:', Object.keys(companySizeBreakdown).length);

      // Revenue breakdown
      const revenueBreakdown = processAggregation(
        aggregations.organization_estimated_revenue_range || 
        aggregations.revenue_range ||
        aggregations.revenue ||
        [],
        totalAccounts
      );
      console.log('Revenue breakdown entries:', Object.keys(revenueBreakdown).length);

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
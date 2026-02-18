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
      console.log(`No primary ICP found for org ${org_id} - skipping sync`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'No primary ICP found for this organization',
          totalAccounts: 0,
          totalContacts: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log('Found primary ICP:', icpData.name);

    let syncResult;

    if (provider === 'apollo') {
      const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
      if (!apolloApiKey) {
        throw new Error('Apollo API key not configured');
      }

      // Helper function to map company sizes to Apollo ranges
      // Maps any size to the nearest Apollo bucket rather than requiring exact matches
      const mapCompanySizesToApolloRanges = (sizes: number[]): string[] => {
        const ranges = sizes.map(size => {
          if (size <= 10) return '1,10';
          if (size <= 50) return '11,50';
          if (size <= 200) return '51,200';
          if (size <= 500) return '201,500';
          if (size <= 1000) return '501,1000';
          if (size <= 5000) return '1001,5000';
          if (size <= 10000) return '5001,10000';
          return '10001,999999';
        });
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

      // Build Apollo search criteria from ICP - we'll paginate to get enough data
      const baseRequestBody: any = {
        page: 1,
        // Don't include per_page or page_size - Apollo doesn't support it
        // Apollo returns default number of records per page (typically 25-100)
      };

      // Add geography filters
      if (icpData.geographies && icpData.geographies.length > 0) {
        baseRequestBody.organization_locations = icpData.geographies;
      }

      // Add company size filters - convert to Apollo comma-separated format
      if (icpData.company_sizes && icpData.company_sizes.length > 0) {
        const apolloRanges = mapCompanySizesToApolloRanges(icpData.company_sizes);
        if (apolloRanges.length > 0) {
          baseRequestBody.organization_num_employees_ranges = apolloRanges;
        }
      }

      // Add revenue filters - parse and convert to Apollo's flat bracket notation
      if (icpData.revenue_ranges && icpData.revenue_ranges.length > 0) {
        const { min, max } = parseRevenueRanges(icpData.revenue_ranges);
        // Apollo uses bracket notation: revenue_range[min] and revenue_range[max]
        if (min !== null) {
          baseRequestBody['revenue_range[min]'] = min;
        }
        if (max !== null) {
          baseRequestBody['revenue_range[max]'] = max;
        }
      }

      // Add industry + sub-industry + company keywords as keyword tags
      // Apollo's q_organization_keyword_tags accepts plain text strings
      const keywordTags: string[] = [];

      if (icpData.industries && icpData.industries.length > 0) {
        keywordTags.push(...icpData.industries);
      }
      if (icpData.sub_industries && icpData.sub_industries.length > 0) {
        keywordTags.push(...icpData.sub_industries);
      }
      if (icpData.company_keywords && icpData.company_keywords.length > 0) {
        keywordTags.push(...icpData.company_keywords);
      }

      if (keywordTags.length > 0) {
        baseRequestBody.q_organization_keyword_tags = keywordTags;
        console.log(`Added ${keywordTags.length} keyword tags:`, keywordTags);
      }

      console.log('Calling Apollo API with filters:', JSON.stringify(baseRequestBody, null, 2));

      // Fetch multiple pages for better statistical sampling
      // More pages = more accurate breakdowns (extrapolated to total)
      const allOrganizations: any[] = [];
      let currentPage = 1;
      const maxPages = 20; // Fetch up to 20 pages for reliable breakdowns
      let totalAccounts = 0;

      while (currentPage <= maxPages) {
        const requestBody = { ...baseRequestBody, page: currentPage };
        
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
        const organizations = apolloData.organizations || [];
        totalAccounts = apolloData.pagination?.total_entries || 0;
        
        allOrganizations.push(...organizations);
        
        console.log(`Page ${currentPage}: fetched ${organizations.length} organizations (total so far: ${allOrganizations.length})`);
        
        // Stop if no more results or reached max pages
        if (organizations.length === 0 || currentPage >= maxPages) {
          break;
        }
        
        currentPage++;
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`Fetched ${allOrganizations.length} organizations from ${currentPage} pages. Total available: ${totalAccounts}`);

      
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
        const hasLargeCompanies = icpData.company_sizes.some((size: number) => 
          size >= 1000 // Companies with 1000+ employees
        );
        if (hasLargeCompanies) contactMultiplier *= 1.5; // More contacts in larger companies
      }

      const totalContacts = Math.round(totalAccounts * contactMultiplier);

      // Calculate breakdowns from actual organization records
      const geographyCounts: Record<string, number> = {};
      const industryCounts: Record<string, number> = {};
      const companySizeCounts: Record<string, number> = {};
      const revenueCounts: Record<string, number> = {};

      // Process each organization to build breakdowns
      for (const org of allOrganizations) {
        // Geography
        const country = org.country || 'Unknown';
        geographyCounts[country] = (geographyCounts[country] || 0) + 1;

        // Industry
        const industry = org.industry || org.primary_industry_tag || 'Unknown';
        industryCounts[industry] = (industryCounts[industry] || 0) + 1;

        // Company size
        const empCount = org.estimated_num_employees;
        let sizeRange = 'Unknown';
        if (empCount) {
          if (empCount < 10) sizeRange = '1-10';
          else if (empCount < 50) sizeRange = '11-50';
          else if (empCount < 200) sizeRange = '51-200';
          else if (empCount < 500) sizeRange = '201-500';
          else if (empCount < 1000) sizeRange = '501-1000';
          else if (empCount < 5000) sizeRange = '1001-5000';
          else if (empCount < 10000) sizeRange = '5001-10000';
          else sizeRange = '10000+';
        }
        companySizeCounts[sizeRange] = (companySizeCounts[sizeRange] || 0) + 1;

        // Revenue
        const revenue = org.estimated_annual_revenue;
        let revenueRange = 'Unknown';
        if (revenue) {
          if (revenue < 1000000) revenueRange = '<$1M';
          else if (revenue < 5000000) revenueRange = '$1M-$5M';
          else if (revenue < 10000000) revenueRange = '$5M-$10M';
          else if (revenue < 50000000) revenueRange = '$10M-$50M';
          else if (revenue < 100000000) revenueRange = '$50M-$100M';
          else if (revenue < 500000000) revenueRange = '$100M-$500M';
          else if (revenue < 1000000000) revenueRange = '$500M-$1B';
          else revenueRange = '$1B+';
        }
        revenueCounts[revenueRange] = (revenueCounts[revenueRange] || 0) + 1;
      }

      // Helper to convert counts to breakdown format with extrapolation
      const createBreakdown = (counts: Record<string, number>, includeContacts = false) => {
        const result: Record<string, any> = {};
        const sampledTotal = Object.values(counts).reduce((sum, count) => sum + count, 0);
        
        for (const [name, count] of Object.entries(counts)) {
          // Extrapolate to total accounts based on sample
          const percentage = sampledTotal > 0 ? (count / sampledTotal) * 100 : 0;
          const extrapolatedAccounts = Math.round((count / sampledTotal) * totalAccounts);
          
          result[name] = {
            accounts: extrapolatedAccounts,
            percentage: parseFloat(percentage.toFixed(1))
          };
          
          if (includeContacts) {
            result[name].contacts = Math.round(extrapolatedAccounts * contactMultiplier);
          }
        }
        return result;
      };

      const geographyBreakdown = createBreakdown(geographyCounts, true);
      const industryBreakdown = createBreakdown(industryCounts);
      const companySizeBreakdown = createBreakdown(companySizeCounts);
      const revenueBreakdown = createBreakdown(revenueCounts);

      console.log('Breakdowns calculated:', {
        geography: Object.keys(geographyBreakdown).length,
        industry: Object.keys(industryBreakdown).length,
        companySize: Object.keys(companySizeBreakdown).length,
        revenue: Object.keys(revenueBreakdown).length
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
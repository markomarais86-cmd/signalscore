import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ICPSearchRequest {
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  persona_filters?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      industries, 
      geographies, 
      company_sizes,
      revenue_ranges,
      persona_filters 
    }: ICPSearchRequest = await req.json();

    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Apollo API key not configured',
          total_available: 0,
          sample_titles: [],
          seniority_breakdown: {}
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-apollo-by-icp] Searching with ICP criteria:', {
      industries: industries?.length || 0,
      geographies: geographies?.length || 0,
      company_sizes,
      revenue_ranges
    });

    // Build Apollo search parameters based on ICP criteria
    const searchBody: Record<string, unknown> = {
      per_page: 1, // Preview only - no credits consumed
      page: 1,
    };

    // Map industries to Apollo industry keywords
    if (industries && industries.length > 0) {
      searchBody.q_organization_industry_tag_ids = industries;
      // Also try keyword search for better matching
      searchBody.q_keywords = industries.slice(0, 5).join(' OR ');
    }

    // Map geographies to Apollo location filters
    if (geographies && geographies.length > 0) {
      // Apollo uses country codes and location names
      const locationNames = geographies.map(g => {
        // Handle common formats
        if (g.includes(',')) return g.split(',')[0].trim();
        return g;
      });
      searchBody.organization_locations = locationNames;
    }

    // Map company sizes to Apollo employee ranges
    if (company_sizes && company_sizes.length > 0) {
      const employeeRanges: string[] = [];
      company_sizes.forEach(size => {
        if (size <= 10) employeeRanges.push('1,10');
        else if (size <= 50) employeeRanges.push('11,50');
        else if (size <= 200) employeeRanges.push('51,200');
        else if (size <= 500) employeeRanges.push('201,500');
        else if (size <= 1000) employeeRanges.push('501,1000');
        else if (size <= 5000) employeeRanges.push('1001,5000');
        else employeeRanges.push('5001,10000');
      });
      if (employeeRanges.length > 0) {
        searchBody.organization_num_employees_ranges = [...new Set(employeeRanges)];
      }
    }

    // Map revenue ranges to Apollo revenue filter
    if (revenue_ranges && revenue_ranges.length > 0) {
      const revenueRanges: string[] = [];
      revenue_ranges.forEach(range => {
        const lowerRange = range.toLowerCase();
        if (lowerRange.includes('< $100') || lowerRange.includes('under 100')) {
          revenueRanges.push('0,100000000');
        } else if (lowerRange.includes('$100m') && lowerRange.includes('$1b')) {
          revenueRanges.push('100000000,1000000000');
        } else if (lowerRange.includes('$1b') || lowerRange.includes('over 1b')) {
          revenueRanges.push('1000000000,');
        }
      });
      if (revenueRanges.length > 0) {
        searchBody.organization_revenue_ranges = [...new Set(revenueRanges)];
      }
    }

    // Map persona filters to seniority levels
    if (persona_filters && persona_filters.length > 0) {
      const seniorityMap: Record<string, string[]> = {
        'Technical Decision Maker': ['c_suite', 'vp', 'director'],
        'Business Decision Maker': ['c_suite', 'vp', 'director'],
        'IT Decision Maker': ['c_suite', 'vp', 'director'],
        'Technical Influencer': ['manager', 'senior'],
        'Business Influencer': ['manager', 'senior'],
      };
      
      const seniorities: string[] = [];
      persona_filters.forEach(p => {
        const levels = seniorityMap[p] || [];
        levels.forEach(l => {
          if (!seniorities.includes(l)) {
            seniorities.push(l);
          }
        });
      });
      
      if (seniorities.length > 0) {
        searchBody.person_seniorities = seniorities;
      }
    }

    console.log('[search-apollo-by-icp] Apollo search body:', JSON.stringify(searchBody, null, 2));

    // Call Apollo People Search API (preview mode - 1 result only)
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey,
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[search-apollo-by-icp] Apollo API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Apollo API error: ${response.status}`,
          total_available: 0,
          sample_titles: [],
          seniority_breakdown: {}
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const totalAvailable = data.pagination?.total_entries || 0;
    const people = data.people || [];

    // Extract sample titles from the preview
    const sampleTitles: string[] = [];
    const seniorityBreakdown: Record<string, number> = {};

    people.forEach((person: any) => {
      if (person.title && !sampleTitles.includes(person.title)) {
        sampleTitles.push(person.title);
      }
      if (person.seniority) {
        seniorityBreakdown[person.seniority] = (seniorityBreakdown[person.seniority] || 0) + 1;
      }
    });

    console.log('[search-apollo-by-icp] Preview result:', {
      total_available: totalAvailable,
      sample_titles: sampleTitles.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_available: totalAvailable,
        sample_titles: sampleTitles.slice(0, 5),
        seniority_breakdown: seniorityBreakdown,
        filters_applied: {
          industries: industries?.length || 0,
          geographies: geographies?.length || 0,
          company_sizes: company_sizes?.length || 0,
          revenue_ranges: revenue_ranges?.length || 0,
          persona_filters: persona_filters?.length || 0
        },
        message: totalAvailable > 0 
          ? `Found ${totalAvailable.toLocaleString()} contacts matching your ICP criteria`
          : 'No contacts found matching your criteria. Try broadening your filters.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-apollo-by-icp] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        total_available: 0,
        sample_titles: [],
        seniority_breakdown: {}
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

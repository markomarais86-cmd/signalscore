import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreviewRequest {
  domains: string[];
  persona_filters?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domains, persona_filters }: PreviewRequest = await req.json();

    if (!domains || domains.length === 0) {
      return new Response(
        JSON.stringify({ error: 'domains array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Apollo API key not configured',
          configured: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[preview-apollo-contacts] Previewing contacts for ${domains.length} domains`);

    // Map persona filters to Apollo seniority levels
    const seniorityMapping: Record<string, string[]> = {
      'Technical Decision Maker': ['vp', 'director', 'c_suite'],
      'Business Decision Maker': ['vp', 'director', 'c_suite', 'owner', 'founder'],
      'IT Decision Maker': ['vp', 'director', 'c_suite'],
      'Technical Influencer': ['manager', 'senior'],
      'Business Influencer': ['manager', 'senior'],
    };

    const seniorities = persona_filters && persona_filters.length > 0
      ? [...new Set(persona_filters.flatMap(p => seniorityMapping[p] || []))]
      : ['vp', 'director', 'c_suite', 'manager', 'senior'];

    // Use mixed_people/search with per_page: 1 to get total count WITHOUT consuming credits
    // This endpoint returns obfuscated data for free
    const searchBody: Record<string, unknown> = {
      q_organization_domains: domains.slice(0, 100).join('\n'), // Limit to 100 domains per request
      per_page: 1, // Minimal - just to get total count
      person_seniorities: seniorities,
    };

    console.log('[preview-apollo-contacts] Calling Apollo mixed_people/search...');

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
      console.error('[preview-apollo-contacts] Apollo API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Apollo API error: ${response.status}`,
          details: errorText,
          configured: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[preview-apollo-contacts] Response:', {
      total_entries: data.pagination?.total_entries,
      people_count: data.people?.length,
    });

    // Extract preview info from the response
    const totalAvailable = data.pagination?.total_entries || 0;
    
    // Get a sample of job titles from the obfuscated preview data
    const sampleTitles: string[] = [];
    if (data.people && data.people.length > 0) {
      data.people.forEach((person: any) => {
        if (person.title && !sampleTitles.includes(person.title)) {
          sampleTitles.push(person.title);
        }
      });
    }

    // Get breakdown by seniority if available
    const seniorityBreakdown: Record<string, number> = {};
    if (data.people) {
      data.people.forEach((person: any) => {
        const seniority = person.seniority || 'unknown';
        seniorityBreakdown[seniority] = (seniorityBreakdown[seniority] || 0) + 1;
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        api_key_valid: true,
        total_available: totalAvailable,
        domains_searched: Math.min(domains.length, 100),
        sample_titles: sampleTitles.slice(0, 5),
        seniority_breakdown: seniorityBreakdown,
        message: totalAvailable > 0 
          ? `Found ${totalAvailable.toLocaleString()} contacts at ${Math.min(domains.length, 100)} accounts`
          : 'No contacts found matching your criteria',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[preview-apollo-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

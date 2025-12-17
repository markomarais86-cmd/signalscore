import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { applyRateLimit } from '../_shared/rate-limit.ts';

interface SearchRequest {
  org_id: string;
  domains?: string[];
  icp_criteria?: {
    industries?: string[];
    geographies?: string[];
    company_sizes?: number[];
    revenue_ranges?: string[];
  };
  persona_filters?: string[];
  max_contacts?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, domains, icp_criteria, persona_filters, max_contacts = 100 }: SearchRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for rate limiting
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(supabase, org_id, 'search-pdl-contacts');
    if (rateLimitResponse) {
      console.log(`[search-pdl-contacts] Rate limited for org ${org_id}`);
      return rateLimitResponse;
    }

    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    if (!pdlApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'PDL API key not configured',
          configured: false,
          provider: 'pdl'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[search-pdl-contacts] Starting search for org ${org_id}`);

    // Map persona filters to PDL job title seniorities
    const seniorityMapping: Record<string, string[]> = {
      'Technical Decision Maker': ['cxo', 'vp', 'director'],
      'Business Decision Maker': ['cxo', 'vp', 'director', 'owner', 'partner'],
      'IT Decision Maker': ['cxo', 'vp', 'director'],
      'Technical Influencer': ['manager', 'senior'],
      'Business Influencer': ['manager', 'senior'],
    };

    const jobSeniorities = persona_filters && persona_filters.length > 0
      ? [...new Set(persona_filters.flatMap(p => seniorityMapping[p] || []))]
      : ['cxo', 'vp', 'director', 'manager'];

    // Build PDL search query
    const searchParams: Record<string, any> = {
      size: Math.min(max_contacts, 100), // PDL max per request
      dataset: 'all',
    };

    // Build SQL-like query for PDL
    const queryParts: string[] = [];

    // Add domain filter if provided
    if (domains && domains.length > 0) {
      const domainList = domains.slice(0, 50).map(d => `"${d}"`).join(',');
      queryParts.push(`job_company_website IN (${domainList})`);
    }

    // Add ICP criteria filters
    if (icp_criteria) {
      if (icp_criteria.geographies && icp_criteria.geographies.length > 0) {
        const countries = icp_criteria.geographies.map(g => `"${g}"`).join(',');
        queryParts.push(`location_country IN (${countries})`);
      }

      if (icp_criteria.industries && icp_criteria.industries.length > 0) {
        const industries = icp_criteria.industries.map(i => `"${i}"`).join(',');
        queryParts.push(`job_company_industry IN (${industries})`);
      }

      if (icp_criteria.company_sizes && icp_criteria.company_sizes.length > 0) {
        const sizes = icp_criteria.company_sizes;
        const minSize = Math.min(...sizes);
        const maxSize = Math.max(...sizes) * 2; // Upper bound
        queryParts.push(`job_company_size >= ${minSize} AND job_company_size <= ${maxSize}`);
      }
    }

    // Add seniority filter
    if (jobSeniorities.length > 0) {
      const seniorities = jobSeniorities.map(s => `"${s}"`).join(',');
      queryParts.push(`job_title_levels IN (${seniorities})`);
    }

    // Require work email
    queryParts.push(`work_email IS NOT NULL`);

    searchParams.sql = queryParts.join(' AND ');

    console.log('[search-pdl-contacts] PDL Query:', searchParams.sql);

    // Call PDL Person Search API
    const response = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': pdlApiKey,
      },
      body: JSON.stringify(searchParams),
    });

    console.log(`[search-pdl-contacts] PDL Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[search-pdl-contacts] PDL API error:', response.status, errorText);
      
      // Handle specific errors
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'PDL credits exhausted',
            configured: true,
            api_accessible: false,
            provider: 'pdl'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: `PDL API error: ${response.status}`,
          details: errorText,
          configured: true,
          provider: 'pdl'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[search-pdl-contacts] PDL Response:', {
      total: data.total,
      returned: data.data?.length,
    });

    // Process and format contacts
    const contacts = (data.data || []).map((person: any) => ({
      email: person.work_email || person.emails?.[0]?.address,
      first_name: person.first_name,
      last_name: person.last_name,
      full_name: person.full_name,
      title: person.job_title,
      company: person.job_company_name,
      company_domain: person.job_company_website,
      seniority: person.job_title_levels?.[0] || 'unknown',
      linkedin_url: person.linkedin_url,
      location: person.location_name,
      country: person.location_country,
    }));

    // Get seniority breakdown
    const seniorityBreakdown: Record<string, number> = {};
    contacts.forEach((c: any) => {
      const seniority = c.seniority || 'unknown';
      seniorityBreakdown[seniority] = (seniorityBreakdown[seniority] || 0) + 1;
    });

    // Get sample titles
    const sampleTitles = [...new Set(contacts.map((c: any) => c.title).filter(Boolean))].slice(0, 5);

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        api_accessible: true,
        provider: 'pdl',
        total_available: data.total || 0,
        contacts_returned: contacts.length,
        contacts: contacts,
        sample_titles: sampleTitles,
        seniority_breakdown: seniorityBreakdown,
        credits_used: Math.min(contacts.length, 1), // PDL charges per search, not per result
        message: data.total > 0 
          ? `Found ${data.total.toLocaleString()} contacts via PDL`
          : 'No contacts found matching your criteria',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-pdl-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, provider: 'pdl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

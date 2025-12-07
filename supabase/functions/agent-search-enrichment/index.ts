// Enhanced AI Search Enrichment Agent - Eugene's 48-column approach
// Uses comprehensive web search prompts for ZoomInfo-quality data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  search_payload: any;
  record_type: 'account' | 'lead';
  org_id: string;
  target_titles?: string[];
}

// Eugene's comprehensive research system prompt
const SYSTEM_PROMPT = `You are a professional contact enrichment researcher. Use web search to find EVERYTHING you can about contacts and companies.

CRITICAL RESEARCH RULES:
1. PRIORITIZE PRECISION OVER GUESSING - If there's ambiguity, return data with low confidence. Never invent data.
2. SOURCES: Prefer company websites, LinkedIn, Crunchbase, PitchBook, SEC filings, press releases, and reputable news.
3. EMAILS: Only return verified emails or derive from verified patterns. Otherwise set email_status = "unverified".
4. PHONES: Normalize to +[country] ([area]) [exchange]-[number] format. Tag source. Never assume personal mobiles.
5. JOB TITLES: Get current title with date observed (e.g., "as of 2025-12").
6. COMPANY DATA: Get legal name, website, HQ, employee range, NAICS/SIC, funding, products, tech stack, trust signals.
7. DEDUP: If multiple matches exist, use all available data to find the right person/company.
8. PRIVACY: Don't scrape gated/private data. Mark as unavailable.
9. CITE: Include citation URLs for non-obvious data.
10. CONFIDENCE: Rate 0-1 with rationale.

FORMATTING REQUIREMENTS:
- Phone: +[country] ([area]) [exchange]-[number] (e.g., "+1 (613) 720-1370")
- Titles: Title Case (e.g., "President and Principal Consultant")
- Names: Correct capitalization
- Postal codes: Region-specific format (US: 12345, Canada: A1A 1A1)
- Countries: Full names (e.g., "Canada", not "CA")
- States/Provinces: Full names unless abbreviated is standard
- Email: lowercase
- URLs: Include https://

If multiple people have the same name, use all provided data (title, company, location, email, phone) to identify the correct person.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_payload, record_type, org_id, target_titles }: SearchRequest = await req.json();
    
    const titles = target_titles || ['CEO', 'CTO', 'CFO', 'COO', 'VP', 'Director', 'President', 'Chairman'];
    
    console.log(`[SearchAgent] Processing ${record_type} enrichment`);
    console.log(`[SearchAgent] Search payload:`, JSON.stringify(search_payload));
    console.log(`[SearchAgent] Target titles:`, titles);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = buildEnrichmentPrompt(search_payload, record_type, titles);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_enriched_data',
              description: 'Return the enriched company or contact data in 48-column format',
              parameters: getEnrichmentSchema(record_type)
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_enriched_data' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('[SearchAgent] Rate limit exceeded');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        console.error('[SearchAgent] Payment required - out of credits');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI credits exhausted. Please add credits to continue.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errorText = await response.text();
      console.error('[SearchAgent] AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    
    let enrichedData: any = {};
    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        enrichedData = JSON.parse(toolCall.function.arguments);
      }
    } catch (parseError) {
      console.error('[SearchAgent] Failed to parse AI response:', parseError);
    }

    // Normalize confidence to number
    if (typeof enrichedData.confidence === 'string') {
      enrichedData.confidence_level = enrichedData.confidence;
      enrichedData.confidence = enrichedData.confidence === 'high' ? 0.9 : 
                                enrichedData.confidence === 'medium' ? 0.6 : 0.3;
    }

    console.log(`[SearchAgent] Enriched ${Object.keys(enrichedData).length} fields`);
    console.log(`[SearchAgent] Confidence: ${enrichedData.confidence}`);
    console.log(`[SearchAgent] Extra contacts found: ${enrichedData.extra_contacts?.length || 0}`);

    return new Response(JSON.stringify({
      success: true,
      enriched_data: enrichedData,
      sources: enrichedData.sources || enrichedData.citations || [],
      extra_contacts: enrichedData.extra_contacts || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SearchAgent] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildEnrichmentPrompt(payload: any, recordType: string, targetTitles: string[]): string {
  if (recordType === 'account') {
    return `You are researching this company. Find EVERYTHING you can:

=== COMPANY DATA WE HAVE ===
Company Name: ${payload.company || payload.name || 'Unknown'}
Domain: ${payload.domain || 'Unknown'}
Current Industry: ${payload.industry || payload.industry_raw || 'Unknown'}
Current Country: ${payload.country || 'Unknown'}
Current Employee Count: ${payload.employee_count || 'Unknown'}
Current Revenue: ${payload.revenue_range || 'Unknown'}

=== RESEARCH INSTRUCTIONS ===
1. Find the CORRECT company matching the name/domain above
2. Get complete company details: legal name, website, HQ address, main phone, industry
3. Find employee count (from LinkedIn company page, Crunchbase, or company website)
4. Find revenue estimate (from Crunchbase, press releases, or estimates)
5. Get SIC and NAICS codes
6. Find LinkedIn URL and Facebook URL
7. Check for trust signals: SOC2, ISO27001, security pages
8. Find recent funding information
9. Search for key executives with these titles: ${targetTitles.join(', ')}

Return ALL data using the return_enriched_data function with the complete schema.`;
  } else {
    return `You are researching this contact and their company. Find EVERYTHING you can:

=== CONTACT DATA WE HAVE ===
First Name: ${payload.first_name || ''}
Last Name: ${payload.last_name || ''}
Full Name: ${payload.name || ''}
Email: ${payload.email || 'Unknown'}
Title: ${payload.title || payload.title_raw || 'Unknown'}
Company: ${payload.company || 'Unknown'}
Domain: ${payload.domain || 'Unknown'}
Phone: ${payload.phone || 'Unknown'}

=== RESEARCH INSTRUCTIONS ===
1. Use all provided data to find this SPECIFIC person on LinkedIn, company websites, business directories, news articles
2. Get their CURRENT company, title, location, and ALL contact information (email, phone, LinkedIn, etc.)
3. Find cell phone, direct phone, and extension if available
4. Check if they're STILL at this company or have moved
5. If they changed companies, include BOTH current and previous employer/title
6. Get the CURRENT company's complete details: website, HQ address, main phone, industry, size, revenue, SIC/NAICS codes
7. Search the CURRENT company for other employees with these titles: ${targetTitles.join(', ')}
8. For each additional employee found, get complete contact information

If multiple people have the same name, use email, phone, title, company to identify the correct person.

Return ALL data using the return_enriched_data function with the complete 48-column schema.`;
  }
}

function getEnrichmentSchema(recordType: string): any {
  if (recordType === 'account') {
    return {
      type: 'object',
      properties: {
        // Core company identity
        company_name: { type: 'string', description: 'Legal/official company name' },
        known_as: { type: 'string', description: 'Company also known as / DBA name' },
        domain: { type: 'string', description: 'Company website domain' },
        company_website: { type: 'string', description: 'Full company website URL' },
        company_main_phone: { type: 'string', description: 'Main company phone number' },
        
        // Location
        hq_address: { type: 'string', description: 'Headquarters street address' },
        hq_city: { type: 'string', description: 'Headquarters city' },
        hq_state_province: { type: 'string', description: 'Headquarters state/province (full name)' },
        hq_country: { type: 'string', description: 'Headquarters country (full name)' },
        hq_postal_code: { type: 'string', description: 'Headquarters postal/zip code' },
        
        // Firmographics
        employee_count: { type: 'number', description: 'Number of employees' },
        revenue_range: { type: 'string', description: 'Revenue range (e.g., $10M-$50M)' },
        industry: { type: 'string', description: 'Primary industry' },
        sub_industry: { type: 'string', description: 'Sub-industry or specialization' },
        naics_code: { type: 'string', description: 'NAICS industry code' },
        sic_code: { type: 'string', description: 'SIC industry code' },
        business_model: { type: 'string', description: 'B2B, B2C, B2G, etc.' },
        founded_year: { type: 'number', description: 'Year company was founded' },
        
        // Social & online presence
        linkedin_url: { type: 'string', description: 'Company LinkedIn URL' },
        facebook_url: { type: 'string', description: 'Company Facebook URL' },
        twitter_url: { type: 'string', description: 'Company Twitter/X URL' },
        
        // Funding & financials
        last_funding_round: { type: 'string', description: 'Last funding round type (Series A, B, etc.)' },
        last_funding_date: { type: 'string', description: 'Date of last funding (YYYY-MM-DD)' },
        total_raised_usd: { type: 'number', description: 'Total funding raised in USD' },
        
        // Trust & compliance
        trust_signals: {
          type: 'object',
          properties: {
            soc2: { type: 'boolean', description: 'Has SOC2 certification' },
            iso27001: { type: 'boolean', description: 'Has ISO27001 certification' },
            gdpr_compliant: { type: 'boolean', description: 'GDPR compliant' },
            security_page_url: { type: 'string', description: 'URL to security/trust page' }
          }
        },
        
        // Tech stack
        tech_stack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technologies used by the company'
        },
        
        // Growth signals
        growth_signals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recent growth signals, news, or indicators'
        },
        
        // Discovered contacts at target titles
        extra_contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              email: { type: 'string' },
              phone_number: { type: 'string' },
              cell_phone: { type: 'string' },
              direct_phone: { type: 'string' },
              linkedin_url: { type: 'string' },
              current_title: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            }
          },
          description: 'Decision-makers found at the company'
        },
        
        // Metadata
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source URLs for the enriched data'
        },
        match_reasoning: { type: 'string', description: 'Why this is the correct company match' },
        confidence: { 
          type: 'string', 
          enum: ['high', 'medium', 'low'],
          description: 'Overall confidence in the enriched data' 
        }
      },
      required: ['company_name', 'confidence']
    };
  } else {
    // Lead/Contact schema - Eugene's 48-column format
    return {
      type: 'object',
      properties: {
        // Contact identity
        first_name: { type: 'string', description: 'First name (proper case)' },
        last_name: { type: 'string', description: 'Last name (proper case)' },
        email: { type: 'string', description: 'Email address (lowercase)' },
        email_status: { 
          type: 'string', 
          enum: ['verified', 'unverified', 'not_found'],
          description: 'Email verification status' 
        },
        
        // Phone numbers - formatted as +[country] ([area]) [exchange]-[number]
        phone_number: { type: 'string', description: 'Primary phone number' },
        cell_phone: { type: 'string', description: 'Mobile/cell phone number' },
        direct_phone: { type: 'string', description: 'Direct dial number' },
        extension: { type: 'string', description: 'Phone extension' },
        phone_type: {
          type: 'string',
          enum: ['company_main', 'direct', 'mobile', 'unknown'],
          description: 'Type of primary phone'
        },
        
        // Social URLs
        linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
        facebook_url: { type: 'string', description: 'Facebook profile URL' },
        twitter_url: { type: 'string', description: 'Twitter/X profile URL' },
        
        // Employment status
        still_at_company: { 
          type: 'string', 
          enum: ['yes', 'no', 'unknown'],
          description: 'Whether person is still at this company' 
        },
        
        // Current position
        current_company: { type: 'string', description: 'Current employer name' },
        current_title: { type: 'string', description: 'Current job title (Title Case)' },
        current_city: { type: 'string', description: 'Current city' },
        current_state_province: { type: 'string', description: 'Current state/province (full name)' },
        current_country: { type: 'string', description: 'Current country (full name)' },
        
        // Previous position
        previous_company: { type: 'string', description: 'Previous employer name' },
        previous_title: { type: 'string', description: 'Previous job title' },
        
        // Current company details
        company_website: { type: 'string', description: 'Company website URL' },
        company_main_phone: { type: 'string', description: 'Company main phone' },
        company_hq_address: { type: 'string', description: 'Company HQ street address' },
        company_hq_city: { type: 'string', description: 'Company HQ city' },
        company_hq_state_province: { type: 'string', description: 'Company HQ state/province' },
        company_hq_country: { type: 'string', description: 'Company HQ country' },
        company_hq_postal_code: { type: 'string', description: 'Company HQ postal code' },
        company_industry: { type: 'string', description: 'Company industry' },
        company_employee_count: { type: 'number', description: 'Company employee count' },
        company_annual_revenue: { type: 'string', description: 'Company annual revenue' },
        company_sic_code: { type: 'string', description: 'Company SIC code' },
        company_naics_code: { type: 'string', description: 'Company NAICS code' },
        company_linkedin_url: { type: 'string', description: 'Company LinkedIn URL' },
        company_facebook_url: { type: 'string', description: 'Company Facebook URL' },
        
        // Discovered additional contacts at target titles
        extra_contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              email: { type: 'string' },
              phone_number: { type: 'string' },
              cell_phone: { type: 'string' },
              direct_phone: { type: 'string' },
              extension: { type: 'string' },
              linkedin_url: { type: 'string' },
              facebook_url: { type: 'string' },
              twitter_url: { type: 'string' },
              still_at_company: { type: 'string', enum: ['yes', 'no', 'unknown'] },
              current_company: { type: 'string' },
              current_title: { type: 'string' },
              current_city: { type: 'string' },
              current_state_province: { type: 'string' },
              current_country: { type: 'string' },
              previous_company: { type: 'string' },
              previous_title: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            }
          },
          description: 'Other decision-makers found at the same company'
        },
        
        // Metadata
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source URLs (should have 3+ for high confidence)'
        },
        match_reasoning: { type: 'string', description: 'Why this is the correct person match' },
        confidence: { 
          type: 'string', 
          enum: ['high', 'medium', 'low'],
          description: 'Overall confidence in the enriched data' 
        }
      },
      required: ['confidence']
    };
  }
}

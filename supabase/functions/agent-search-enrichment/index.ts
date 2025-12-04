import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  search_payload: any;
  record_type: 'account' | 'lead';
  org_id: string;
}

const SYSTEM_PROMPT = `You are an enterprise-grade contact and company enrichment agent.
Your job is to use web search and business intelligence to return accurate, verifiable information.

CRITICAL RULES:
1. Never fabricate data - only return facts you can verify
2. Use "" for unknown values
3. Return all data in the exact JSON schema requested
4. Include source URLs where possible
5. Format phone numbers as: +CountryCode (Area) XXX-XXXX
6. Use proper case for names and titles
7. Use full country and state names

For company enrichment, find:
- Company size (employee count)
- Revenue range
- Industry classification
- Headquarters location
- Website and social URLs
- Recent funding/growth signals

For contact enrichment, find:
- Current title and company
- Verified email format
- Phone numbers (direct, cell)
- LinkedIn profile
- Whether they're still at the company
- Previous company/title if available`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_payload, record_type, org_id }: SearchRequest = await req.json();
    
    console.log(`[SearchAgent] Processing ${record_type} enrichment`);
    console.log(`[SearchAgent] Search payload:`, JSON.stringify(search_payload));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build the enrichment prompt based on record type
    const prompt = buildEnrichmentPrompt(search_payload, record_type);

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
              description: 'Return the enriched company or contact data',
              parameters: getEnrichmentSchema(record_type)
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_enriched_data' } }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    
    let enrichedData = {};
    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        enrichedData = JSON.parse(toolCall.function.arguments);
      }
    } catch (parseError) {
      console.error('[SearchAgent] Failed to parse AI response:', parseError);
    }

    console.log(`[SearchAgent] Enriched data:`, JSON.stringify(enrichedData));

    return new Response(JSON.stringify({
      success: true,
      enriched_data: enrichedData,
      sources: enrichedData.sources || []
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

function buildEnrichmentPrompt(payload: any, recordType: string): string {
  if (recordType === 'account') {
    return `Enrich this company with accurate, verified data:

Company Name: ${payload.company || 'Unknown'}
Domain: ${payload.domain || 'Unknown'}
Current Industry: ${payload.industry || 'Unknown'}
Current Country: ${payload.country || 'Unknown'}
Current Employee Count: ${payload.employee_count || 'Unknown'}
Current Revenue: ${payload.revenue_range || 'Unknown'}

Find and verify:
1. Accurate employee count (look for LinkedIn company page, Crunchbase, etc.)
2. Revenue range (look for funding announcements, press releases)
3. Industry classification (NAICS/SIC codes if available)
4. Headquarters location (city, state, country)
5. Company website and LinkedIn URL
6. Any recent funding or growth signals

Return the enriched data using the return_enriched_data function.`;
  } else {
    return `Enrich this contact with accurate, verified data:

Name: ${payload.first_name || ''} ${payload.last_name || ''} ${payload.name || ''}
Email: ${payload.email || 'Unknown'}
Title: ${payload.title || 'Unknown'}
Company: ${payload.company || 'Unknown'}
Domain: ${payload.domain || 'Unknown'}
Phone: ${payload.phone || 'Unknown'}

Find and verify:
1. Current title and if they're still at this company
2. LinkedIn profile URL
3. Direct phone number and cell phone if available
4. Previous company and title
5. Email format verification (does the domain match the company?)
6. Any additional contacts at the same company with decision-maker titles

Return the enriched data using the return_enriched_data function.`;
  }
}

function getEnrichmentSchema(recordType: string): any {
  if (recordType === 'account') {
    return {
      type: 'object',
      properties: {
        company_name: { type: 'string', description: 'Verified company name' },
        domain: { type: 'string', description: 'Company website domain' },
        employee_count: { type: 'number', description: 'Number of employees' },
        revenue_range: { type: 'string', description: 'Revenue range (e.g., $10M-$50M)' },
        industry: { type: 'string', description: 'Industry classification' },
        naics_code: { type: 'string', description: 'NAICS code if found' },
        sic_code: { type: 'string', description: 'SIC code if found' },
        hq_city: { type: 'string', description: 'Headquarters city' },
        hq_state: { type: 'string', description: 'Headquarters state/province' },
        hq_country: { type: 'string', description: 'Headquarters country' },
        linkedin_url: { type: 'string', description: 'Company LinkedIn URL' },
        founded_year: { type: 'number', description: 'Year founded' },
        last_funding_round: { type: 'string', description: 'Last funding round type' },
        total_raised: { type: 'number', description: 'Total funding raised in USD' },
        growth_signals: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Recent growth signals or news' 
        },
        sources: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Source URLs for the data' 
        },
        confidence: { 
          type: 'string', 
          enum: ['high', 'medium', 'low'],
          description: 'Confidence in the enriched data' 
        }
      },
      required: ['company_name', 'confidence']
    };
  } else {
    return {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        email_verified: { type: 'boolean', description: 'Whether email format matches company domain' },
        title: { type: 'string', description: 'Current job title' },
        company: { type: 'string', description: 'Current company' },
        still_at_company: { 
          type: 'string', 
          enum: ['yes', 'no', 'unknown'],
          description: 'Whether person is still at this company' 
        },
        phone: { type: 'string', description: 'Primary phone number' },
        direct_phone: { type: 'string', description: 'Direct line' },
        cell_phone: { type: 'string', description: 'Mobile number' },
        linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
        previous_company: { type: 'string' },
        previous_title: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
        extra_contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string' },
              email: { type: 'string' },
              linkedin_url: { type: 'string' }
            }
          },
          description: 'Other decision-makers at the same company'
        },
        sources: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Source URLs' 
        },
        confidence: { 
          type: 'string', 
          enum: ['high', 'medium', 'low']
        }
      },
      required: ['confidence']
    };
  }
}
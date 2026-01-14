// Single Company Enrichment - AI-First with ALL Providers
// Uses: Perplexity → OpenAI → Abacus → Lovable (all your AI tools)
// Optional fallback: Apollo/PDL for verified data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, getAvailableProviders, type AIProvider } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichedCompany {
  name: string;
  domain: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  linkedin_url: string | null;
  phone: string | null;
  founded_year: number | null;
  tech_stack: string[] | null;
  funding_round: string | null;
  total_raised: number | null;
  confidence: number;
  source: string;
  citations?: string[];
}

const ENRICHMENT_PROMPT = `Research this company and provide detailed firmographic data.

Return ONLY a JSON object with this exact structure:
{
  "name": "Company Name",
  "domain": "company.com",
  "employee_count": 1000,
  "revenue_range": "$10M-$25M",
  "industry": "Software",
  "country": "United States",
  "city": "San Francisco",
  "linkedin_url": "https://linkedin.com/company/...",
  "phone": "+1-555-1234",
  "founded_year": 2015,
  "tech_stack": ["AWS", "React", "Node.js"],
  "funding_round": "Series B",
  "total_raised": 25000000,
  "confidence": 75
}

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Set confidence based on how certain you are about the data (0-100). Use null for any field you cannot determine. Only output valid JSON.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Please provide a company name or domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract domain if URL provided, or use as-is
    let searchDomain = query.trim().toLowerCase();
    let searchName = query.trim();
    
    // Check if it looks like a domain
    if (searchDomain.includes('.') && !searchDomain.includes(' ')) {
      searchDomain = searchDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      searchName = searchDomain.split('.')[0];
    } else {
      searchDomain = '';
    }

    console.log(`[enrich-single] AI-First Search for: name="${searchName}", domain="${searchDomain}"`);
    
    const providers = getAvailableProviders();
    console.log(`[enrich-single] Available AI providers: ${providers.join(', ')}`);

    let result: EnrichedCompany | null = null;

    // ============================================
    // PHASE 1: AI-FIRST ENRICHMENT (YOUR TOOLS)
    // Uses ALL configured AI providers in order:
    // Perplexity (real-time web) → OpenAI → Abacus → Lovable
    // ============================================
    
    if (providers.length > 0) {
      try {
        console.log('[enrich-single] Phase 1: AI-First Enrichment...');
        
        const searchQuery = searchDomain 
          ? `Research the company "${searchName}" with domain ${searchDomain}`
          : `Research the company "${searchName}"`;
        
        const aiResponse = await callAI('enrichment', [
          { 
            role: 'system', 
            content: 'You are a B2B company research analyst. Provide accurate firmographic data based on publicly available information. Search the web for current, accurate data. Always output valid JSON.' 
          },
          { role: 'user', content: `${searchQuery}\n\n${ENRICHMENT_PROMPT}` }
        ], { 
          maxTokens: 1500, 
          temperature: 0.2,
          search_recency_filter: 'month' // For Perplexity: get recent data
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const citations = aiData.citations || []; // Perplexity provides citations
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Determine which provider actually responded
            // We know because callAI logs which provider succeeded
            const usedProvider = providers[0]; // First available in priority order
            
            result = {
              name: parsed.name || searchName,
              domain: parsed.domain || searchDomain || null,
              employee_count: parsed.employee_count,
              revenue_range: parsed.revenue_range,
              industry: parsed.industry,
              country: parsed.country,
              city: parsed.city,
              linkedin_url: parsed.linkedin_url,
              phone: parsed.phone,
              founded_year: parsed.founded_year,
              tech_stack: parsed.tech_stack,
              funding_round: parsed.funding_round,
              total_raised: parsed.total_raised,
              confidence: Math.min(parsed.confidence || 70, 90),
              source: `launchpulse-ai`,
              citations: citations.length > 0 ? citations : undefined,
            };
            console.log(`[enrich-single] AI enrichment success: ${result.name} (confidence: ${result.confidence})`);
          }
        }
      } catch (e) {
        console.error('[enrich-single] AI enrichment error:', e);
      }
    }

    // ============================================
    // PHASE 2: OPTIONAL - Third-Party Verification
    // Only used if AI couldn't find data or for verification
    // Apollo/PDL are SECONDARY, not primary sources
    // ============================================
    
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    const useThirdPartyFallback = !result && (APOLLO_API_KEY || PDL_API_KEY);
    
    if (useThirdPartyFallback) {
      console.log('[enrich-single] Phase 2: Third-party fallback (AI had no results)...');
      
      const enrichPromises: Promise<EnrichedCompany | null>[] = [];

      // Try Apollo
      if (APOLLO_API_KEY) {
        enrichPromises.push(
          (async () => {
            try {
              // Use search if no domain, enrich if domain exists
              const endpoint = searchDomain 
                ? 'https://api.apollo.io/v1/organizations/enrich'
                : 'https://api.apollo.io/v1/mixed_companies/search';
              
              const body = searchDomain
                ? { api_key: APOLLO_API_KEY, domain: searchDomain }
                : { api_key: APOLLO_API_KEY, q_organization_name: searchName, per_page: 1 };

              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });

              if (response.ok) {
                const data = await response.json();
                const org = searchDomain ? data.organization : data.organizations?.[0];
                
                if (org) {
                  return {
                    name: org.name || searchName,
                    domain: org.primary_domain || searchDomain || null,
                    employee_count: org.estimated_num_employees,
                    revenue_range: mapRevenueToRange(org.estimated_annual_revenue),
                    industry: org.industry,
                    country: org.country,
                    city: org.city,
                    linkedin_url: org.linkedin_url,
                    phone: org.phone,
                    founded_year: org.founded_year,
                    tech_stack: org.technologies?.slice(0, 15) || null,
                    funding_round: org.latest_funding_stage,
                    total_raised: org.total_funding ? parseInt(org.total_funding) : null,
                    confidence: 90,
                    source: 'apollo'
                  };
                }
              }
            } catch (e) {
              console.error('[enrich-single] Apollo error:', e);
            }
            return null;
          })()
        );
      }

      // Try PDL
      if (PDL_API_KEY) {
        enrichPromises.push(
          (async () => {
            try {
              let response;
              
              if (searchDomain) {
                response = await fetch(
                  `https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(searchDomain)}`,
                  { headers: { 'X-Api-Key': PDL_API_KEY } }
                );
              } else {
                response = await fetch('https://api.peopledatalabs.com/v5/company/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Api-Key': PDL_API_KEY },
                  body: JSON.stringify({
                    query: { bool: { must: [{ term: { name: searchName } }] } },
                    size: 1
                  })
                });
              }

              if (response.ok) {
                const data = await response.json();
                const company = searchDomain ? data : data.data?.[0];
                
                if (company?.name) {
                  return {
                    name: company.name || searchName,
                    domain: company.website || searchDomain || null,
                    employee_count: company.employee_count,
                    revenue_range: company.inferred_revenue,
                    industry: company.industry,
                    country: company.location?.country,
                    city: company.location?.locality,
                    linkedin_url: company.linkedin_url,
                    phone: company.phone,
                    founded_year: company.founded,
                    tech_stack: company.tags?.slice(0, 15) || null,
                    funding_round: company.latest_funding_stage,
                    total_raised: company.total_funding_raised,
                    confidence: 85,
                    source: 'pdl'
                  };
                }
              }
            } catch (e) {
              console.error('[enrich-single] PDL error:', e);
            }
            return null;
          })()
        );
      }

      if (enrichPromises.length > 0) {
        const results = await Promise.allSettled(enrichPromises);
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            result = r.value;
            break;
          }
        }
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not find information for this company. Try using the company domain or a more specific name.',
          providers_tried: providers.length > 0 ? providers : ['none - no AI providers configured']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ company: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[enrich-single] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while researching this company' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapRevenueToRange(revenue: number | null | undefined): string | null {
  if (!revenue) return null;
  if (revenue < 1000000) return '$0-$1M';
  if (revenue < 5000000) return '$1M-$5M';
  if (revenue < 10000000) return '$5M-$10M';
  if (revenue < 25000000) return '$10M-$25M';
  if (revenue < 50000000) return '$25M-$50M';
  if (revenue < 100000000) return '$50M-$100M';
  if (revenue < 500000000) return '$100M-$500M';
  if (revenue < 1000000000) return '$500M-$1B';
  if (revenue < 10000000000) return '$1B-$10B';
  return '$10B+';
}

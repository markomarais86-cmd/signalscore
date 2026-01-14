// Single Company Enrichment - Multi-Phase AI Research Engine
// Uses targeted Perplexity queries with domain filtering for each data type
// Fallback chain: Perplexity → OpenAI → Abacus → Lovable → Apollo/PDL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAvailableProviders, getApiKey, type AIProvider } from '../_shared/ai-config.ts';

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
  field_sources?: Record<string, string>;
}

interface ResearchResult {
  data: Partial<EnrichedCompany>;
  confidence: number;
  citations: string[];
  source: string;
}

// ============================================
// PERPLEXITY DIRECT API CALLS WITH DOMAIN FILTERING
// ============================================

async function callPerplexity(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    searchDomainFilter?: string[];
    searchRecencyFilter?: string;
    responseFormat?: any;
    maxTokens?: number;
  } = {}
): Promise<{ content: string; citations: string[] } | null> {
  const apiKey = getApiKey('perplexity');
  if (!apiKey) return null;

  const body: Record<string, any> = {
    model: options.model || 'sonar-pro',
    messages,
    max_tokens: options.maxTokens || 2000,
    temperature: 0.1,
  };

  // Add domain filtering for focused searches
  if (options.searchDomainFilter?.length) {
    body.search_domain_filter = options.searchDomainFilter;
  }

  // Add recency filter
  if (options.searchRecencyFilter) {
    body.search_recency_filter = options.searchRecencyFilter;
  }

  // Add structured output format
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  try {
    console.log(`[Perplexity] Calling with domains: ${options.searchDomainFilter?.join(', ') || 'all'}`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Perplexity] Error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // DEBUG: Log raw response for troubleshooting
    console.log(`[Perplexity] Got ${citations.length} citations`);
    console.log(`[Perplexity] Raw response (first 800 chars): ${content.substring(0, 800)}`);
    
    return { content, citations };
  } catch (error) {
    console.error('[Perplexity] Request failed:', error);
    return null;
  }
}

// ============================================
// HELPER: Extract JSON from AI response
// ============================================

function extractJsonFromResponse(content: string): any | null {
  if (!content) return null;
  
  try {
    // Try 1: Direct JSON parse
    if (content.trim().startsWith('{')) {
      return JSON.parse(content.trim());
    }
    
    // Try 2: JSON in markdown code block
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    
    // Try 3: Find JSON object anywhere in text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log('[JSON Parse] Failed to parse, will try text extraction');
  }
  
  return null;
}

// ============================================
// HELPER: Extract data from plain text (fallback)
// ============================================

function extractFromText(content: string): Partial<EnrichedCompany> {
  const result: Partial<EnrichedCompany> = {};
  
  // Employee count patterns
  const empPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*(?:employees|staff|team members|people)/i,
    /(?:has|with|employs?)\s*(\d{1,3}(?:,\d{3})*)\s*(?:employees|people)/i,
    /(\d{1,3}(?:,\d{3})*)\+?\s*(?:on linkedin|linkedin employees)/i,
  ];
  for (const pattern of empPatterns) {
    const match = content.match(pattern);
    if (match) {
      result.employee_count = parseInt(match[1].replace(/,/g, ''));
      console.log(`[Text Extract] Found employee count: ${result.employee_count}`);
      break;
    }
  }
  
  // Revenue patterns
  const revPatterns = [
    /\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)\s*(?:revenue|ARR|annual)/i,
    /revenue\s*(?:of|is|:)?\s*\$?(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i,
    /estimated\s*revenue[:\s]+\$?(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i,
  ];
  for (const pattern of revPatterns) {
    const match = content.match(pattern);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier = unit.startsWith('b') ? 1000000000 : 1000000;
      result.revenue_range = mapRevenueToRange(num * multiplier);
      console.log(`[Text Extract] Found revenue: ${result.revenue_range}`);
      break;
    }
  }
  
  // Funding patterns
  const fundMatch = content.match(/(?:raised|funding|round)[:\s]*(seed|pre-seed|series\s*[a-f])/i);
  if (fundMatch) {
    result.funding_round = fundMatch[1].replace(/\s+/g, ' ').trim();
    console.log(`[Text Extract] Found funding: ${result.funding_round}`);
  }
  
  // Domain pattern
  const domainMatch = content.match(/(?:website|domain)[:\s]*(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})/i);
  if (domainMatch) {
    result.domain = domainMatch[1];
  }
  
  // LinkedIn pattern
  const linkedinMatch = content.match(/(https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-z0-9-]+)/i);
  if (linkedinMatch) {
    result.linkedin_url = linkedinMatch[1];
  }
  
  return result;
}

// ============================================
// PHASE 1: COMPANY DISCOVERY
// Find basic info: domain, LinkedIn, headquarters
// ============================================

async function phaseDiscovery(companyName: string, knownDomain?: string): Promise<ResearchResult> {
  console.log('[Phase 1] Company Discovery (open web search)...');
  
  // Use OPEN search - no domain filter to find ANY company
  const prompt = knownDomain
    ? `Find the company "${companyName}" (website: ${knownDomain}).

Return ONLY valid JSON, no markdown or explanation:
{"name":"Official Company Name","domain":"company.com","linkedin_url":"https://linkedin.com/company/...","country":"USA","city":"San Francisco","industry":"Technology","founded_year":2015}`
    : `Find the company "${companyName}".

Return ONLY valid JSON, no markdown or explanation:
{"name":"Official Company Name","domain":"company.com","linkedin_url":"https://linkedin.com/company/...","country":"USA","city":"San Francisco","industry":"Technology","founded_year":2015}`;

  // NO domain filter - let Perplexity search the entire web
  const result = await callPerplexity(
    [{ role: 'user', content: prompt }],
    {
      model: 'sonar-pro',
      searchRecencyFilter: 'year',
      // REMOVED: searchDomainFilter - this was too restrictive
    }
  );

  if (!result) {
    return { data: {}, confidence: 0, citations: [], source: 'none' };
  }

  const parsed = extractJsonFromResponse(result.content);
  if (parsed) {
    return {
      data: {
        name: parsed.name,
        domain: parsed.domain,
        linkedin_url: parsed.linkedin_url,
        country: parsed.country,
        city: parsed.city,
        industry: parsed.industry,
        founded_year: parsed.founded_year,
      },
      confidence: 80,
      citations: result.citations,
      source: 'perplexity-discovery',
    };
  }

  // Fallback: extract from text
  const textData = extractFromText(result.content);
  if (Object.keys(textData).length > 0) {
    return { data: textData, confidence: 50, citations: result.citations, source: 'perplexity-text' };
  }

  return { data: {}, confidence: 0, citations: [], source: 'none' };
}

// ============================================
// PHASE 2: EMPLOYEE COUNT (LinkedIn/Glassdoor Focus)
// ============================================

async function phaseEmployeeCount(companyName: string, domain?: string): Promise<ResearchResult> {
  console.log('[Phase 2] Employee Count Research...');
  
  const prompt = `How many employees does "${companyName}" have?${domain ? ` Website: ${domain}` : ''}

Search LinkedIn company page for employee count.

Return ONLY valid JSON, no markdown:
{"employee_count":150,"source":"LinkedIn shows 150 employees","confidence":85}`;

  // Keep LinkedIn/Glassdoor focus for employee data
  const result = await callPerplexity(
    [{ role: 'user', content: prompt }],
    {
      model: 'sonar-pro',
      searchDomainFilter: ['linkedin.com', 'glassdoor.com'],
      searchRecencyFilter: 'month',
    }
  );

  if (!result) {
    return { data: {}, confidence: 0, citations: [], source: 'none' };
  }

  const parsed = extractJsonFromResponse(result.content);
  if (parsed?.employee_count && typeof parsed.employee_count === 'number') {
    return {
      data: { employee_count: parsed.employee_count },
      confidence: parsed.confidence || 80,
      citations: result.citations,
      source: parsed.source || 'linkedin-glassdoor',
    };
  }

  // Fallback: extract from text
  const textData = extractFromText(result.content);
  if (textData.employee_count) {
    return { data: textData, confidence: 60, citations: result.citations, source: 'perplexity-text' };
  }

  return { data: {}, confidence: 0, citations: [], source: 'none' };
}

// ============================================
// PHASE 3: REVENUE & FUNDING (Financial Focus)
// ============================================

async function phaseFinancials(companyName: string, domain?: string): Promise<ResearchResult> {
  console.log('[Phase 3] Revenue & Funding Research (open search)...');
  
  // Use OPEN search for financials - Crunchbase filter was too restrictive
  const prompt = `What is the revenue and funding for "${companyName}"?${domain ? ` Website: ${domain}` : ''}

Search for:
- Annual revenue or revenue estimate
- Latest funding round (Seed, Series A, B, C, etc.)
- Total funding raised

Return ONLY valid JSON, no markdown:
{"revenue_range":"$10M-$25M","funding_round":"Series B","total_raised":25000000,"confidence":75}

Valid revenue_range values: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"`;

  // NO domain filter - let it search everywhere for financials
  const result = await callPerplexity(
    [{ role: 'user', content: prompt }],
    {
      model: 'sonar-pro',
      searchRecencyFilter: 'year',
      // REMOVED: searchDomainFilter - was blocking results
    }
  );

  if (!result) {
    return { data: {}, confidence: 0, citations: [], source: 'none' };
  }

  const parsed = extractJsonFromResponse(result.content);
  if (parsed) {
    return {
      data: {
        revenue_range: parsed.revenue_range,
        funding_round: parsed.funding_round,
        total_raised: parsed.total_raised,
      },
      confidence: parsed.confidence || 70,
      citations: result.citations,
      source: 'perplexity-financials',
    };
  }

  // Fallback: extract from text
  const textData = extractFromText(result.content);
  if (textData.revenue_range || textData.funding_round) {
    return { data: textData, confidence: 55, citations: result.citations, source: 'perplexity-text' };
  }

  return { data: {}, confidence: 0, citations: [], source: 'none' };
}

// ============================================
// PHASE 4: TECH STACK & CONTACTS
// ============================================

async function phaseTechAndContacts(companyName: string, domain?: string): Promise<ResearchResult> {
  console.log('[Phase 4] Tech Stack & Contacts...');
  
  const prompt = `What technology does "${companyName}" use?${domain ? ` Website: ${domain}` : ''}

Return ONLY valid JSON, no markdown:
{"tech_stack":["AWS","React","Python"],"phone":"+1-555-123-4567","confidence":70}`;

  const result = await callPerplexity(
    [{ role: 'user', content: prompt }],
    {
      model: 'sonar-pro',
      searchDomainFilter: domain ? [domain, 'builtwith.com'] : ['builtwith.com', 'stackshare.io'],
      searchRecencyFilter: 'year',
    }
  );

  if (!result) {
    return { data: {}, confidence: 0, citations: [], source: 'none' };
  }

  const parsed = extractJsonFromResponse(result.content);
  if (parsed) {
    return {
      data: {
        tech_stack: parsed.tech_stack?.slice(0, 15),
        phone: parsed.phone,
      },
      confidence: parsed.confidence || 65,
      citations: result.citations,
      source: 'builtwith-stackshare',
    };
  }

  return { data: {}, confidence: 0, citations: [], source: 'none' };
}

// ============================================
// MERGE RESULTS WITH CONFIDENCE WEIGHTING
// ============================================

function mergeResults(results: ResearchResult[]): EnrichedCompany {
  const merged: Partial<EnrichedCompany> = {};
  const fieldSources: Record<string, string> = {};
  const allCitations: string[] = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const result of results) {
    if (result.confidence > 0) {
      totalConfidence += result.confidence;
      confidenceCount++;
    }

    allCitations.push(...result.citations);

    // Merge each field, preferring higher confidence sources
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== null && value !== undefined) {
        const typedKey = key as keyof EnrichedCompany;
        if (!(typedKey in merged) || result.confidence > 70) {
          (merged as any)[typedKey] = value;
          fieldSources[key] = result.source;
        }
      }
    }
  }

  return {
    name: merged.name || '',
    domain: merged.domain || null,
    employee_count: merged.employee_count || null,
    revenue_range: merged.revenue_range || null,
    industry: merged.industry || null,
    country: merged.country || null,
    city: merged.city || null,
    linkedin_url: merged.linkedin_url || null,
    phone: merged.phone || null,
    founded_year: merged.founded_year || null,
    tech_stack: merged.tech_stack || null,
    funding_round: merged.funding_round || null,
    total_raised: merged.total_raised || null,
    confidence: confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) : 0,
    source: 'launchpulse-ai-multi',
    citations: [...new Set(allCitations)].slice(0, 10),
    field_sources: fieldSources,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

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

    // Extract domain if URL provided
    let searchDomain = query.trim().toLowerCase();
    let searchName = query.trim();
    
    if (searchDomain.includes('.') && !searchDomain.includes(' ')) {
      searchDomain = searchDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      searchName = searchDomain.split('.')[0];
    } else {
      searchDomain = '';
    }

    console.log(`[enrich-single] Multi-Phase Research for: name="${searchName}", domain="${searchDomain}"`);
    
    const providers = getAvailableProviders();
    console.log(`[enrich-single] Available AI providers: ${providers.join(', ')}`);

    // Check if Perplexity is available
    const hasPerplexity = providers.includes('perplexity');
    
    if (!hasPerplexity) {
      console.log('[enrich-single] Perplexity not available, falling back to basic enrichment');
      // Fall back to Apollo/PDL if no Perplexity
      return await fallbackEnrichment(searchName, searchDomain);
    }

    // ============================================
    // MULTI-PHASE AI RESEARCH - ALL IN PARALLEL FOR SPEED
    // ============================================
    
    console.log('[enrich-single] Starting multi-phase AI research (ALL PARALLEL)...');
    const startTime = Date.now();
    
    // Run ALL 4 phases in parallel - don't wait for discovery
    // Each phase uses the original company name/domain
    const [discoveryResult, employeeResult, financialResult, techResult] = await Promise.all([
      phaseDiscovery(searchName, searchDomain || undefined),
      phaseEmployeeCount(searchName, searchDomain || undefined),
      phaseFinancials(searchName, searchDomain || undefined),
      phaseTechAndContacts(searchName, searchDomain || undefined),
    ]);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[enrich-single] All 4 phases completed in ${duration}s`);
    
    // Merge all results
    const merged = mergeResults([discoveryResult, employeeResult, financialResult, techResult]);
    merged.name = discoveryResult.data.name || searchName;
    
    console.log(`[enrich-single] Final: ${merged.name}, employees=${merged.employee_count}, revenue=${merged.revenue_range}, confidence=${merged.confidence}%`);
    console.log(`[enrich-single] Sources:`, merged.field_sources);
    
    // If confidence is very low, try Apollo/PDL fallback
    if (merged.confidence < 40) {
      console.log('[enrich-single] Low confidence, trying third-party fallback...');
      const fallbackResult = await fallbackEnrichment(confirmedName, confirmedDomain || '');
      if (fallbackResult.status === 200) {
        return fallbackResult;
      }
    }

    if (!merged.name || merged.confidence === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not find information for this company. Try using the company domain.',
          providers_tried: providers
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ company: merged }),
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

// ============================================
// FALLBACK: Apollo/PDL for verified data
// ============================================

async function fallbackEnrichment(searchName: string, searchDomain: string): Promise<Response> {
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  const PDL_API_KEY = Deno.env.get('PDL_API_KEY');

  if (!APOLLO_API_KEY && !PDL_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'No fallback providers configured' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const enrichPromises: Promise<EnrichedCompany | null>[] = [];

  // Try Apollo
  if (APOLLO_API_KEY) {
    enrichPromises.push(
      (async () => {
        try {
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
          console.error('[fallback] Apollo error:', e);
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
          console.error('[fallback] PDL error:', e);
        }
        return null;
      })()
    );
  }

  const results = await Promise.allSettled(enrichPromises);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      return new Response(
        JSON.stringify({ company: r.value }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'No data found from fallback providers' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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

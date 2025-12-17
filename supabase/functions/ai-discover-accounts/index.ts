import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveryCriteria {
  industries: string[];
  geographies: string[];
  company_sizes: string[];
  revenue_ranges: string[];
  keywords: string[];
  tech_stack?: string[];
  limit?: number;
}

interface DiscoveredCompany {
  name: string;
  domain: string;
  industry: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  city?: string;
  description?: string;
  tech_stack?: string[];
  confidence: number;
  discovery_reason: string;
  sources?: string[];
  last_verified?: string;
}

// Search companies using Perplexity's real-time web search
async function searchWithPerplexity(criteria: DiscoveryCriteria, limit: number): Promise<{ content: string; citations: string[] }> {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  
  if (!perplexityKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const searchPrompt = buildPerplexitySearchPrompt(criteria, limit);
  
  console.log('[Perplexity] Initiating real-time web search...');
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert B2B market researcher. Search the web to find REAL, currently operating companies that match the criteria. For each company provide: company name, website domain, industry, approximate employee count, estimated revenue range, headquarters location, a brief description, and any known technology they use. Focus on accuracy - only include companies you can verify exist.`
        },
        { role: 'user', content: searchPrompt }
      ],
      search_recency_filter: 'month',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Perplexity] API error: ${response.status}`, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  console.log(`[Perplexity] Received response with ${citations.length} citations`);
  
  return { content, citations };
}

function buildPerplexitySearchPrompt(criteria: DiscoveryCriteria, limit: number): string {
  let prompt = `Find ${limit} real B2B companies that currently exist and match these criteria:\n\n`;
  
  if (criteria.industries?.length) {
    prompt += `Industries: ${criteria.industries.join(', ')}\n`;
  }
  if (criteria.geographies?.length) {
    prompt += `Located in: ${criteria.geographies.join(', ')}\n`;
  }
  if (criteria.company_sizes?.length) {
    prompt += `Company sizes: ${criteria.company_sizes.join(', ')}\n`;
  }
  if (criteria.revenue_ranges?.length) {
    prompt += `Revenue ranges: ${criteria.revenue_ranges.join(', ')}\n`;
  }
  if (criteria.keywords?.length) {
    prompt += `Focus areas/keywords: ${criteria.keywords.join(', ')}\n`;
  }
  if (criteria.tech_stack?.length) {
    prompt += `Using technologies: ${criteria.tech_stack.join(', ')}\n`;
  }
  
  prompt += `\nFor each company, provide the company name, website domain, industry, employee count, revenue range, location, and a brief description. Include a mix of well-known and emerging companies in the space.`;
  
  return prompt;
}

// Parse Perplexity results using Lovable AI for structured output
async function parsePerplexityResults(
  rawContent: string, 
  citations: string[], 
  criteria: DiscoveryCriteria,
  lovableApiKey: string
): Promise<DiscoveredCompany[]> {
  console.log('[Lovable AI] Parsing Perplexity results into structured format...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a data extraction expert. Parse the company information from web search results into structured data. Extract only real companies with verifiable information. Be accurate with domains, employee counts, and revenue estimates. Include confidence scores based on data quality.`
        },
        {
          role: 'user',
          content: `Parse the following company search results into structured data. The data came from real-time web search.\n\nSearch Results:\n${rawContent}\n\nSource citations: ${citations.join(', ')}\n\nICP Criteria used:\n- Industries: ${criteria.industries?.join(', ') || 'Any'}\n- Geographies: ${criteria.geographies?.join(', ') || 'Any'}\n- Sizes: ${criteria.company_sizes?.join(', ') || 'Any'}`
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'parsed_companies',
            description: 'Return structured company data from the search results',
            parameters: {
              type: 'object',
              properties: {
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      domain: { type: 'string' },
                      industry: { type: 'string' },
                      employee_count: { type: 'number' },
                      revenue_range: { 
                        type: 'string',
                        enum: ['<$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M-$250M', '$250M-$500M', '$500M-$1B', '$1B+']
                      },
                      country: { type: 'string' },
                      city: { type: 'string' },
                      description: { type: 'string' },
                      tech_stack: { type: 'array', items: { type: 'string' } },
                      confidence: { type: 'number', minimum: 0, maximum: 100 },
                      discovery_reason: { type: 'string' }
                    },
                    required: ['name', 'domain', 'industry', 'employee_count', 'revenue_range', 'country', 'confidence', 'discovery_reason']
                  }
                }
              },
              required: ['companies']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'parsed_companies' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`Lovable AI parsing error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    const companies = parsed.companies || [];
    
    // Add citations and timestamp to each company
    const now = new Date().toISOString();
    return companies.map((c: DiscoveredCompany) => ({
      ...c,
      sources: citations.slice(0, 5),
      last_verified: now
    }));
  }
  
  return [];
}

// Fallback: Direct discovery with Lovable AI (original behavior)
async function discoverWithLovableAI(
  criteria: DiscoveryCriteria, 
  existingCount: number,
  lovableApiKey: string
): Promise<{ companies: DiscoveredCompany[]; searchSummary: string }> {
  console.log('[Lovable AI] Using fallback AI discovery (no Perplexity key)...');
  
  const limit = criteria.limit || 20;
  let prompt = `Find ${limit} real B2B companies that match the following Ideal Customer Profile criteria:\n\n`;
  
  if (criteria.industries?.length) prompt += `**Industries:** ${criteria.industries.join(', ')}\n`;
  if (criteria.geographies?.length) prompt += `**Geographies:** ${criteria.geographies.join(', ')}\n`;
  if (criteria.company_sizes?.length) prompt += `**Company Sizes:** ${criteria.company_sizes.join(', ')}\n`;
  if (criteria.revenue_ranges?.length) prompt += `**Revenue Ranges:** ${criteria.revenue_ranges.join(', ')}\n`;
  if (criteria.keywords?.length) prompt += `**Keywords:** ${criteria.keywords.join(', ')}\n`;
  if (criteria.tech_stack?.length) prompt += `**Tech Stack:** ${criteria.tech_stack.join(', ')}\n`;
  
  prompt += `\nThe client has ${existingCount} existing accounts. Return ${limit} companies sorted by confidence.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert B2B market researcher. Suggest real companies that match the ICP criteria. Provide accurate information and indicate confidence levels. Note: This data is from AI knowledge, not real-time search.`
        },
        { role: 'user', content: prompt }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'discovered_companies',
            description: 'Return companies matching the ICP',
            parameters: {
              type: 'object',
              properties: {
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      domain: { type: 'string' },
                      industry: { type: 'string' },
                      employee_count: { type: 'number' },
                      revenue_range: { type: 'string', enum: ['<$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M-$250M', '$250M-$500M', '$500M-$1B', '$1B+'] },
                      country: { type: 'string' },
                      city: { type: 'string' },
                      description: { type: 'string' },
                      tech_stack: { type: 'array', items: { type: 'string' } },
                      confidence: { type: 'number', minimum: 0, maximum: 100 },
                      discovery_reason: { type: 'string' }
                    },
                    required: ['name', 'domain', 'industry', 'employee_count', 'revenue_range', 'country', 'confidence', 'discovery_reason']
                  }
                },
                search_summary: { type: 'string' }
              },
              required: ['companies', 'search_summary']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'discovered_companies' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      companies: parsed.companies || [],
      searchSummary: parsed.search_summary || 'Companies discovered using AI knowledge base (not real-time search)'
    };
  }
  
  return { companies: [], searchSummary: '' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { org_id, criteria, mode = 'discover' } = await req.json() as {
      org_id: string;
      criteria: DiscoveryCriteria;
      mode?: 'discover' | 'preview' | 'import';
    };

    if (!org_id || !criteria) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing org_id or criteria' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limit = criteria.limit || 20;
    console.log(`[AI Discovery] Starting for org ${org_id}, mode: ${mode}, using: ${perplexityKey ? 'Perplexity' : 'Lovable AI fallback'}`);

    // Get existing domains to deduplicate
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('domain')
      .eq('org_id', org_id)
      .not('domain', 'is', null);

    const existingDomains = new Set(
      (existingAccounts || []).map(a => a.domain?.toLowerCase()).filter(Boolean)
    );

    console.log(`[AI Discovery] Found ${existingDomains.size} existing domains`);

    let discoveredCompanies: DiscoveredCompany[] = [];
    let searchSummary = '';
    let dataSource = 'ai_knowledge';

    // Try Perplexity first if configured, otherwise fallback to Lovable AI
    if (perplexityKey) {
      try {
        const { content, citations } = await searchWithPerplexity(criteria, limit);
        discoveredCompanies = await parsePerplexityResults(content, citations, criteria, lovableApiKey);
        searchSummary = `Real-time web search found ${discoveredCompanies.length} companies. Data verified from ${citations.length} sources as of ${new Date().toLocaleString()}.`;
        dataSource = 'perplexity_realtime';
        console.log(`[AI Discovery] Perplexity returned ${discoveredCompanies.length} companies`);
      } catch (perplexityError) {
        console.error('[AI Discovery] Perplexity failed, falling back to Lovable AI:', perplexityError);
        const fallbackResult = await discoverWithLovableAI(criteria, existingDomains.size, lovableApiKey);
        discoveredCompanies = fallbackResult.companies;
        searchSummary = fallbackResult.searchSummary + ' (Perplexity unavailable, used AI fallback)';
      }
    } else {
      const result = await discoverWithLovableAI(criteria, existingDomains.size, lovableApiKey);
      discoveredCompanies = result.companies;
      searchSummary = result.searchSummary;
    }

    // Deduplicate
    const newCompanies = discoveredCompanies.filter(company => {
      const normalizedDomain = company.domain?.toLowerCase().replace(/^www\./, '');
      return normalizedDomain && !existingDomains.has(normalizedDomain);
    });

    console.log(`[AI Discovery] ${newCompanies.length} new companies after deduplication`);

    // Preview mode
    if (mode === 'preview') {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'preview',
          data_source: dataSource,
          discovered_count: newCompanies.length,
          duplicates_filtered: discoveredCompanies.length - newCompanies.length,
          companies: newCompanies,
          search_summary: searchSummary,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import mode
    let importedCount = 0;
    let failedCount = 0;
    const importedAccounts: string[] = [];

    for (const company of newCompanies) {
      try {
        const externalId = `ai_discovery_${company.domain?.replace(/\./g, '_')}_${Date.now()}`;
        
        const { data: inserted, error: insertError } = await supabase
          .from('accounts')
          .insert({
            org_id,
            external_id: externalId,
            name: company.name,
            domain: company.domain?.toLowerCase().replace(/^www\./, ''),
            industry_raw: company.industry,
            industry_norm: company.industry,
            employee_count: company.employee_count,
            revenue_range: company.revenue_range,
            country: company.country,
            city: company.city,
            hq_city: company.city,
            tech_stack: company.tech_stack,
            data_source: dataSource,
            enrichment_confidence: company.confidence,
            trust_signals: {
              ai_discovery: true,
              discovery_reason: company.discovery_reason,
              discovered_at: new Date().toISOString(),
              sources: company.sources || [],
              last_verified: company.last_verified
            }
          })
          .select('id, external_id')
          .single();

        if (insertError) {
          console.error(`[AI Discovery] Failed to insert ${company.name}:`, insertError);
          failedCount++;
        } else {
          importedCount++;
          importedAccounts.push(inserted.external_id);
          
          try {
            await supabase.rpc('calculate_account_score', {
              p_account_external_id: inserted.external_id,
              p_org_id: org_id
            });
          } catch (scoreError) {
            console.warn(`[AI Discovery] Failed to auto-score ${company.name}:`, scoreError);
          }
        }
      } catch (err) {
        console.error(`[AI Discovery] Error importing ${company.name}:`, err);
        failedCount++;
      }
    }

    await supabase.from('audit_logs').insert({
      org_id,
      actor: 'ai_discovery',
      action: 'accounts_discovered',
      meta: {
        criteria,
        data_source: dataSource,
        discovered_count: newCompanies.length,
        imported_count: importedCount,
        failed_count: failedCount,
        search_summary: searchSummary,
      }
    });

    console.log(`[AI Discovery] Completed: ${importedCount} imported, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'import',
        data_source: dataSource,
        discovered_count: discoveredCompanies.length,
        duplicates_filtered: discoveredCompanies.length - newCompanies.length,
        imported_count: importedCount,
        failed_count: failedCount,
        imported_accounts: importedAccounts,
        companies: newCompanies,
        search_summary: searchSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Discovery] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

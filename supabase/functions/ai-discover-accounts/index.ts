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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
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

    console.log(`[AI Discovery] Starting discovery for org ${org_id}, mode: ${mode}`);
    console.log(`[AI Discovery] Criteria:`, JSON.stringify(criteria));

    // Get existing domains to deduplicate
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('domain')
      .eq('org_id', org_id)
      .not('domain', 'is', null);

    const existingDomains = new Set(
      (existingAccounts || []).map(a => a.domain?.toLowerCase()).filter(Boolean)
    );

    console.log(`[AI Discovery] Found ${existingDomains.size} existing domains to exclude`);

    // Build the AI prompt for company discovery
    const discoveryPrompt = buildDiscoveryPrompt(criteria, existingDomains.size);

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are an expert B2B market researcher and sales intelligence analyst. Your job is to identify real companies that match specific Ideal Customer Profile (ICP) criteria. 

CRITICAL RULES:
1. Only suggest REAL companies that actually exist
2. Provide accurate information - if unsure, indicate lower confidence
3. Focus on companies that are likely to be in-market for B2B solutions
4. Include a mix of well-known and emerging companies
5. Provide realistic employee counts and revenue estimates
6. Always include the company's primary domain

For each company, assess:
- Industry alignment with criteria
- Size/revenue fit
- Geographic match
- Technology relevance (if applicable)
- Likelihood to be a good B2B prospect`
          },
          {
            role: 'user',
            content: discoveryPrompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'discovered_companies',
              description: 'Return a list of companies matching the ICP criteria',
              parameters: {
                type: 'object',
                properties: {
                  companies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Company legal name' },
                        domain: { type: 'string', description: 'Primary website domain (e.g., company.com)' },
                        industry: { type: 'string', description: 'Primary industry' },
                        employee_count: { type: 'number', description: 'Estimated employee count' },
                        revenue_range: { 
                          type: 'string', 
                          enum: ['<$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M-$250M', '$250M-$500M', '$500M-$1B', '$1B+'],
                          description: 'Estimated annual revenue range' 
                        },
                        country: { type: 'string', description: 'Headquarters country' },
                        city: { type: 'string', description: 'Headquarters city' },
                        description: { type: 'string', description: 'Brief company description (1-2 sentences)' },
                        tech_stack: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Known technologies used'
                        },
                        confidence: { 
                          type: 'number', 
                          minimum: 0, 
                          maximum: 100,
                          description: 'Confidence score (0-100) that this company matches the ICP'
                        },
                        discovery_reason: { type: 'string', description: 'Why this company was selected (brief)' }
                      },
                      required: ['name', 'domain', 'industry', 'employee_count', 'revenue_range', 'country', 'confidence', 'discovery_reason']
                    }
                  },
                  search_summary: {
                    type: 'string',
                    description: 'Brief summary of the discovery process and results'
                  }
                },
                required: ['companies', 'search_summary']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'discovered_companies' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[AI Discovery] AI API error: ${aiResponse.status}`, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log(`[AI Discovery] AI response received`);

    // Extract tool call result
    let discoveredCompanies: DiscoveredCompany[] = [];
    let searchSummary = '';

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        discoveredCompanies = parsed.companies || [];
        searchSummary = parsed.search_summary || '';
      } catch (e) {
        console.error('[AI Discovery] Failed to parse tool call arguments:', e);
      }
    }

    console.log(`[AI Discovery] Discovered ${discoveredCompanies.length} companies`);

    // Deduplicate against existing accounts
    const newCompanies = discoveredCompanies.filter(company => {
      const normalizedDomain = company.domain?.toLowerCase().replace(/^www\./, '');
      return normalizedDomain && !existingDomains.has(normalizedDomain);
    });

    console.log(`[AI Discovery] ${newCompanies.length} new companies after deduplication`);

    // If preview mode, just return the discovered companies
    if (mode === 'preview') {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'preview',
          discovered_count: newCompanies.length,
          duplicates_filtered: discoveredCompanies.length - newCompanies.length,
          companies: newCompanies,
          search_summary: searchSummary,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import mode: Add companies to accounts table
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
            data_source: 'ai_discovery',
            enrichment_confidence: company.confidence,
            trust_signals: {
              ai_discovery: true,
              discovery_reason: company.discovery_reason,
              discovered_at: new Date().toISOString(),
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
          
          // Auto-score the account
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

    // Log the discovery action
    await supabase.from('audit_logs').insert({
      org_id,
      actor: 'ai_discovery',
      action: 'accounts_discovered',
      meta: {
        criteria,
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

function buildDiscoveryPrompt(criteria: DiscoveryCriteria, existingCount: number): string {
  const limit = criteria.limit || 20;
  
  let prompt = `Find ${limit} real B2B companies that match the following Ideal Customer Profile criteria:\n\n`;
  
  if (criteria.industries?.length) {
    prompt += `**Industries:** ${criteria.industries.join(', ')}\n`;
  }
  
  if (criteria.geographies?.length) {
    prompt += `**Geographies:** ${criteria.geographies.join(', ')}\n`;
  }
  
  if (criteria.company_sizes?.length) {
    prompt += `**Company Sizes (employee count):** ${criteria.company_sizes.join(', ')}\n`;
  }
  
  if (criteria.revenue_ranges?.length) {
    prompt += `**Revenue Ranges:** ${criteria.revenue_ranges.join(', ')}\n`;
  }
  
  if (criteria.keywords?.length) {
    prompt += `**Keywords/Focus Areas:** ${criteria.keywords.join(', ')}\n`;
  }
  
  if (criteria.tech_stack?.length) {
    prompt += `**Technology Stack:** ${criteria.tech_stack.join(', ')}\n`;
  }
  
  prompt += `\n**Important Notes:**
- The client already has ${existingCount} accounts in their database
- Focus on finding companies they might NOT already have
- Include a mix of well-known and emerging companies
- Prioritize companies showing growth signals or recent activity
- Each company should have a valid, working domain
- Provide accurate employee counts and revenue estimates
- Include confidence scores based on how well each company matches the criteria

Return ${limit} companies sorted by confidence score (highest first).`;

  return prompt;
}

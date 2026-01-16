// Internal-First Enrichment - Check existing data before calling external APIs
// Reduces API costs by leveraging already-enriched accounts and leads

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentInput {
  email?: string;
  domain?: string;
  company_name?: string;
  source_type?: string;
}

interface EnrichmentResult {
  input: EnrichmentInput;
  matched_account?: any;
  matched_lead?: any;
  enriched_data: Record<string, any>;
  source: 'internal' | 'apollo' | 'pdl' | 'clearbit' | 'ai';
  confidence: number;
  fields_filled: string[];
  api_calls_saved: boolean;
}

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// Normalize domain for matching
const normalizeDomain = (domain: string): string => {
  return domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
};

// Calculate data completeness for an account
const calculateCompleteness = (account: any): number => {
  const keyFields = ['employee_count', 'revenue_range', 'industry_norm', 'country', 'linkedin_url'];
  const filled = keyFields.filter(f => account[f] != null).length;
  return (filled / keyFields.length) * 100;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { inputs, org_id, source_type, force_external = false, skip_ai = false } = await req.json();

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return new Response(JSON.stringify({ error: 'inputs array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-internal-first] Processing ${inputs.length} inputs for org ${org_id}`);

    const results: EnrichmentResult[] = [];
    const stats = {
      total: inputs.length,
      internal_matches: 0,
      apollo_enriched: 0,
      pdl_enriched: 0,
      ai_enriched: 0,
      failed: 0,
      api_calls_saved: 0
    };

    // Phase 1: Internal Lookup
    console.log('[enrich-internal-first] Phase 1: Internal lookup');
    
    // Collect all domains for batch lookup
    const domainsToLookup = new Set<string>();
    const emailsToLookup = new Set<string>();
    const companyNamesToLookup = new Set<string>();

    for (const input of inputs as EnrichmentInput[]) {
      if (input.email) {
        emailsToLookup.add(input.email.toLowerCase());
        const domain = extractDomain(input.email);
        if (domain) domainsToLookup.add(domain);
      }
      if (input.domain) {
        domainsToLookup.add(normalizeDomain(input.domain));
      }
      if (input.company_name) {
        companyNamesToLookup.add(input.company_name.toLowerCase());
      }
    }

    // Batch fetch existing accounts by domain
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id)
      .or(
        Array.from(domainsToLookup).map(d => `domain.ilike.%${d}%`).join(',') ||
        'domain.is.null'
      );

    // Batch fetch existing leads by email
    const { data: existingLeads } = await supabase
      .from('Leads')
      .select('*')
      .eq('org_id', org_id)
      .or(
        Array.from(emailsToLookup).map(e => `email.ilike.${e}`).join(',') ||
        'email.is.null'
      );

    // Create lookup maps for O(1) access
    const accountByDomain = new Map<string, any>();
    const accountByName = new Map<string, any>();
    const leadByEmail = new Map<string, any>();

    for (const account of existingAccounts || []) {
      if (account.domain) {
        accountByDomain.set(normalizeDomain(account.domain), account);
      }
      if (account.name) {
        accountByName.set(account.name.toLowerCase(), account);
      }
    }

    for (const lead of existingLeads || []) {
      if (lead.email) {
        leadByEmail.set(lead.email.toLowerCase(), lead);
      }
    }

    // Process each input
    const needsExternalEnrichment: EnrichmentInput[] = [];

    for (const input of inputs as EnrichmentInput[]) {
      const result: EnrichmentResult = {
        input,
        enriched_data: {},
        source: 'internal',
        confidence: 0,
        fields_filled: [],
        api_calls_saved: false
      };

      // Try to find matching account
      let matchedAccount: any = null;
      
      if (input.domain) {
        matchedAccount = accountByDomain.get(normalizeDomain(input.domain));
      }
      if (!matchedAccount && input.email) {
        const domain = extractDomain(input.email);
        if (domain) matchedAccount = accountByDomain.get(domain);
      }
      if (!matchedAccount && input.company_name) {
        matchedAccount = accountByName.get(input.company_name.toLowerCase());
      }

      // Try to find matching lead
      let matchedLead: any = null;
      if (input.email) {
        matchedLead = leadByEmail.get(input.email.toLowerCase());
      }

      if (matchedAccount) {
        result.matched_account = matchedAccount;
        const completeness = calculateCompleteness(matchedAccount);
        
        // If account is well-enriched, use internal data
        if (completeness >= 60 && !force_external) {
          result.enriched_data = {
            employee_count: matchedAccount.employee_count,
            revenue_range: matchedAccount.revenue_range,
            industry_norm: matchedAccount.industry_norm,
            country: matchedAccount.country,
            linkedin_url: matchedAccount.linkedin_url,
            domain: matchedAccount.domain,
            name: matchedAccount.name
          };
          result.source = 'internal';
          result.confidence = matchedAccount.enrichment_confidence || 0.8;
          result.fields_filled = Object.keys(result.enriched_data).filter(k => result.enriched_data[k] != null);
          result.api_calls_saved = true;
          stats.internal_matches++;
          stats.api_calls_saved++;
          results.push(result);
          continue;
        }
      }

      if (matchedLead) {
        result.matched_lead = matchedLead;
      }

      // Need external enrichment
      needsExternalEnrichment.push({
        ...input,
        source_type: input.source_type || source_type
      });
      results.push(result);
    }

    console.log(`[enrich-internal-first] Internal matches: ${stats.internal_matches}, need external: ${needsExternalEnrichment.length}`);

    // Phase 2: External Enrichment (Apollo, PDL, AI)
    if (needsExternalEnrichment.length > 0 && !force_external) {
      const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
      const PDL_API_KEY = Deno.env.get('PDL_API_KEY');

      // Apollo enrichment
      if (APOLLO_API_KEY) {
        console.log('[enrich-internal-first] Phase 2a: Apollo enrichment');
        
        for (const input of needsExternalEnrichment) {
          const resultIndex = results.findIndex(r => 
            r.input.email === input.email || 
            r.input.domain === input.domain ||
            r.input.company_name === input.company_name
          );
          
          if (resultIndex === -1 || results[resultIndex].fields_filled.length > 0) continue;

          const domain = input.domain || (input.email ? extractDomain(input.email) : null);
          if (!domain) continue;

          try {
            const response = await withHttpRetry(
              () => fetch('https://api.apollo.io/v1/organizations/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: APOLLO_API_KEY, domain })
              }),
              { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
            );

            if (response.ok) {
              const data = await response.json();
              const org = data.organization;
              
              if (org) {
                results[resultIndex].enriched_data = {
                  employee_count: org.estimated_num_employees,
                  revenue_range: mapRevenueToRange(org.estimated_annual_revenue),
                  industry_norm: org.industry,
                  country: org.country,
                  linkedin_url: org.linkedin_url,
                  domain: org.primary_domain || domain,
                  name: org.name
                };
                results[resultIndex].source = 'apollo';
                results[resultIndex].confidence = 0.95;
                results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                  .filter(k => results[resultIndex].enriched_data[k] != null);
                stats.apollo_enriched++;
              }
            }
          } catch (e) {
            console.error(`[enrich-internal-first] Apollo error:`, e);
          }
        }
      }

      // PDL enrichment for remaining
      if (PDL_API_KEY) {
        console.log('[enrich-internal-first] Phase 2b: PDL enrichment');
        
        for (const input of needsExternalEnrichment) {
          const resultIndex = results.findIndex(r => 
            r.input.email === input.email || 
            r.input.domain === input.domain
          );
          
          if (resultIndex === -1 || results[resultIndex].fields_filled.length > 0) continue;

          const domain = input.domain || (input.email ? extractDomain(input.email) : null);
          if (!domain) continue;

          try {
            const response = await withHttpRetry(
              () => fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
                method: 'GET',
                headers: { 'X-Api-Key': PDL_API_KEY }
              }),
              { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
            );

            if (response.ok) {
              const data = await response.json();
              
              if (data.name) {
                results[resultIndex].enriched_data = {
                  employee_count: data.size,
                  revenue_range: mapRevenueToRange(data.estimated_annual_revenue),
                  industry_norm: data.industry,
                  country: data.location?.country,
                  linkedin_url: data.linkedin_url,
                  domain: data.website || domain,
                  name: data.name
                };
                results[resultIndex].source = 'pdl';
                results[resultIndex].confidence = 0.85;
                results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                  .filter(k => results[resultIndex].enriched_data[k] != null);
                stats.pdl_enriched++;
              }
            }
          } catch (e) {
            console.error(`[enrich-internal-first] PDL error:`, e);
          }
        }
      }

      // AI enrichment for remaining
      const providers = getAvailableProviders();
      if (!skip_ai && providers.length > 0) {
        const stillNeedsEnrichment = results.filter(r => r.fields_filled.length === 0);
        
        if (stillNeedsEnrichment.length > 0) {
          console.log(`[enrich-internal-first] Phase 2c: AI enrichment (${stillNeedsEnrichment.length} remaining)`);
          
          const batchSize = 20;
          for (let i = 0; i < stillNeedsEnrichment.length; i += batchSize) {
            const batch = stillNeedsEnrichment.slice(i, i + batchSize);
            
            const prompt = `Estimate firmographic data for these companies. Return ONLY valid JSON array.
Format: [{"identifier": "email or domain", "employee_count": number, "revenue_range": "range", "industry": "industry", "confidence": 0-100}]

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Companies:
${batch.map(r => `- ${r.input.email || r.input.domain || r.input.company_name}`).join('\n')}`;

            try {
              const aiResponse = await callAI('enrichment', [
                { role: 'system', content: 'You are a B2B data analyst. Provide realistic firmographic estimates. Output only valid JSON.' },
                { role: 'user', content: prompt }
              ]);

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const content = aiData.choices?.[0]?.message?.content || '';
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                
                if (jsonMatch) {
                  const estimates = JSON.parse(jsonMatch[0]);
                  
                  for (const est of estimates) {
                    if (est.confidence < 50) continue;
                    
                    const resultIndex = results.findIndex(r => 
                      r.input.email === est.identifier ||
                      r.input.domain === est.identifier ||
                      extractDomain(r.input.email || '') === est.identifier
                    );
                    
                    if (resultIndex !== -1 && results[resultIndex].fields_filled.length === 0) {
                      results[resultIndex].enriched_data = {
                        employee_count: est.employee_count,
                        revenue_range: est.revenue_range,
                        industry_norm: est.industry
                      };
                      results[resultIndex].source = 'ai';
                      results[resultIndex].confidence = est.confidence / 100;
                      results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                        .filter(k => results[resultIndex].enriched_data[k] != null);
                      stats.ai_enriched++;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[enrich-internal-first] AI error:', e);
            }
          }
        }
      }
    }

    // Count failures
    stats.failed = results.filter(r => r.fields_filled.length === 0).length;

    console.log(`[enrich-internal-first] Complete:`, stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-internal-first] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper: Map revenue to range
const mapRevenueToRange = (revenue: number | null | undefined): string | null => {
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
};

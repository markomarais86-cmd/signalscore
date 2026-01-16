// Domain Discovery - Find website domains for company names
// Uses internal lookup, AI search, and external APIs as fallbacks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DomainDiscoveryResult {
  company_name: string;
  domain: string | null;
  source: 'internal' | 'ai' | 'clearbit' | 'not_found';
  confidence: number;
  alternatives?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { company_names, org_id } = await req.json();

    if (!company_names || !Array.isArray(company_names) || company_names.length === 0) {
      return new Response(JSON.stringify({ error: 'company_names array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[discover-domain] Processing ${company_names.length} company names`);

    const results: DomainDiscoveryResult[] = [];
    const needsAILookup: string[] = [];

    // Phase 1: Internal lookup - check existing accounts
    if (org_id) {
      const { data: existingAccounts } = await supabase
        .from('accounts')
        .select('name, domain')
        .eq('org_id', org_id)
        .not('domain', 'is', null);

      // Create fuzzy matching index
      const accountsByName = new Map<string, string>();
      for (const account of existingAccounts || []) {
        if (account.name && account.domain) {
          // Normalize name for matching
          const normalized = account.name.toLowerCase().trim()
            .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
            .trim();
          accountsByName.set(normalized, account.domain);
        }
      }

      for (const companyName of company_names) {
        const normalized = companyName.toLowerCase().trim()
          .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
          .trim();
        
        // Exact match
        if (accountsByName.has(normalized)) {
          results.push({
            company_name: companyName,
            domain: accountsByName.get(normalized)!,
            source: 'internal',
            confidence: 0.95
          });
          continue;
        }

        // Fuzzy match - check if any existing account contains or is contained by the search term
        let foundMatch = false;
        for (const [existingName, domain] of accountsByName.entries()) {
          if (existingName.includes(normalized) || normalized.includes(existingName)) {
            results.push({
              company_name: companyName,
              domain: domain,
              source: 'internal',
              confidence: 0.75
            });
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          needsAILookup.push(companyName);
          results.push({
            company_name: companyName,
            domain: null,
            source: 'not_found',
            confidence: 0
          });
        }
      }
    } else {
      // No org_id - all need AI lookup
      for (const companyName of company_names) {
        needsAILookup.push(companyName);
        results.push({
          company_name: companyName,
          domain: null,
          source: 'not_found',
          confidence: 0
        });
      }
    }

    console.log(`[discover-domain] Internal matches: ${results.filter(r => r.source === 'internal').length}, need AI: ${needsAILookup.length}`);

    // Phase 2: AI-powered domain discovery
    if (needsAILookup.length > 0) {
      const providers = getAvailableProviders();
      
      if (providers.length > 0) {
        // Process in batches of 10
        const batchSize = 10;
        for (let i = 0; i < needsAILookup.length; i += batchSize) {
          const batch = needsAILookup.slice(i, i + batchSize);
          
          const prompt = `Find the official website domains for these companies. Return ONLY valid JSON array.
Format: [{"company": "company name", "domain": "domain.com", "confidence": 0-100}]

If you're not sure about a company's domain, set confidence below 50 or use null for domain.

Companies:
${batch.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}`;

          try {
            const aiResponse = await callAI('research', [
              { role: 'system', content: 'You are a business researcher. Find official company website domains. Be accurate - only return domains you are confident about. Output only valid JSON array.' },
              { role: 'user', content: prompt }
            ]);

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || '';
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              
              if (jsonMatch) {
                const discoveries = JSON.parse(jsonMatch[0]);
                
                for (const discovery of discoveries) {
                  if (!discovery.domain || discovery.confidence < 50) continue;
                  
                  // Find matching result and update
                  const resultIndex = results.findIndex(r => 
                    r.company_name.toLowerCase() === discovery.company?.toLowerCase() ||
                    r.company_name.toLowerCase().includes(discovery.company?.toLowerCase()) ||
                    discovery.company?.toLowerCase().includes(r.company_name.toLowerCase())
                  );
                  
                  if (resultIndex !== -1 && results[resultIndex].source === 'not_found') {
                    // Clean the domain
                    const cleanDomain = discovery.domain
                      .toLowerCase()
                      .replace(/^(https?:\/\/)?(www\.)?/, '')
                      .split('/')[0];
                    
                    results[resultIndex].domain = cleanDomain;
                    results[resultIndex].source = 'ai';
                    results[resultIndex].confidence = discovery.confidence / 100;
                  }
                }
              }
            }
          } catch (e) {
            console.error('[discover-domain] AI error:', e);
          }
        }
      }
    }

    // Phase 3: Clearbit fallback (if API key available)
    const CLEARBIT_API_KEY = Deno.env.get('CLEARBIT_API_KEY');
    if (CLEARBIT_API_KEY) {
      const stillNotFound = results.filter(r => r.source === 'not_found');
      
      for (const result of stillNotFound) {
        try {
          const response = await fetch(
            `https://company.clearbit.com/v1/domains/find?name=${encodeURIComponent(result.company_name)}`,
            {
              headers: {
                'Authorization': `Bearer ${CLEARBIT_API_KEY}`
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.domain) {
              const resultIndex = results.findIndex(r => r.company_name === result.company_name);
              if (resultIndex !== -1) {
                results[resultIndex].domain = data.domain;
                results[resultIndex].source = 'clearbit';
                results[resultIndex].confidence = 0.9;
              }
            }
          }
        } catch (e) {
          console.error('[discover-domain] Clearbit error:', e);
        }
      }
    }

    const stats = {
      total: company_names.length,
      internal_found: results.filter(r => r.source === 'internal').length,
      ai_found: results.filter(r => r.source === 'ai').length,
      clearbit_found: results.filter(r => r.source === 'clearbit').length,
      not_found: results.filter(r => r.source === 'not_found').length
    };

    console.log(`[discover-domain] Complete:`, stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[discover-domain] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

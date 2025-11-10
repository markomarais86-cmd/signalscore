import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEARCH_PROMPT = `You are a lead enrichment analyst. You will research a company using reputable sources and return STRICT JSON matching the schema below.

INPUT:
- company: "<company name>"
- domain: "<company domain>"

RESEARCH RULES:
1) PRIORITIZE PRECISION. If there's ambiguity, return multiple candidates with low confidence.
2) SOURCES: Prefer company website, Crunchbase, LinkedIn, SEC filings, press releases, reputable news.
3) COMPANY DATA: Include legal name, website, HQ, employee range, NAICS/industry, funding, products, tech stack, trust/compliance signals.
4) CITE: Include citations with URLs.
5) CONFIDENCE: Provide 0-1 float per candidate.

OUTPUT JSON SCHEMA:
{
  "candidates": [
    {
      "company": {
        "legal_name": string|null,
        "domain": string|null,
        "linkedin_url": string|null,
        "hq": { "city": string|null, "region": string|null, "country": string|null },
        "industry": string|null,
        "naics": string|null,
        "employee_count": { "min": number|null, "max": number|null },
        "revenue_estimate_usd": { "min": number|null, "max": number|null },
        "funding": { "last_round": string|null, "last_round_date": string|null, "total_raised_usd": number|null },
        "tech_stack": [string],
        "trust_signals": { "soc2": boolean|null, "iso27001": boolean|null, "gdpr_page": boolean|null }
      },
      "match_reasoning": string,
      "citations": [{ "url": string, "supports": string }],
      "confidence": number
    }
  ]
}

Return ONLY JSON.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accounts, orgId } = await req.json();
    console.log(`🔬 Starting deep research for ${accounts.length} accounts`);

    let enrichedCount = 0;

    for (const account of accounts) {
      try {
        const query = {
          company: account.name,
          domain: account.domain
        };

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: RESEARCH_PROMPT },
              { role: 'user', content: `Research: ${JSON.stringify(query)}` }
            ],
            temperature: 0.3
          })
        });

        if (!aiResponse.ok) {
          console.error(`AI error for ${account.name}:`, await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices[0].message.content;
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`No JSON found for ${account.name}`);
          continue;
        }

        const researchData = JSON.parse(jsonMatch[0]);
        
        if (researchData.candidates.length > 1) {
          for (const candidate of researchData.candidates) {
            await supabase.from('deep_research_candidates').insert({
              org_id: orgId,
              account_external_id: account.external_id,
              company_data: candidate.company,
              match_reasoning: candidate.match_reasoning,
              confidence: candidate.confidence,
              citations: candidate.citations
            });
          }
          
          console.log(`⚠️ ${researchData.candidates.length} candidates for ${account.name}`);
          continue;
        }

        const candidate = researchData.candidates[0];
        if (candidate.confidence >= 0.7) {
          const company = candidate.company;
          
          let revenueRange = null;
          if (company.revenue_estimate_usd?.min) {
            const revenue = company.revenue_estimate_usd.min;
            if (revenue < 1000000) revenueRange = '$0-$1M';
            else if (revenue < 5000000) revenueRange = '$1M-$5M';
            else if (revenue < 10000000) revenueRange = '$5M-$10M';
            else if (revenue < 25000000) revenueRange = '$10M-$25M';
            else if (revenue < 50000000) revenueRange = '$25M-$50M';
            else if (revenue < 100000000) revenueRange = '$50M-$100M';
            else if (revenue < 500000000) revenueRange = '$100M-$500M';
            else if (revenue < 1000000000) revenueRange = '$500M-$1B';
            else if (revenue < 10000000000) revenueRange = '$1B-$10B';
            else revenueRange = '$10B+';
          }

          await supabase.from('accounts').update({
            legal_name: company.legal_name,
            industry_norm: company.industry,
            naics: company.naics,
            employee_count: company.employee_count?.min || company.employee_count?.max,
            revenue_range: revenueRange,
            country: company.hq?.country,
            tech_stack: company.tech_stack,
            last_funding_round: company.funding?.last_round,
            last_funding_date: company.funding?.last_round_date,
            total_raised_usd: company.funding?.total_raised_usd,
            trust_signals: company.trust_signals,
            linkedin_url: company.linkedin_url,
            enrichment_confidence: candidate.confidence,
            enrichment_citations: candidate.citations,
            enrichment_phase: 'deep_research',
            enriched_at: new Date().toISOString(),
            enriched_from: 'deep_research',
            deep_research_completed_at: new Date().toISOString()
          }).eq('external_id', account.external_id).eq('org_id', orgId);

          await supabase.rpc('auto_score_account', {
            p_account_external_id: account.external_id,
            p_org_id: orgId
          });

          enrichedCount++;
          console.log(`✅ Enriched ${account.name} (confidence: ${candidate.confidence})`);
        } else {
          console.log(`⚠️ Low confidence (${candidate.confidence}) for ${account.name}`);
          
          await supabase.from('deep_research_candidates').insert({
            org_id: orgId,
            account_external_id: account.external_id,
            company_data: candidate.company,
            match_reasoning: candidate.match_reasoning,
            confidence: candidate.confidence,
            citations: candidate.citations
          });
        }
      } catch (e) {
        console.error(`Error processing ${account.name}:`, e);
      }
    }

    console.log(`🎯 Deep research complete: ${enrichedCount}/${accounts.length} enriched`);

    return new Response(
      JSON.stringify({ success: true, enriched: enrichedCount, total: accounts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Deep research error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * enrich-perplexity: Web search with structured output for company data
 * 
 * Uses Perplexity's sonar model with structured JSON output to search
 * for accurate company information with citations.
 */

interface CompanyQuery {
  name: string;
  domain: string | null;
}

interface PerplexityResult {
  employee_count: number | null;
  employee_count_source: string | null;
  revenue_estimate: string | null;
  revenue_source: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  industry: string | null;
  founded_year: number | null;
  linkedin_url: string | null;
  confidence: number;
  citations: string[];
}

// Parse revenue string to standardized range
function parseRevenueToRange(revenueStr: string | null): string | null {
  if (!revenueStr) return null;
  
  const text = revenueStr.toLowerCase();
  const match = text.match(/\$?(\d+(?:\.\d+)?)\s*(million|billion|m|b|k)?/i);
  if (!match) return null;
  
  let value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  
  if (unit === 'b' || unit === 'billion') value *= 1000000000;
  else if (unit === 'm' || unit === 'million') value *= 1000000;
  else if (unit === 'k') value *= 1000;
  
  if (value < 1000000) return '$0-$1M';
  if (value < 5000000) return '$1M-$5M';
  if (value < 10000000) return '$5M-$10M';
  if (value < 25000000) return '$10M-$25M';
  if (value < 50000000) return '$25M-$50M';
  if (value < 100000000) return '$50M-$100M';
  if (value < 500000000) return '$100M-$500M';
  if (value < 1000000000) return '$500M-$1B';
  if (value < 10000000000) return '$1B-$10B';
  return '$10B+';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { company }: { company: CompanyQuery } = await req.json();

    if (!company?.name) {
      return new Response(
        JSON.stringify({ error: "Company name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      console.error("[enrich-perplexity] PERPLEXITY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Perplexity not configured", fallback: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyIdentifier = company.domain 
      ? `${company.name} (${company.domain})`
      : company.name;

    console.log(`[enrich-perplexity] Searching for: ${companyIdentifier}`);

    // Use Perplexity with structured JSON output
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a business research analyst. Find accurate, verifiable company information. 
Only report data you find from reliable sources like LinkedIn, Crunchbase, company websites, SEC filings, or news articles.
If you cannot find reliable data for a field, return null for that field.
Be precise with numbers - do not round or estimate.`
          },
          {
            role: "user",
            content: `Research this company and provide accurate data:
Company: ${company.name}
${company.domain ? `Website: ${company.domain}` : ''}

Find:
1. Exact employee count (from LinkedIn if possible)
2. Annual revenue or revenue estimate
3. Headquarters location (city, state, country)
4. Industry/sector
5. Year founded
6. LinkedIn company URL

Only include data you can verify from reliable sources.`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "company_data",
            schema: {
              type: "object",
              properties: {
                employee_count: { 
                  type: ["number", "null"],
                  description: "Exact number of employees"
                },
                employee_count_source: {
                  type: ["string", "null"],
                  description: "Source of employee count (e.g., 'LinkedIn', 'company website')"
                },
                revenue_estimate: {
                  type: ["string", "null"],
                  description: "Revenue with currency, e.g., '$300 million', '$1.2 billion'"
                },
                revenue_source: {
                  type: ["string", "null"],
                  description: "Source of revenue data"
                },
                headquarters_city: { type: ["string", "null"] },
                headquarters_state: { type: ["string", "null"] },
                headquarters_country: { type: ["string", "null"] },
                industry: { type: ["string", "null"] },
                founded_year: { type: ["number", "null"] },
                linkedin_url: { 
                  type: ["string", "null"],
                  description: "Full LinkedIn company URL"
                },
                data_confidence: {
                  type: "number",
                  description: "Confidence in data accuracy 0-100"
                }
              },
              required: ["data_confidence"]
            }
          }
        },
        temperature: 0.1, // Low temperature for factual accuracy
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[enrich-perplexity] API error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ error: `Perplexity API error: ${response.status}`, fallback: true }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];

    let parsed: any = {};
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error("[enrich-perplexity] Failed to parse response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse Perplexity response", fallback: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build result with parsed revenue
    const result: PerplexityResult = {
      employee_count: parsed.employee_count || null,
      employee_count_source: parsed.employee_count_source || null,
      revenue_estimate: parsed.revenue_estimate || null,
      revenue_source: parsed.revenue_source || null,
      headquarters_city: parsed.headquarters_city || null,
      headquarters_state: parsed.headquarters_state || null,
      headquarters_country: parsed.headquarters_country || null,
      industry: parsed.industry || null,
      founded_year: parsed.founded_year || null,
      linkedin_url: parsed.linkedin_url || null,
      confidence: parsed.data_confidence || 50,
      citations: citations,
    };

    // Convert revenue to standardized range
    const revenueRange = parseRevenueToRange(result.revenue_estimate);

    const latencyMs = Date.now() - startTime;
    console.log(`[enrich-perplexity] Success: employees=${result.employee_count}, revenue=${revenueRange}, confidence=${result.confidence}% in ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        revenue_range: revenueRange,
        latency_ms: latencyMs,
        source: "perplexity"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-perplexity] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

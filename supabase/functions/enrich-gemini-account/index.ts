import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-config.ts";

/**
 * enrich-gemini-account: Gemini-based company firmographic research
 * 
 * Uses Gemini to research company data as a 3rd verification source.
 * Focuses on: employee count, revenue, industry, NAICS, tech stack, funding.
 * 
 * Cost: ~$0.002-0.005 per account
 */

interface CompanyInput {
  name: string;
  domain?: string | null;
  existing_data?: {
    employee_count?: number | null;
    revenue_range?: string | null;
    industry?: string | null;
  };
}

interface GeminiResult {
  employee_count: number | null;
  revenue_range: string | null;
  industry: string | null;
  naics_code: string | null;
  sic_code: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  founded_year: number | null;
  linkedin_url: string | null;
  tech_stack: string[] | null;
  funding_stage: string | null;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { company, companies }: { company?: CompanyInput; companies?: CompanyInput[] } = await req.json();
    
    const companiesArray = companies || (company ? [company] : []);
    
    if (companiesArray.length === 0) {
      return new Response(
        JSON.stringify({ error: "company or companies array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-gemini-account] Processing ${companiesArray.length} companies`);
    
    const results: { input: CompanyInput; data: GeminiResult | null; error?: string }[] = [];
    let successCount = 0;
    
    for (const comp of companiesArray) {
      try {
        const result = await researchWithGemini(comp);
        results.push({ input: comp, data: result });
        if (result) successCount++;
      } catch (e) {
        console.error(`[enrich-gemini-account] Error for ${comp.name}:`, e);
        results.push({ 
          input: comp, 
          data: null, 
          error: e instanceof Error ? e.message : 'Unknown error' 
        });
      }
    }

    const duration = Date.now() - startTime;
    const costEstimate = companiesArray.length * 0.003; // ~$0.003 per company

    return new Response(
      JSON.stringify({
        success: true,
        results: companiesArray.length === 1 ? results[0] : undefined,
        data: companiesArray.length === 1 ? results[0]?.data : undefined,
        all_results: companiesArray.length > 1 ? results : undefined,
        stats: {
          total: companiesArray.length,
          success: successCount,
          failed: companiesArray.length - successCount,
          duration_ms: duration,
          cost_estimate: costEstimate
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-gemini-account] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function researchWithGemini(company: CompanyInput): Promise<GeminiResult | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("[enrich-gemini-account] LOVABLE_API_KEY not configured");
    return null;
  }

  const existingContext = company.existing_data 
    ? `\nExisting data to validate:\n- Employee count: ${company.existing_data.employee_count || 'unknown'}\n- Revenue: ${company.existing_data.revenue_range || 'unknown'}\n- Industry: ${company.existing_data.industry || 'unknown'}`
    : '';

  const prompt = `Research this company and provide accurate firmographic data:

Company Name: ${company.name}
Domain: ${company.domain || 'unknown'}
${existingContext}

Find the following information from reliable sources (LinkedIn, Crunchbase, company website, news):

1. Employee count (exact number if possible)
2. Annual revenue or revenue range
3. Industry/sector classification
4. NAICS code (6-digit, e.g., "541511" for Custom Computer Programming)
5. SIC code (4-digit, e.g., "7371" for Computer Programming Services)
6. Headquarters location (city, state/province, country)
7. Year founded
8. LinkedIn company page URL
9. Tech stack (known technologies they use)
10. Funding stage (Seed, Series A, Series B, etc.)

Return ONLY verified, factual information. If unsure, use null.

Respond with valid JSON only:
{
  "employee_count": number or null,
  "revenue_range": "$XM-$YM" format or null,
  "industry": "Industry Name" or null,
  "naics_code": "6-digit code" or null,
  "sic_code": "4-digit code" or null,
  "headquarters_city": "City" or null,
  "headquarters_state": "State/Province" or null,
  "headquarters_country": "Country" or null,
  "founded_year": number or null,
  "linkedin_url": "https://linkedin.com/company/..." or null,
  "tech_stack": ["Tech1", "Tech2"] or null,
  "funding_stage": "Series X" or null,
  "confidence": 0-100
}`;

  try {
    const response = await callAI(
      [
        { role: "system", content: "You are a business research assistant. Return only valid JSON with company data. Be accurate and conservative - use null for uncertain data." },
        { role: "user", content: prompt }
      ],
      'enrichment',
      'lovable' // Prefer Lovable AI Gateway (Gemini)
    );

    if (!response.ok) {
      console.error("[enrich-gemini-account] AI call failed:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[enrich-gemini-account] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;
    
    // Validate and normalize
    return {
      employee_count: typeof parsed.employee_count === 'number' ? parsed.employee_count : null,
      revenue_range: normalizeRevenueRange(parsed.revenue_range),
      industry: parsed.industry || null,
      naics_code: validateNAICS(parsed.naics_code),
      sic_code: validateSIC(parsed.sic_code),
      headquarters_city: parsed.headquarters_city || null,
      headquarters_state: parsed.headquarters_state || null,
      headquarters_country: parsed.headquarters_country || null,
      founded_year: typeof parsed.founded_year === 'number' && parsed.founded_year > 1800 && parsed.founded_year <= new Date().getFullYear() ? parsed.founded_year : null,
      linkedin_url: parsed.linkedin_url?.includes('linkedin.com/company/') ? parsed.linkedin_url : null,
      tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack.slice(0, 20) : null,
      funding_stage: parsed.funding_stage || null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 60
    };

  } catch (e) {
    console.error("[enrich-gemini-account] Parse error:", e);
    return null;
  }
}

function normalizeRevenueRange(revenue: string | null): string | null {
  if (!revenue) return null;
  
  const text = revenue.toLowerCase();
  const match = text.match(/\$?(\d+(?:\.\d+)?)\s*(million|billion|m|b|k)?/i);
  if (!match) return revenue; // Return as-is if can't parse
  
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

function validateNAICS(code: string | null): string | null {
  if (!code) return null;
  const clean = code.replace(/\D/g, '');
  // NAICS codes are 2-6 digits
  if (clean.length >= 2 && clean.length <= 6) {
    return clean.padEnd(6, '0').slice(0, 6);
  }
  return null;
}

function validateSIC(code: string | null): string | null {
  if (!code) return null;
  const clean = code.replace(/\D/g, '');
  // SIC codes are 4 digits
  if (clean.length >= 2 && clean.length <= 4) {
    return clean.padStart(4, '0').slice(0, 4);
  }
  return null;
}

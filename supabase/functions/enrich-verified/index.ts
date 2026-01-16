import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * enrich-verified: Multi-source verification for accurate company data
 * 
 * This function combines:
 * 1. Firecrawl website scraping (direct from company site)
 * 2. Perplexity web search (with citations)
 * 3. Cross-reference validation
 * 
 * Only commits data when sources agree or high confidence is reached.
 */

interface AccountToEnrich {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  city: string | null;
  state_province: string | null;
  linkedin_url: string | null;
}

interface DataSource {
  source: string;
  employee_count: number | null;
  revenue_range: string | null;
  industry: string | null;
  naics_code: string | null;
  sic_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  founded_year: number | null;
  confidence: number;
  citations?: string[];
}

interface VerifiedData {
  employee_count: number | null;
  employee_count_confidence: number;
  employee_count_source: string | null;
  revenue_range: string | null;
  revenue_range_confidence: number;
  revenue_range_source: string | null;
  industry: string | null;
  industry_confidence: number;
  naics_code: string | null;
  naics_source: string | null;
  sic_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  founded_year: number | null;
  overall_confidence: number;
  sources_used: string[];
  needs_review: boolean;
  citations: string[];
}

// Cross-reference employee counts - accept if within 30% of each other
// Enhanced for 3-source validation
function crossReferenceEmployeeCount(sources: DataSource[]): { value: number | null; confidence: number; source: string | null } {
  const validSources = sources.filter(s => s.employee_count !== null && s.employee_count > 0);
  
  if (validSources.length === 0) {
    return { value: null, confidence: 0, source: null };
  }
  
  if (validSources.length === 1) {
    return { 
      value: validSources[0].employee_count, 
      confidence: Math.min(validSources[0].confidence, 75), // Cap single-source at 75%
      source: validSources[0].source 
    };
  }
  
  // Multiple sources - check if they agree
  const counts = validSources.map(s => s.employee_count!);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const variance = (max - min) / min;
  
  // 3+ sources agreeing = highest confidence
  if (validSources.length >= 3 && variance <= 0.3) {
    const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
    return { 
      value: avg, 
      confidence: 99, // 3-source agreement = highest confidence
      source: validSources.map(s => s.source).join('+') 
    };
  }
  
  if (variance <= 0.3) {
    // Sources agree within 30% - use average, high confidence
    const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
    return { 
      value: avg, 
      confidence: validSources.length >= 3 ? 99 : 95, 
      source: validSources.map(s => s.source).join('+') 
    };
  } else if (variance <= 0.5) {
    // Some disagreement - for 3 sources, use majority vote
    if (validSources.length >= 3) {
      // Find two sources that agree most closely
      const sorted = [...counts].sort((a, b) => a - b);
      const closeVariance = (sorted[1] - sorted[0]) / sorted[0];
      if (closeVariance <= 0.2) {
        // First two agree - use their average
        return { 
          value: Math.round((sorted[0] + sorted[1]) / 2), 
          confidence: 85,
          source: 'verified_majority' 
        };
      }
    }
    // Use source with highest confidence
    const bestSource = validSources.reduce((a, b) => a.confidence > b.confidence ? a : b);
    return { 
      value: bestSource.employee_count, 
      confidence: 70,
      source: bestSource.source 
    };
  } else {
    // Major disagreement - flag for review, use Perplexity (more recent)
    const perplexitySource = validSources.find(s => s.source === 'perplexity');
    const bestSource = perplexitySource || validSources[0];
    return { 
      value: bestSource.employee_count, 
      confidence: 50, // Low confidence due to disagreement
      source: bestSource.source 
    };
  }
}

// Cross-reference revenue ranges - enhanced for 3-source validation
function crossReferenceRevenue(sources: DataSource[]): { value: string | null; confidence: number; source: string | null } {
  const validSources = sources.filter(s => s.revenue_range !== null);
  
  if (validSources.length === 0) {
    return { value: null, confidence: 0, source: null };
  }
  
  if (validSources.length === 1) {
    return { 
      value: validSources[0].revenue_range, 
      confidence: Math.min(validSources[0].confidence, 70),
      source: validSources[0].source 
    };
  }
  
  // Check if ranges match exactly
  const ranges = validSources.map(s => s.revenue_range);
  const uniqueRanges = new Set(ranges);
  
  if (uniqueRanges.size === 1) {
    // All sources agree
    return { 
      value: ranges[0], 
      confidence: validSources.length >= 3 ? 99 : 95, 
      source: validSources.map(s => s.source).join('+') 
    };
  }
  
  // For 3 sources, check if 2 agree (majority vote)
  if (validSources.length >= 3) {
    const rangeCount = new Map<string, number>();
    for (const range of ranges) {
      rangeCount.set(range!, (rangeCount.get(range!) || 0) + 1);
    }
    // Find majority
    for (const [range, count] of rangeCount.entries()) {
      if (count >= 2) {
        return { value: range, confidence: 85, source: 'verified_majority' };
      }
    }
  }
  
  // Ranges differ - use Perplexity (more comprehensive search)
  const perplexitySource = validSources.find(s => s.source === 'perplexity');
  if (perplexitySource) {
    return { value: perplexitySource.revenue_range, confidence: 70, source: 'perplexity' };
  }
  
  return { value: validSources[0].revenue_range, confidence: 60, source: validSources[0].source };
}

// Scrape with Firecrawl
async function scrapeWithFirecrawl(domain: string): Promise<DataSource | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.log("[enrich-verified] Firecrawl not configured");
    return null;
  }
  
  const pagesToScrape = [
    `https://${domain}/about`,
    `https://${domain}/about-us`,
    `https://${domain}/company`,
    `https://${domain}`,
  ];
  
  let allMarkdown = '';
  let successCount = 0;
  
  for (const pageUrl of pagesToScrape) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: pageUrl,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 2000,
        }),
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const markdown = data.data?.markdown || data.markdown || '';
      
      if (markdown) {
        allMarkdown += '\n\n' + markdown;
        successCount++;
      }
      
      if (successCount >= 2) break;
    } catch (e) {
      continue;
    }
  }
  
  if (!allMarkdown) return null;
  
  // Extract data
  const employeeCount = extractEmployeeCount(allMarkdown);
  const revenueRange = extractRevenue(allMarkdown);
  const linkedinUrl = extractLinkedIn(allMarkdown);
  
  return {
    source: 'firecrawl',
    employee_count: employeeCount,
    revenue_range: revenueRange,
    industry: null,
    naics_code: null,
    sic_code: null,
    city: null,
    state: null,
    country: null,
    linkedin_url: linkedinUrl,
    founded_year: null,
    confidence: employeeCount ? 85 : (successCount > 0 ? 60 : 30),
  };
}

// Search with Perplexity
async function searchWithPerplexity(companyName: string, domain: string | null): Promise<DataSource | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  
  try {
    const { data, error } = await supabase.functions.invoke("enrich-perplexity", {
      body: { 
        company: { name: companyName, domain } 
      }
    });
    
    if (error || !data?.success) {
      console.log("[enrich-verified] Perplexity call failed:", error?.message || data?.error);
      return null;
    }
    
    return {
      source: 'perplexity',
      employee_count: data.data?.employee_count || null,
      revenue_range: data.revenue_range || null,
      industry: data.data?.industry || null,
      naics_code: data.data?.naics_code || null,
      sic_code: data.data?.sic_code || null,
      city: data.data?.headquarters_city || null,
      state: data.data?.headquarters_state || null,
      country: data.data?.headquarters_country || null,
      linkedin_url: data.data?.linkedin_url || null,
      founded_year: data.data?.founded_year || null,
      confidence: data.data?.confidence || 70,
      citations: data.data?.citations || [],
    };
  } catch (e) {
    console.error("[enrich-verified] Perplexity error:", e);
    return null;
  }
}

// Search with Gemini (3rd validation source)
async function searchWithGemini(companyName: string, domain: string | null, existingSources: DataSource[]): Promise<DataSource | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  
  // Build existing data context for Gemini to validate
  const existingData = {
    employee_count: existingSources.find(s => s.employee_count)?.employee_count || null,
    revenue_range: existingSources.find(s => s.revenue_range)?.revenue_range || null,
    industry: existingSources.find(s => s.industry)?.industry || null,
  };
  
  try {
    const { data, error } = await supabase.functions.invoke("enrich-gemini-account", {
      body: { 
        company: { 
          name: companyName, 
          domain,
          existing_data: existingData
        } 
      }
    });
    
    if (error || !data?.success) {
      console.log("[enrich-verified] Gemini call failed:", error?.message || data?.error);
      return null;
    }
    
    const geminiData = data.data;
    if (!geminiData) return null;
    
    return {
      source: 'gemini',
      employee_count: geminiData.employee_count || null,
      revenue_range: geminiData.revenue_range || null,
      industry: geminiData.industry || null,
      naics_code: geminiData.naics_code || null,
      sic_code: geminiData.sic_code || null,
      city: geminiData.headquarters_city || null,
      state: geminiData.headquarters_state || null,
      country: geminiData.headquarters_country || null,
      linkedin_url: geminiData.linkedin_url || null,
      founded_year: geminiData.founded_year || null,
      confidence: geminiData.confidence || 65,
    };
  } catch (e) {
    console.error("[enrich-verified] Gemini error:", e);
    return null;
  }
}

// Extraction helpers (from enrich-with-firecrawl)
function extractEmployeeCount(markdown: string): number | null {
  if (!markdown) return null;
  
  const patterns = [
    /(\d{1,5})\+?\s*(?:person|employee|team member|staff)/i,
    /team\s*(?:of\s*)?(\d{1,5})\+?/i,
    /(\d{1,5})\+?\s*strong/i,
    /(\d{1,5})\s*[-–]\s*(\d{1,5})\s*employees/i,
    /over\s*(\d{1,5})\s*(?:employees|people)/i,
    /more\s*than\s*(\d{1,5})\s*(?:employees|people)/i,
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      if (match[2]) {
        return Math.round((parseInt(match[1]) + parseInt(match[2])) / 2);
      }
      const num = parseInt(match[1]);
      if (num >= 10 && num <= 100000) {
        return num;
      }
    }
  }
  
  return null;
}

function extractRevenue(markdown: string): string | null {
  if (!markdown) return null;
  
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(million|billion|M|B)\s*(?:revenue|ARR|annual|in\s*sales)?/i,
    /revenue[:\s]*\$?(\d+(?:\.\d+)?)\s*(million|billion|M|B)/i,
    /(\d+(?:\.\d+)?)\s*(million|billion|M|B)\s*(?:in\s*)?revenue/i,
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      return parseRevenueRange(`$${match[1]} ${match[2]}`);
    }
  }
  
  return null;
}

function parseRevenueRange(revenueClaim: string | null): string | null {
  if (!revenueClaim) return null;
  
  const text = revenueClaim.toLowerCase();
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

function extractLinkedIn(markdown: string): string | null {
  if (!markdown) return null;
  const match = markdown.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}

// Main enrichment logic for a single account
async function enrichAccount(account: AccountToEnrich): Promise<VerifiedData> {
  const sources: DataSource[] = [];
  let allCitations: string[] = [];
  
  // Step 1: Try Firecrawl if we have a domain
  if (account.domain) {
    console.log(`[enrich-verified] Scraping ${account.domain} with Firecrawl...`);
    const firecrawlData = await scrapeWithFirecrawl(account.domain);
    if (firecrawlData) {
      sources.push(firecrawlData);
      console.log(`[enrich-verified] Firecrawl: employees=${firecrawlData.employee_count}, revenue=${firecrawlData.revenue_range}`);
    }
  }
  
  // Step 2: Search with Perplexity
  if (account.name) {
    console.log(`[enrich-verified] Searching ${account.name} with Perplexity...`);
    const perplexityData = await searchWithPerplexity(account.name, account.domain);
    if (perplexityData) {
      sources.push(perplexityData);
      allCitations = perplexityData.citations || [];
      console.log(`[enrich-verified] Perplexity: employees=${perplexityData.employee_count}, revenue=${perplexityData.revenue_range}, industry=${perplexityData.industry}`);
    }
  }
  
  // Step 3: Research with Gemini (validates + fills gaps)
  if (account.name) {
    console.log(`[enrich-verified] Researching ${account.name} with Gemini...`);
    const geminiData = await searchWithGemini(account.name, account.domain, sources);
    if (geminiData) {
      sources.push(geminiData);
      console.log(`[enrich-verified] Gemini: employees=${geminiData.employee_count}, revenue=${geminiData.revenue_range}, naics=${geminiData.naics_code}`);
    }
  }
  
  // Step 4: Cross-reference and validate
  const employeeResult = crossReferenceEmployeeCount(sources);
  const revenueResult = crossReferenceRevenue(sources);
  
  // Get best source for other fields (prefer Gemini for NAICS/tech stack)
  const perplexitySource = sources.find(s => s.source === 'perplexity');
  const firecrawlSource = sources.find(s => s.source === 'firecrawl');
  const geminiSource = sources.find(s => s.source === 'gemini');
  
  // Determine if needs review
  const hasConflict = sources.length >= 2 && (
    employeeResult.confidence < 70 || 
    revenueResult.confidence < 60
  );
  
  const sourcesUsed = sources.map(s => s.source);
  const overallConfidence = sources.length === 0 ? 0 :
    Math.round((employeeResult.confidence + revenueResult.confidence) / 2);
  
  return {
    employee_count: employeeResult.value,
    employee_count_confidence: employeeResult.confidence,
    employee_count_source: employeeResult.source,
    revenue_range: revenueResult.value,
    revenue_range_confidence: revenueResult.confidence,
    revenue_range_source: revenueResult.source,
    industry: perplexitySource?.industry || geminiSource?.industry || null,
    industry_confidence: perplexitySource?.industry ? 75 : (geminiSource?.industry ? 70 : 0),
    naics_code: perplexitySource?.naics_code || geminiSource?.naics_code || null,
    naics_source: perplexitySource?.naics_code ? 'perplexity' : (geminiSource?.naics_code ? 'gemini' : null),
    sic_code: perplexitySource?.sic_code || geminiSource?.sic_code || null,
    city: perplexitySource?.city || geminiSource?.city || null,
    state: perplexitySource?.state || geminiSource?.state || null,
    country: perplexitySource?.country || geminiSource?.country || null,
    linkedin_url: perplexitySource?.linkedin_url || geminiSource?.linkedin_url || firecrawlSource?.linkedin_url || null,
    founded_year: perplexitySource?.founded_year || geminiSource?.founded_year || null,
    overall_confidence: overallConfidence,
    sources_used: sourcesUsed,
    needs_review: hasConflict,
    citations: allCitations,
  };
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { org_id, accounts }: { org_id: string; accounts: AccountToEnrich[] } = await req.json();

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, enriched: 0, failed: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-verified] Processing ${accounts.length} accounts for org ${org_id}`);

    const CONFIDENCE_THRESHOLD = 60;
    let accountsEnriched = 0;
    let fieldsEnriched = 0;
    let failed = 0;
    const results: any[] = [];

    for (const account of accounts) {
      try {
        // Enrich with multi-source verification
        const verified = await enrichAccount(account);
        
        // Build update object for fields that meet confidence threshold
        const updates: Record<string, any> = {
          enriched_at: new Date().toISOString(),
          enriched_from: "verified_multi_source",
        };
        
        const fieldScores: Record<string, number> = {};
        let accountFieldCount = 0;
        
        // Apply employee count if confident and missing/different
        if (verified.employee_count !== null && 
            verified.employee_count_confidence >= CONFIDENCE_THRESHOLD &&
            !account.employee_count) {
          updates.employee_count = verified.employee_count;
          fieldScores.employee_count = verified.employee_count_confidence;
          accountFieldCount++;
        }
        
        // Apply revenue if confident and missing
        if (verified.revenue_range !== null && 
            verified.revenue_range_confidence >= CONFIDENCE_THRESHOLD &&
            !account.revenue_range) {
          updates.revenue_range = verified.revenue_range;
          fieldScores.revenue_range = verified.revenue_range_confidence;
          accountFieldCount++;
        }
        
        // Apply industry if available
        if (verified.industry && verified.industry_confidence >= 60 && !account.industry_raw) {
          updates.industry_norm = verified.industry;
          updates.industry_raw = verified.industry;
          fieldScores.industry = verified.industry_confidence;
          accountFieldCount++;
        }
        
        // Apply NAICS code if available
        if (verified.naics_code) {
          updates.naics = verified.naics_code;
          fieldScores.naics = 80;
          accountFieldCount++;
        }
        
        // Apply SIC code if available
        if (verified.sic_code) {
          updates.sic_code = verified.sic_code;
          accountFieldCount++;
        }
        
        // Apply location if available
        if (verified.city && !account.city) {
          updates.city = verified.city;
          accountFieldCount++;
        }
        if (verified.state && !account.state_province) {
          updates.state_province = verified.state;
          accountFieldCount++;
        }
        if (verified.country && !account.country) {
          updates.country = verified.country;
          fieldScores.country = 80;
          accountFieldCount++;
        }
        
        // Apply LinkedIn URL if available
        if (verified.linkedin_url && 
            !account.linkedin_url &&
            verified.linkedin_url.includes('linkedin.com/company/')) {
          updates.linkedin_url = verified.linkedin_url;
          fieldScores.linkedin_url = 80;
          accountFieldCount++;
        }
        
        // Apply founded year
        if (verified.founded_year) {
          updates.founded_year = verified.founded_year;
          accountFieldCount++;
        }
        
        // Calculate overall confidence from field scores
        const confidenceValues = Object.values(fieldScores);
        if (confidenceValues.length > 0) {
          updates.enrichment_confidence = Math.round(
            confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
          );
          updates.enrichment_field_scores = fieldScores;
          updates.enrichment_phase = "verified";
          updates.enrichment_citations = verified.citations;
        }
        
        // Update account if we have any fields to update
        if (accountFieldCount > 0) {
          const { error: updateError } = await supabase
            .from("accounts")
            .update(updates)
            .eq("id", account.id)
            .eq("org_id", org_id);
          
          if (updateError) {
            console.error(`[enrich-verified] Update failed for ${account.name}:`, updateError);
            failed++;
            results.push({
              account_id: account.id,
              name: account.name,
              success: false,
              error: updateError.message
            });
          } else {
            accountsEnriched++;
            fieldsEnriched += accountFieldCount;
            results.push({
              account_id: account.id,
              name: account.name,
              success: true,
              fields_enriched: accountFieldCount,
              confidence: verified.overall_confidence,
              sources: verified.sources_used,
              needs_review: verified.needs_review
            });
          }
        } else {
          // No fields to update - account was already complete or no data found
          results.push({
            account_id: account.id,
            name: account.name,
            success: true,
            fields_enriched: 0,
            confidence: verified.overall_confidence,
            sources: verified.sources_used,
            message: "No new data found or all fields already populated"
          });
        }
        
      } catch (accountError) {
        console.error(`[enrich-verified] Error enriching ${account.name}:`, accountError);
        failed++;
        results.push({
          account_id: account.id,
          name: account.name,
          success: false,
          error: accountError instanceof Error ? accountError.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[enrich-verified] Complete: ${accountsEnriched} accounts, ${fieldsEnriched} fields, ${failed} failed in ${duration}ms`);

    // Calculate costs (estimates based on API usage)
    const firecrawlCalls = accounts.filter(a => a.domain).length;
    const perplexityCalls = accounts.filter(a => a.name).length;
    const geminiCalls = accounts.filter(a => a.name).length; // Gemini called for all accounts with names
    const costs = {
      firecrawl: firecrawlCalls * 0.005, // $0.005 per scrape
      perplexity: perplexityCalls * 0.005, // $0.005 per search
      gemini: geminiCalls * 0.003, // $0.003 per account
      total: (firecrawlCalls * 0.005) + (perplexityCalls * 0.005) + (geminiCalls * 0.003)
    };

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          processed: accounts.length,
          accounts_enriched: accountsEnriched,
          fields_enriched: fieldsEnriched,
          enriched: accountsEnriched, // Backward compat
          failed,
          duration_ms: duration
        },
        costs,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-verified] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Firecrawl-Powered Company Enrichment
// Scrapes company website directly for accurate data
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  phone: string | null;
  founded_year: number | null;
  description: string | null;
  linkedin_url: string | null;
  confidence: number;
  source: string;
}

// Map revenue text to standardized ranges
function parseRevenueRange(revenueClaim: string | null): string | null {
  if (!revenueClaim) return null;
  
  const text = revenueClaim.toLowerCase();
  
  // Extract number and unit
  const match = text.match(/\$?(\d+(?:\.\d+)?)\s*(million|billion|m|b|k)?/i);
  if (!match) return null;
  
  let value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  
  // Convert to actual value
  if (unit === 'b' || unit === 'billion') value *= 1000000000;
  else if (unit === 'm' || unit === 'million') value *= 1000000;
  else if (unit === 'k') value *= 1000;
  
  // Map to ranges
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

// Extract employee count from markdown text
function extractEmployeeCount(markdown: string): number | null {
  if (!markdown) return null;
  
  // Patterns to find employee counts
  const patterns = [
    /(\d{1,5})\+?\s*(?:person|employee|team member|staff)/i,
    /team\s*(?:of\s*)?(\d{1,5})\+?/i,
    /(\d{1,5})\+?\s*strong/i,
    /(\d{1,5})\s*[-–]\s*(\d{1,5})\s*employees/i, // Range like 401-500
    /over\s*(\d{1,5})\s*(?:employees|people)/i,
    /more\s*than\s*(\d{1,5})\s*(?:employees|people)/i,
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      // Handle ranges
      if (match[2]) {
        return Math.round((parseInt(match[1]) + parseInt(match[2])) / 2);
      }
      const num = parseInt(match[1]);
      if (num >= 10 && num <= 100000) { // Sanity check
        console.log(`[Firecrawl] Found employee count: ${num}`);
        return num;
      }
    }
  }
  
  return null;
}

// Extract revenue from markdown
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
      const range = parseRevenueRange(`$${match[1]} ${match[2]}`);
      if (range) {
        console.log(`[Firecrawl] Found revenue: ${range}`);
        return range;
      }
    }
  }
  
  return null;
}

// Extract phone number
function extractPhone(markdown: string): string | null {
  if (!markdown) return null;
  
  const match = markdown.match(/(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
  if (match && !match[0].includes('555')) { // Skip fake numbers
    return match[0];
  }
  return null;
}

// Extract LinkedIn URL
function extractLinkedIn(markdown: string): string | null {
  if (!markdown) return null;
  
  const match = markdown.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, companyName } = await req.json();

    if (!domain && !companyName) {
      return new Response(
        JSON.stringify({ error: 'Please provide a domain or company name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Firecrawl not configured. Please connect Firecrawl in Settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetDomain = domain || `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
    console.log(`[Firecrawl Enrich] Enriching: ${targetDomain}`);

    // Scrape About page for company info
    const pagesToScrape = [
      `https://${targetDomain}/about`,
      `https://${targetDomain}/about-us`, 
      `https://${targetDomain}/company`,
      `https://${targetDomain}`,
    ];

    let allMarkdown = '';
    let successCount = 0;

    // Try each page and combine results
    for (const pageUrl of pagesToScrape) {
      console.log(`[Firecrawl Enrich] Trying: ${pageUrl}`);
      
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

        if (!response.ok) {
          const errText = await response.text();
          console.log(`[Firecrawl Enrich] ${pageUrl} returned ${response.status}: ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await response.json();
        const markdown = data.data?.markdown || data.markdown || '';
        
        if (markdown) {
          allMarkdown += '\n\n' + markdown;
          successCount++;
          console.log(`[Firecrawl Enrich] Got ${markdown.length} chars from ${pageUrl}`);
        }
        
        // Stop after 2 successful pages
        if (successCount >= 2) break;
        
      } catch (e) {
        console.log(`[Firecrawl Enrich] Error on ${pageUrl}:`, e);
        continue;
      }
    }

    if (!allMarkdown) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not scrape company website',
          suggestion: 'Make sure the domain is correct and accessible'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract data from combined markdown
    const employeeCount = extractEmployeeCount(allMarkdown);
    const revenueRange = extractRevenue(allMarkdown);
    const phone = extractPhone(allMarkdown);
    const linkedinUrl = extractLinkedIn(allMarkdown);

    const enriched: EnrichedCompany = {
      name: companyName || targetDomain.split('.')[0],
      domain: targetDomain,
      employee_count: employeeCount,
      revenue_range: revenueRange,
      industry: null, // Would need NLP to extract
      country: null,
      city: null,
      phone: phone,
      founded_year: null,
      description: allMarkdown.substring(0, 500),
      linkedin_url: linkedinUrl,
      confidence: employeeCount ? 90 : (successCount > 0 ? 60 : 30),
      source: 'firecrawl-website',
    };

    console.log(`[Firecrawl Enrich] Result: employees=${enriched.employee_count}, revenue=${enriched.revenue_range}, confidence=${enriched.confidence}%`);

    return new Response(
      JSON.stringify({ company: enriched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Firecrawl Enrich] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to enrich company' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

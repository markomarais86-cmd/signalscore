// Firecrawl Scrape - Extract structured company data from websites
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  name: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  founded_year: number | null;
  headquarters: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  industry: string | null;
  description: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, options } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('[Firecrawl] Scraping URL:', formattedUrl);

    // Use structured JSON extraction for company data
    const extractSchema = options?.extractSchema || {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Official company name" },
        employee_count: { type: "number", description: "Number of employees (extract number from text like '500+ employees' or 'team of 400')" },
        revenue_claim: { type: "string", description: "Any revenue or ARR mentioned" },
        founded_year: { type: "number", description: "Year the company was founded" },
        headquarters: { type: "string", description: "Full headquarters address" },
        city: { type: "string", description: "City where headquarters is located" },
        country: { type: "string", description: "Country where headquarters is located" },
        phone: { type: "string", description: "Main company phone number" },
        industry: { type: "string", description: "Industry or sector" },
        description: { type: "string", description: "Company description or tagline" },
      }
    };

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: options?.formats || ['markdown', { type: 'json', schema: extractSchema }],
        onlyMainContent: options?.onlyMainContent ?? true,
        waitFor: options?.waitFor || 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Firecrawl] API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Firecrawl] Scrape successful');
    
    // Extract structured data if available
    const extractedData = data.data?.json || data.data?.extract || null;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: data.data,
        extracted: extractedData,
        markdown: data.data?.markdown,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Firecrawl] Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

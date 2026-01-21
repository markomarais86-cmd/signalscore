import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("[enrich-v4] Function loaded");

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isValidUSPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return false;
  const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
  const areaNum = parseInt(areaCode, 10);
  return areaNum >= 200 && areaNum <= 999;
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function extractDomain(input: string): string | null {
  if (!input) return null;
  let domain = input.toLowerCase().trim();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.split('/')[0].split('?')[0];
  if (domain.includes('.') && domain.length > 3) return domain;
  return null;
}

function cleanCompanyName(name: string | null): string | null {
  if (!name) return null;
  return name.replace(/\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?)$/i, '').trim();
}

// ============================================================================
// FIRECRAWL SCRAPING
// ============================================================================

async function scrapeWebsite(domain: string, apiKey: string): Promise<{ markdown: string; success: boolean }> {
  const urls = [
    `https://${domain}`,
    `https://${domain}/about`,
    `https://${domain}/about-us`,
    `https://${domain}/contact`,
  ];

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 15000,
          }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data?.data?.markdown || data?.markdown || null;
      } catch {
        return null;
      }
    })
  );

  const markdowns = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
    .map(r => r.value);

  return {
    markdown: markdowns.join('\n\n---\n\n').substring(0, 50000),
    success: markdowns.length > 0,
  };
}

// ============================================================================
// AI EXTRACTION
// ============================================================================

async function extractWithAI(
  markdown: string,
  companyName: string | null,
  personName: string | null
): Promise<{
  phone: string | null;
  mobilePhone: string | null;
  employeeCount: number | null;
  revenue: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.log("[enrich-v4] No AI API key available");
    return { phone: null, mobilePhone: null, employeeCount: null, revenue: null, industry: null, city: null, state: null, country: null };
  }

  const prompt = `Extract business information from this website content for ${companyName || 'this company'}${personName ? ` (contact: ${personName})` : ''}.

IMPORTANT: Only extract information that is EXPLICITLY stated. Do not guess or infer.

Return a JSON object with these fields:
- phone: Main company phone number (US format preferred)
- mobilePhone: Mobile/cell phone if found
- employeeCount: Number of employees (just the number)
- revenue: Revenue range (e.g., "$10M-$50M")
- industry: Primary industry
- city: City location
- state: State/province
- country: Country

Website content:
${markdown.substring(0, 20000)}

Return ONLY valid JSON, no other text.`;

  try {
    const endpoint = Deno.env.get('GEMINI_API_KEY') 
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
      : 'https://api.lovable.dev/ai/v1/chat/completions';

    const body = Deno.env.get('GEMINI_API_KEY')
      ? { contents: [{ parts: [{ text: prompt }] }] }
      : {
          model: 'gemini-1.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!Deno.env.get('GEMINI_API_KEY')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("[enrich-v4] AI API error:", response.status);
      return { phone: null, mobilePhone: null, employeeCount: null, revenue: null, industry: null, city: null, state: null, country: null };
    }

    const data = await response.json();
    let text = Deno.env.get('GEMINI_API_KEY')
      ? data?.candidates?.[0]?.content?.parts?.[0]?.text
      : data?.choices?.[0]?.message?.content;

    if (!text) {
      return { phone: null, mobilePhone: null, employeeCount: null, revenue: null, industry: null, city: null, state: null, country: null };
    }

    // Clean JSON from markdown
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    return {
      phone: isValidUSPhone(parsed.phone) ? formatPhone(parsed.phone) : null,
      mobilePhone: isValidUSPhone(parsed.mobilePhone) ? formatPhone(parsed.mobilePhone) : null,
      employeeCount: typeof parsed.employeeCount === 'number' ? parsed.employeeCount : null,
      revenue: parsed.revenue || null,
      industry: parsed.industry || null,
      city: parsed.city || null,
      state: parsed.state || null,
      country: parsed.country || null,
    };
  } catch (error) {
    console.error("[enrich-v4] AI extraction error:", error);
    return { phone: null, mobilePhone: null, employeeCount: null, revenue: null, industry: null, city: null, state: null, country: null };
  }
}

// ============================================================================
// REGEX FALLBACK EXTRACTION
// ============================================================================

function extractWithRegex(markdown: string): { phone: string | null; email: string | null } {
  // Phone extraction
  const phonePatterns = [
    /\((\d{3})\)\s*(\d{3})[-.](\d{4})/g,
    /(\d{3})[-.](\d{3})[-.](\d{4})/g,
    /\+1\s*(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
  ];

  const phones: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      const digits = match[0].replace(/\D/g, '');
      if (isValidUSPhone(digits)) {
        phones.push(formatPhone(digits) || '');
      }
    }
  }

  // Email extraction
  const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

  return {
    phone: phones[0] || null,
    email: emailMatch ? emailMatch[0] : null,
  };
}

// ============================================================================
// PROCESS SINGLE INPUT
// ============================================================================

async function processInput(
  input: {
    company_name?: string;
    domain?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    title?: string;
  },
  firecrawlKey: string
): Promise<{
  company_name: string | null;
  domain: string | null;
  phone: string | null;
  mobile_phone: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  enrichment_source: string;
  success: boolean;
}> {
  const domain = extractDomain(input.domain || '') || extractDomain(input.email?.split('@')[1] || '');
  const companyName = cleanCompanyName(input.company_name || null);
  const personName = [input.first_name, input.last_name].filter(Boolean).join(' ') || null;

  if (!domain) {
    console.log("[enrich-v4] No domain found for input");
    return {
      company_name: companyName,
      domain: null,
      phone: null,
      mobile_phone: null,
      employee_count: null,
      revenue_range: null,
      industry: null,
      city: null,
      state: null,
      country: null,
      enrichment_source: 'none',
      success: false,
    };
  }

  console.log(`[enrich-v4] Processing domain: ${domain}`);

  // Step 1: Scrape website
  const { markdown, success: scrapeSuccess } = await scrapeWebsite(domain, firecrawlKey);
  
  if (!scrapeSuccess || !markdown) {
    console.log("[enrich-v4] Scraping failed or no content");
    return {
      company_name: companyName,
      domain,
      phone: null,
      mobile_phone: null,
      employee_count: null,
      revenue_range: null,
      industry: null,
      city: null,
      state: null,
      country: null,
      enrichment_source: 'scrape_failed',
      success: false,
    };
  }

  console.log(`[enrich-v4] Scraped ${markdown.length} chars`);

  // Step 2: AI extraction (primary)
  const aiData = await extractWithAI(markdown, companyName, personName);
  
  // Step 3: Regex fallback for phone if AI didn't find it
  let phone = aiData.phone;
  let mobilePhone = aiData.mobilePhone;
  
  if (!phone && !mobilePhone) {
    const regexData = extractWithRegex(markdown);
    phone = regexData.phone;
  }

  const enrichmentSource = aiData.phone ? 'ai' : (phone ? 'regex' : 'website');

  return {
    company_name: companyName,
    domain,
    phone,
    mobile_phone: mobilePhone,
    employee_count: aiData.employeeCount,
    revenue_range: aiData.revenue,
    industry: aiData.industry,
    city: aiData.city,
    state: aiData.state,
    country: aiData.country,
    enrichment_source: enrichmentSource,
    success: true,
  };
}

// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

async function processInBackground(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  inputs: any[],
  orgId: string,
  firecrawlKey: string
): Promise<void> {
  console.log(`[enrich-v4] Background processing started for job ${jobId}, ${inputs.length} inputs`);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;

  try {
    for (const input of inputs) {
      try {
        // Check if job was paused
        const { data: jobData } = await supabase
          .from('enrichment_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (jobData?.status === 'paused' || jobData?.status === 'cancelled') {
          console.log(`[enrich-v4] Job ${jobId} was ${jobData.status}, stopping`);
          break;
        }

        // Process input
        const result = await processInput(input, firecrawlKey);
        processed++;

        if (result.success) {
          successful++;

          // Save to enriched_leads
          await supabase.from('enriched_leads').upsert({
            org_id: orgId,
            domain: result.domain,
            company_name: result.company_name || input.company_name,
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            title: input.title,
            phone: result.phone,
            mobile_phone: result.mobile_phone,
            employee_count: result.employee_count,
            revenue_range: result.revenue_range,
            industry: result.industry,
            city: result.city,
            state: result.state,
            country: result.country,
            enrichment_source: result.enrichment_source,
            enriched_at: new Date().toISOString(),
          }, {
            onConflict: 'org_id,email',
            ignoreDuplicates: false,
          });
        } else {
          failed++;
        }

        // Update progress every record
        await supabase.from('enrichment_jobs').update({
          processed_records: processed,
          successful_records: successful,
          failed_records: failed,
          progress_percentage: Math.round((processed / inputs.length) * 100),
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);

        console.log(`[enrich-v4] Job ${jobId}: ${processed}/${inputs.length} (${successful} success, ${failed} failed)`);

      } catch (error) {
        console.error(`[enrich-v4] Error processing input:`, error);
        failed++;
        processed++;
      }
    }

    // Mark job complete
    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      processed_records: processed,
      successful_records: successful,
      failed_records: failed,
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[enrich-v4] Job ${jobId} COMPLETED: ${successful}/${processed} successful`);

  } catch (error) {
    console.error(`[enrich-v4] FATAL ERROR in background processing:`, error);
    
    await supabase.from('enrichment_jobs').update({
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  console.log(`[enrich-v4] ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      version: 'v4.1.0',
      timestamp: new Date().toISOString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { inputs, org_id, job_name } = body;

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'inputs array is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!org_id) {
      return new Response(JSON.stringify({ 
        error: 'org_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for Firecrawl key
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ 
        error: 'FIRECRAWL_API_KEY not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .insert({
        org_id,
        job_name: job_name || `Enrichment ${new Date().toISOString()}`,
        job_type: 'lead',
        status: 'processing',
        total_records: inputs.length,
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        progress_percentage: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error("[enrich-v4] Failed to create job:", jobError);
      return new Response(JSON.stringify({ 
        error: 'Failed to create enrichment job',
        details: jobError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-v4] Created job ${job.id} for ${inputs.length} inputs`);

    // Process in background
    const processingPromise = processInBackground(supabase, job.id, inputs, org_id, firecrawlKey);
    
    // Use EdgeRuntime.waitUntil if available
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(processingPromise);
    } else {
      // Fallback: don't await, let it run
      processingPromise.catch(err => console.error("[enrich-v4] Background error:", err));
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      message: `Processing ${inputs.length} records in background`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[enrich-v4] Request error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

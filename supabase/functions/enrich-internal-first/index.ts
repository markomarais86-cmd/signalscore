// Internal-First Enrichment - Check existing data before calling external APIs
// Reduces API costs by leveraging already-enriched accounts and leads
// Now includes domain discovery for company-name-only inputs
// UPDATED: Includes full person enrichment (name, title, phone, email verification)

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
  first_name?: string;
  last_name?: string;
  title?: string;
  source_type?: string;
}

interface EnrichmentResult {
  input: EnrichmentInput;
  matched_account?: any;
  matched_lead?: any;
  enriched_data: Record<string, any>;
  source: 'internal' | 'apollo' | 'pdl' | 'clearbit' | 'ai' | 'domain_discovery' | 'hunter';
  confidence: number;
  fields_filled: string[];
  api_calls_saved: boolean;
  domain_discovered?: boolean;
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

// Extract name from email (e.g., "bill.smith@company.com" -> { first_name: "Bill", last_name: "Smith" })
const extractNameFromEmail = (email: string): { first_name?: string; last_name?: string } => {
  if (!email) return {};
  
  const localPart = email.split('@')[0];
  if (!localPart) return {};
  
  // Replace common separators with spaces
  const normalized = localPart.replace(/[._\-+]/g, ' ').trim();
  const parts = normalized.split(' ').filter(p => p.length > 0);
  
  if (parts.length === 0) return {};
  
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  
  // Filter out common noise (numbers, single chars except initials)
  const cleanParts = parts.filter(p => !/^\d+$/.test(p) && p.length > 1);
  
  if (cleanParts.length >= 2) {
    return {
      first_name: capitalize(cleanParts[0]),
      last_name: capitalize(cleanParts[cleanParts.length - 1])
    };
  } else if (cleanParts.length === 1) {
    return { first_name: capitalize(cleanParts[0]) };
  }
  
  return {};
};

// Classify job title into Level and Persona
const classifyTitle = (title: string): { level: string; persona: string } => {
  if (!title) return { level: 'Unknown', persona: 'Unknown' };
  
  const t = title.toLowerCase();
  
  // Level classification
  let level = 'Individual Contributor';
  if (/\b(ceo|cfo|cto|coo|cmo|cio|ciso|chief|founder|owner|president)\b/.test(t)) {
    level = 'C-Suite';
  } else if (/\b(vp|vice president|evp|svp)\b/.test(t)) {
    level = 'VP';
  } else if (/\b(director|head of)\b/.test(t)) {
    level = 'Director';
  } else if (/\b(manager|lead|supervisor|team lead)\b/.test(t)) {
    level = 'Manager';
  } else if (/\b(senior|sr\.?|principal)\b/.test(t)) {
    level = 'Senior';
  }
  
  // Persona classification
  let persona = 'Other';
  if (/\b(sales|account executive|ae|business development|bdr|sdr|revenue)\b/.test(t)) {
    persona = 'Sales';
  } else if (/\b(marketing|growth|demand gen|content|brand|pr|communications)\b/.test(t)) {
    persona = 'Marketing';
  } else if (/\b(engineer|developer|software|devops|sre|architect|technical|tech lead)\b/.test(t)) {
    persona = 'Engineering';
  } else if (/\b(product|pm|product manager|product owner)\b/.test(t)) {
    persona = 'Product';
  } else if (/\b(hr|human resources|people|talent|recruiting|recruiter)\b/.test(t)) {
    persona = 'HR';
  } else if (/\b(finance|accounting|controller|treasurer|cfo)\b/.test(t)) {
    persona = 'Finance';
  } else if (/\b(operations|ops|logistics|supply chain|procurement)\b/.test(t)) {
    persona = 'Operations';
  } else if (/\b(legal|counsel|compliance|attorney|lawyer)\b/.test(t)) {
    persona = 'Legal';
  } else if (/\b(it|information technology|systems|network|security|infosec)\b/.test(t)) {
    persona = 'IT';
  } else if (/\b(customer success|cs|support|service|client)\b/.test(t)) {
    persona = 'Customer Success';
  } else if (/\b(ceo|cto|cfo|coo|founder|owner|president|partner)\b/.test(t)) {
    persona = 'Executive';
  }
  
  return { level, persona };
};

// Sanitize phone number to E.164 format
const sanitizePhone = (phone: any): string | null => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
};

// Verify email using Hunter.io
const verifyEmailWithHunter = async (email: string): Promise<{ status: string; score: number } | null> => {
  const hunterKey = Deno.env.get('HUNTER_API_KEY');
  if (!hunterKey) return null;
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterKey}`,
      { method: 'GET' }
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: data.data?.status || 'unknown',
        score: data.data?.score || 0
      };
    }
  } catch (e) {
    console.error('[enrich-internal-first] Hunter verification error:', e);
  }
  
  return null;
};

// Use Perplexity for phone discovery with web search
const discoverPhoneWithPerplexity = async (
  personName: string,
  companyName: string,
  domain: string
): Promise<{ phone?: string; mobile?: string; direct_phone?: string; phones?: any[]; citations?: string[] } | null> => {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) return null;
  
  const prompt = `Find phone numbers for ${personName} at ${companyName} (${domain}).

Search for:
1. Direct business phone/extension
2. Mobile/cell phone number
3. Company main line

Return ONLY valid JSON:
{
  "phone": "main direct phone or null",
  "mobile": "mobile/cell phone or null", 
  "direct_phone": "direct line with extension or null",
  "all_phones": [
    {"number": "+1...", "type": "mobile|direct|office", "confidence": 0-100}
  ]
}`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a B2B contact researcher. Find verified phone numbers. Return only JSON.' },
          { role: 'user', content: prompt }
        ],
        search_recency_filter: 'year'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];
      
      console.log('[enrich-internal-first] Perplexity phone response:', content.substring(0, 200));
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          phone: sanitizePhone(parsed.phone) || undefined,
          mobile: sanitizePhone(parsed.mobile) || undefined,
          direct_phone: sanitizePhone(parsed.direct_phone) || undefined,
          phones: (parsed.all_phones || []).map((p: any) => ({
            number: sanitizePhone(p.number),
            type: p.type,
            confidence: p.confidence,
            source: 'perplexity'
          })).filter((p: any) => p.number),
          citations
        };
      }
    }
  } catch (e) {
    console.error('[enrich-internal-first] Perplexity phone discovery error:', e);
  }
  
  return null;
};

// Use AI to discover person details (title, phone, linkedin)
const discoverPersonWithAI = async (
  email: string, 
  domain: string, 
  firstName?: string, 
  lastName?: string,
  companyName?: string
): Promise<{ title?: string; phone?: string; mobile?: string; linkedin_url?: string; level?: string; persona?: string } | null> => {
  const providers = getAvailableProviders();
  if (providers.length === 0) return null;
  
  const personName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
  
  const prompt = `Find professional details for this person. Return ONLY valid JSON, no other text.

Person: ${personName}
Email: ${email}
Company: ${companyName || 'Unknown'}
Company Domain: ${domain}

Return JSON format:
{
  "title": "Job Title or null",
  "phone": "Direct phone number or null",
  "mobile": "Mobile phone or null",
  "linkedin_url": "LinkedIn profile URL or null"
}

If you cannot find reliable information for a field, use null. Be conservative - only include verified data.`;

  try {
    const aiResponse = await callAI('research', [
      { role: 'system', content: 'You are a B2B researcher. Find professional contact details. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]);

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      console.log('[enrich-internal-first] AI person response:', content.substring(0, 200));
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const title = parsed.title || undefined;
        const classification = title ? classifyTitle(title) : { level: undefined, persona: undefined };
        
        return {
          title,
          phone: sanitizePhone(parsed.phone) || undefined,
          mobile: sanitizePhone(parsed.mobile) || undefined,
          linkedin_url: parsed.linkedin_url || undefined,
          level: classification.level,
          persona: classification.persona
        };
      }
    }
  } catch (e) {
    console.error('[enrich-internal-first] AI person discovery error:', e);
  }
  
  return null;
};

// Discover domain for company name using AI
const discoverDomainForCompany = async (companyName: string, supabase: any, orgId: string): Promise<string | null> => {
  // First check internal accounts
  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('domain, name')
    .eq('org_id', orgId)
    .not('domain', 'is', null);

  // Fuzzy match against existing accounts
  const normalized = companyName.toLowerCase().trim()
    .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
    .trim();

  for (const account of existingAccounts || []) {
    if (!account.name) continue;
    const accountNormalized = account.name.toLowerCase().trim()
      .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
      .trim();
    
    if (accountNormalized === normalized || 
        accountNormalized.includes(normalized) || 
        normalized.includes(accountNormalized)) {
      return account.domain;
    }
  }

  // Try AI discovery
  const providers = getAvailableProviders();
  if (providers.length > 0) {
    try {
      const aiResponse = await callAI('research', [
        { role: 'system', content: 'You are a business researcher. Return ONLY the domain name (e.g., "microsoft.com") for the company. No explanation, just the domain.' },
        { role: 'user', content: `What is the official website domain for "${companyName}"?` }
      ]);

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content?.trim() || '';
        // Clean the response - should be just a domain
        const cleanDomain = content.toLowerCase()
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .replace(/['"]/g, '')
          .split('/')[0]
          .split(' ')[0]; // Take first word if AI returned extra text
        
        if (cleanDomain && cleanDomain.includes('.') && !cleanDomain.includes(' ')) {
          return cleanDomain;
        }
      }
    } catch (e) {
      console.error('[enrich-internal-first] AI domain discovery error:', e);
    }
  }

  return null;
};

// Threshold for async processing
const ASYNC_THRESHOLD = 10;
const CHUNK_SIZE = 5;
const HEARTBEAT_INTERVAL_MS = 15000;

// Background processing function for large batches
async function processLeadsInBackground(
  jobId: string,
  inputs: EnrichmentInput[],
  supabase: any,
  orgId: string,
  forceExternal: boolean,
  skipAi: boolean,
  saveToDb: boolean,
  sourceType: string
): Promise<void> {
  console.log(`[enrich-internal-first] Background processing started for job ${jobId} with ${inputs.length} inputs`);
  
  let processed = 0;
  let completed = 0;
  let failed = 0;
  const results: EnrichmentResult[] = [];
  
  // Set up heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await supabase.from('enrichment_jobs').update({
        last_heartbeat: new Date().toISOString(),
        processed_records: processed,
        rows_completed: completed,
        rows_failed: failed,
        last_progress_update: new Date().toISOString()
      }).eq('id', jobId);
    } catch (e) {
      console.warn(`[enrich-internal-first] Heartbeat update failed:`, e);
    }
  }, HEARTBEAT_INTERVAL_MS);
  
  try {
    // Process in chunks
    for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
      const chunk = inputs.slice(i, i + CHUNK_SIZE);
      
      // Process each input in the chunk
      for (const input of chunk) {
        try {
          const result = await processSingleInput(input, supabase, orgId, forceExternal, skipAi);
          results.push(result);
          
          // Save to database if requested
          if (saveToDb && result.enriched_data) {
            await saveEnrichmentResult(result, supabase, orgId, sourceType);
          }
          
          completed++;
        } catch (e) {
          console.error(`[enrich-internal-first] Error processing input:`, e);
          failed++;
          results.push({
            input,
            enriched_data: { error: (e as Error).message },
            source: 'internal',
            confidence: 0,
            fields_filled: [],
            api_calls_saved: false
          });
        }
        processed++;
      }
      
      // Update progress after each chunk
      await supabase.from('enrichment_jobs').update({
        processed_records: processed,
        rows_completed: completed,
        rows_failed: failed,
        last_heartbeat: new Date().toISOString(),
        last_progress_update: new Date().toISOString()
      }).eq('id', jobId);
      
      console.log(`[enrich-internal-first] Job ${jobId}: processed ${processed}/${inputs.length}`);
    }
    
    // Mark job as completed
    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: processed,
      rows_completed: completed,
      rows_failed: failed,
      total_records: inputs.length
    }).eq('id', jobId);
    
    console.log(`[enrich-internal-first] Job ${jobId} completed: ${completed} success, ${failed} failed`);
    
  } catch (error) {
    console.error(`[enrich-internal-first] Job ${jobId} failed:`, error);
    await supabase.from('enrichment_jobs').update({
      status: 'failed',
      error_message: (error as Error).message,
      processed_records: processed,
      rows_completed: completed,
      rows_failed: failed
    }).eq('id', jobId);
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// Save enrichment result to database
async function saveEnrichmentResult(
  result: EnrichmentResult,
  supabase: any,
  orgId: string,
  sourceType: string
): Promise<void> {
  const data = result.enriched_data;
  const email = result.input.email;
  const domain = data.domain || result.input.domain;
  
  if (!email && !domain) return;
  
  // Upsert lead if we have email
  if (email) {
    const leadData = {
      org_id: orgId,
      email: email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
      title: data.title,
      phone: data.phone,
      mobile: data.mobile,
      direct_phone: data.direct_phone,
      linkedin_url: data.linkedin_url,
      level: data.level,
      persona: data.persona,
      company: data.company_name,
      website: domain,
      enriched_at: new Date().toISOString(),
      enriched_from: result.source,
      enrichment_confidence: result.confidence,
      data_source: sourceType
    };
    
    await supabase.from('Leads').upsert(leadData, {
      onConflict: 'email,org_id',
      ignoreDuplicates: false
    });
  }
  
  // Upsert account if we have domain
  if (domain && data.company_name) {
    const accountData = {
      org_id: orgId,
      domain: domain.toLowerCase(),
      name: data.company_name,
      employee_count: data.employee_count,
      revenue_range: data.revenue_range,
      industry_norm: data.industry_norm,
      sub_industry: data.sub_industry,
      country: data.country,
      hq_city: data.hq_city,
      hq_state: data.hq_state,
      hq_address: data.hq_address,
      hq_postal_code: data.hq_postal_code,
      sic_code: data.sic_code,
      naics: data.naics,
      company_main_phone: data.company_main_phone,
      linkedin_url: data.linkedin_url,
      enriched_at: new Date().toISOString(),
      enriched_from: result.source,
      enrichment_confidence: result.confidence,
      data_source: sourceType
    };
    
    await supabase.from('accounts').upsert(accountData, {
      onConflict: 'domain,org_id',
      ignoreDuplicates: false
    });
  }
}

// Process a single input through all enrichment phases
async function processSingleInput(
  input: EnrichmentInput,
  supabase: any,
  orgId: string,
  forceExternal: boolean,
  skipAi: boolean
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    input,
    enriched_data: {},
    source: 'internal',
    confidence: 0,
    fields_filled: [],
    api_calls_saved: false,
    domain_discovered: false
  };

  // Extract basic data from input
  const domain = input.domain || extractDomain(input.email || '');
  const extractedName = extractNameFromEmail(input.email || '');
  
  result.enriched_data.email = input.email;
  result.enriched_data.domain = domain || undefined;
  result.enriched_data.first_name = input.first_name || extractedName.first_name;
  result.enriched_data.last_name = input.last_name || extractedName.last_name;
  result.enriched_data.title = input.title;
  
  if (input.title) {
    const classification = classifyTitle(input.title);
    result.enriched_data.level = classification.level;
    result.enriched_data.persona = classification.persona;
  }

  // Try internal lookup first (unless force_external)
  if (!forceExternal && domain) {
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .ilike('domain', `%${domain}%`)
      .limit(1)
      .single();
    
    if (existingAccount && calculateCompleteness(existingAccount) >= 60) {
      result.enriched_data = {
        ...result.enriched_data,
        employee_count: existingAccount.employee_count,
        revenue_range: existingAccount.revenue_range,
        industry_norm: existingAccount.industry_norm,
        country: existingAccount.country,
        linkedin_url: result.enriched_data.linkedin_url || existingAccount.linkedin_url,
        company_name: existingAccount.name,
        hq_city: existingAccount.hq_city,
        hq_state: existingAccount.hq_state
      };
      result.source = 'internal';
      result.confidence = existingAccount.enrichment_confidence || 0.8;
      result.api_calls_saved = true;
    }
  }

  // External enrichment if needed
  const hasCompanyData = result.enriched_data.employee_count || result.enriched_data.industry_norm;
  
  if (!hasCompanyData && domain) {
    // Try Apollo
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    if (APOLLO_API_KEY) {
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
            result.enriched_data.employee_count = org.estimated_num_employees;
            result.enriched_data.revenue_range = mapRevenueToRange(org.estimated_annual_revenue);
            result.enriched_data.industry_norm = org.industry;
            result.enriched_data.country = org.country;
            result.enriched_data.company_name = org.name;
            result.source = 'apollo';
            result.confidence = 0.95;
          }
        }
      } catch (e) {
        console.error('[processSingleInput] Apollo error:', e);
      }
    }
    
    // Try PDL if still missing
    if (!result.enriched_data.employee_count) {
      const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
      if (PDL_API_KEY) {
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
              result.enriched_data.employee_count = data.size;
              result.enriched_data.revenue_range = mapRevenueToRange(data.estimated_annual_revenue);
              result.enriched_data.industry_norm = data.industry;
              result.enriched_data.country = data.location?.country;
              result.enriched_data.company_name = data.name;
              result.source = 'pdl';
              result.confidence = 0.85;
            }
          }
        } catch (e) {
          console.error('[processSingleInput] PDL error:', e);
        }
      }
    }
    
    // Try Firecrawl if still missing key data
    if (!result.enriched_data.employee_count || !result.enriched_data.industry_norm) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        try {
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: `https://${domain}`,
              formats: ['markdown'],
              onlyMainContent: false
            }),
          });
          
          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const markdown = scrapeData.data?.markdown || '';
            
            if (markdown.length > 100 && !skipAi) {
              const extractPrompt = `Extract company info from website. Return ONLY valid JSON:
{
  "company_name": "name",
  "industry": "industry",
  "city": "city or null",
  "state": "state or null",
  "phone": "phone or null",
  "employee_estimate": "1-10 | 11-50 | 51-200 | 201-500 | 500+ | null"
}

Website (${domain}):
${markdown.substring(0, 4000)}`;

              const extractResponse = await callAI('enrichment', [
                { role: 'system', content: 'Extract business information from website. Return only JSON.' },
                { role: 'user', content: extractPrompt }
              ]);
              
              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const content = extractData.choices?.[0]?.message?.content || '';
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                
                if (jsonMatch) {
                  const extracted = JSON.parse(jsonMatch[0]);
                  const employeeMap: Record<string, number> = {
                    '1-10': 5, '11-50': 25, '51-200': 100, '201-500': 350, '500+': 750
                  };
                  
                  result.enriched_data.company_name = result.enriched_data.company_name || extracted.company_name;
                  result.enriched_data.industry_norm = result.enriched_data.industry_norm || extracted.industry;
                  result.enriched_data.hq_city = result.enriched_data.hq_city || extracted.city;
                  result.enriched_data.hq_state = result.enriched_data.hq_state || extracted.state;
                  result.enriched_data.employee_count = result.enriched_data.employee_count || employeeMap[extracted.employee_estimate];
                  result.enriched_data.phone = result.enriched_data.phone || sanitizePhone(extracted.phone);
                  result.source = 'firecrawl';
                  result.confidence = 0.75;
                }
              }
            }
          }
        } catch (e) {
          console.error('[processSingleInput] Firecrawl error:', e);
        }
      }
    }
  }

  // Person enrichment
  if (input.email && (!result.enriched_data.title || !result.enriched_data.phone) && !skipAi) {
    const personData = await discoverPersonWithAI(
      input.email,
      domain,
      result.enriched_data.first_name,
      result.enriched_data.last_name,
      result.enriched_data.company_name
    );
    
    if (personData) {
      if (personData.title && !result.enriched_data.title) {
        result.enriched_data.title = personData.title;
        result.enriched_data.level = personData.level;
        result.enriched_data.persona = personData.persona;
      }
      if (personData.phone && !result.enriched_data.phone) {
        result.enriched_data.phone = personData.phone;
      }
      if (personData.mobile && !result.enriched_data.mobile) {
        result.enriched_data.mobile = personData.mobile;
      }
      if (personData.linkedin_url && !result.enriched_data.linkedin_url) {
        result.enriched_data.linkedin_url = personData.linkedin_url;
      }
    }
  }

  // Email verification
  const hunterKey = Deno.env.get('HUNTER_API_KEY');
  if (hunterKey && input.email && !result.enriched_data.email_status) {
    const verification = await verifyEmailWithHunter(input.email);
    if (verification) {
      result.enriched_data.email_status = verification.status;
      result.enriched_data.email_score = verification.score;
    }
  }

  // Calculate fields filled
  result.fields_filled = Object.keys(result.enriched_data).filter(k => 
    result.enriched_data[k] != null && result.enriched_data[k] !== ''
  );

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { inputs, org_id, source_type, force_external = false, skip_ai = false, save_to_db = false, async_mode = false } = await req.json();

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

    // Check if we should use async processing
    const shouldUseAsync = async_mode || inputs.length >= ASYNC_THRESHOLD;
    
    if (shouldUseAsync) {
      console.log(`[enrich-internal-first] Large batch (${inputs.length} inputs) - using async processing`);
      
      // Create job record immediately
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id,
          status: 'processing',
          total_records: inputs.length,
          processed_records: 0,
          rows_completed: 0,
          rows_failed: 0,
          job_type: 'leads',
          source_type: 'edge_function',
          source_reference: 'enrich-internal-first',
          last_heartbeat: new Date().toISOString(),
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (jobError) {
        console.error('[enrich-internal-first] Failed to create job:', jobError);
        throw new Error(`Failed to create enrichment job: ${jobError.message}`);
      }
      
      console.log(`[enrich-internal-first] Created job ${job.id}, starting background processing`);
      
      // Start background processing with EdgeRuntime.waitUntil
      EdgeRuntime.waitUntil(
        processLeadsInBackground(
          job.id,
          inputs as EnrichmentInput[],
          supabase,
          org_id,
          force_external,
          skip_ai,
          save_to_db,
          source_type
        )
      );
      
      // Return immediately with job info
      return new Response(JSON.stringify({
        async: true,
        job_id: job.id,
        total_records: inputs.length,
        message: `Enrichment job started. Processing ${inputs.length} records in background.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Synchronous processing for small batches
    console.log(`[enrich-internal-first] Processing ${inputs.length} inputs for org ${org_id}, force_external=${force_external}`);

    const results: EnrichmentResult[] = [];
    const stats = {
      total: inputs.length,
      internal_matches: 0,
      apollo_enriched: 0,
      pdl_enriched: 0,
      ai_enriched: 0,
      person_enriched: 0,
      email_verified: 0,
      failed: 0,
      api_calls_saved: 0
    };

    // Phase 1: Internal Lookup (skip if force_external)
    console.log('[enrich-internal-first] Phase 1: Internal lookup');
    
    // Collect all domains for batch lookup
    const domainsToLookup = new Set<string>();
    const emailsToLookup = new Set<string>();
    const companyNamesToLookup = new Set<string>();

    // Track company names that need domain discovery
    const companyNamesToDiscover: string[] = [];

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
        // If no domain or email, we'll need to discover the domain
        if (!input.domain && !input.email) {
          companyNamesToDiscover.push(input.company_name);
        }
      }
    }

    // Domain discovery for company-name-only inputs
    const discoveredDomains = new Map<string, string>();
    if (companyNamesToDiscover.length > 0) {
      console.log(`[enrich-internal-first] Discovering domains for ${companyNamesToDiscover.length} company names`);
      
      for (const companyName of companyNamesToDiscover) {
        const domain = await discoverDomainForCompany(companyName, supabase, org_id);
        if (domain) {
          discoveredDomains.set(companyName.toLowerCase(), domain);
          domainsToLookup.add(domain);
        }
      }
      
      console.log(`[enrich-internal-first] Discovered ${discoveredDomains.size} domains`);
    }

    // Batch fetch existing accounts by domain (skip if force_external)
    let existingAccounts: any[] = [];
    let existingLeads: any[] = [];
    
    if (!force_external) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', org_id)
        .or(
          Array.from(domainsToLookup).map(d => `domain.ilike.%${d}%`).join(',') ||
          'domain.is.null'
        );
      existingAccounts = accounts || [];

      const { data: leads } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', org_id)
        .or(
          Array.from(emailsToLookup).map(e => `email.ilike.${e}`).join(',') ||
          'email.is.null'
        );
      existingLeads = leads || [];
    }

    // Create lookup maps for O(1) access
    const accountByDomain = new Map<string, any>();
    const accountByName = new Map<string, any>();
    const leadByEmail = new Map<string, any>();

    for (const account of existingAccounts) {
      if (account.domain) {
        accountByDomain.set(normalizeDomain(account.domain), account);
      }
      if (account.name) {
        accountByName.set(account.name.toLowerCase(), account);
      }
    }

    for (const lead of existingLeads) {
      if (lead.email) {
        leadByEmail.set(lead.email.toLowerCase(), lead);
      }
    }

    // Process each input
    const needsExternalEnrichment: { input: EnrichmentInput; resultIndex: number }[] = [];

    for (let i = 0; i < (inputs as EnrichmentInput[]).length; i++) {
      const input = inputs[i] as EnrichmentInput;
      
      const result: EnrichmentResult = {
        input,
        enriched_data: {},
        source: 'internal',
        confidence: 0,
        fields_filled: [],
        api_calls_saved: false,
        domain_discovered: false
      };

      // Always extract name from email if not provided
      const domain = input.domain || extractDomain(input.email || '');
      const extractedName = extractNameFromEmail(input.email || '');
      
      // Set initial person data from input or extraction
      result.enriched_data.email = input.email;
      result.enriched_data.domain = domain || undefined;
      result.enriched_data.first_name = input.first_name || extractedName.first_name;
      result.enriched_data.last_name = input.last_name || extractedName.last_name;
      result.enriched_data.title = input.title;
      
      // Classify title if provided
      if (input.title) {
        const classification = classifyTitle(input.title);
        result.enriched_data.level = classification.level;
        result.enriched_data.persona = classification.persona;
      }

      // Check if we discovered a domain for this company name
      let discoveredDomain: string | null = null;
      if (input.company_name && discoveredDomains.has(input.company_name.toLowerCase())) {
        discoveredDomain = discoveredDomains.get(input.company_name.toLowerCase())!;
        result.domain_discovered = true;
        result.enriched_data.domain = discoveredDomain;
      }

      // Try to find matching account (skip if force_external)
      let matchedAccount: any = null;
      
      if (!force_external) {
        if (input.domain) {
          matchedAccount = accountByDomain.get(normalizeDomain(input.domain));
        }
        if (!matchedAccount && discoveredDomain) {
          matchedAccount = accountByDomain.get(normalizeDomain(discoveredDomain));
        }
        if (!matchedAccount && input.email) {
          const emailDomain = extractDomain(input.email);
          if (emailDomain) matchedAccount = accountByDomain.get(emailDomain);
        }
        if (!matchedAccount && input.company_name) {
          matchedAccount = accountByName.get(input.company_name.toLowerCase());
        }
      }

      // Try to find matching lead (skip if force_external)
      let matchedLead: any = null;
      if (!force_external && input.email) {
        matchedLead = leadByEmail.get(input.email.toLowerCase());
      }

      if (matchedAccount) {
        result.matched_account = matchedAccount;
        const completeness = calculateCompleteness(matchedAccount);
        
        // If account is well-enriched, use internal data
        if (completeness >= 60) {
          result.enriched_data = {
            ...result.enriched_data,
            employee_count: matchedAccount.employee_count,
            revenue_range: matchedAccount.revenue_range,
            industry_norm: matchedAccount.industry_norm,
            country: matchedAccount.country,
            linkedin_url: result.enriched_data.linkedin_url || matchedAccount.linkedin_url,
            company_name: matchedAccount.name,
            hq_city: matchedAccount.hq_city,
            hq_state: matchedAccount.hq_state,
            phone: matchedAccount.phone || matchedAccount.company_main_phone
          };
          result.source = 'internal';
          result.confidence = matchedAccount.enrichment_confidence || 0.8;
          result.api_calls_saved = true;
          stats.internal_matches++;
          stats.api_calls_saved++;
        }
      }

      // Use matched lead data if available
      if (matchedLead) {
        result.matched_lead = matchedLead;
        result.enriched_data.first_name = result.enriched_data.first_name || matchedLead.first_name;
        result.enriched_data.last_name = result.enriched_data.last_name || matchedLead.last_name;
        result.enriched_data.title = result.enriched_data.title || matchedLead.title;
        result.enriched_data.phone = result.enriched_data.phone || matchedLead.phone;
        result.enriched_data.mobile = matchedLead.mobile;
        result.enriched_data.direct_phone = matchedLead.direct_phone;
        result.enriched_data.linkedin_url = result.enriched_data.linkedin_url || matchedLead.linkedin_url;
        
        if (matchedLead.title) {
          const classification = classifyTitle(matchedLead.title);
          result.enriched_data.level = result.enriched_data.level || classification.level;
          result.enriched_data.persona = result.enriched_data.persona || classification.persona;
        }
      }

      // Determine if needs external enrichment
      const hasCompanyData = result.enriched_data.employee_count || result.enriched_data.industry_norm;
      const hasPersonData = result.enriched_data.title && result.enriched_data.first_name;
      
      if (!hasCompanyData || !hasPersonData || force_external) {
        needsExternalEnrichment.push({ input, resultIndex: i });
      }
      
      results.push(result);
    }

    console.log(`[enrich-internal-first] Internal matches: ${stats.internal_matches}, need external: ${needsExternalEnrichment.length}`);

    // Phase 2: External Company Enrichment (Apollo, PDL, AI) - FIXED: removed !force_external condition
    if (needsExternalEnrichment.length > 0) {
      const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
      const PDL_API_KEY = Deno.env.get('PDL_API_KEY');

      // Apollo enrichment
      if (APOLLO_API_KEY) {
        console.log('[enrich-internal-first] Phase 2a: Apollo enrichment');
        
        for (const { input, resultIndex } of needsExternalEnrichment) {
          // Skip if already has company data
          if (results[resultIndex].enriched_data.employee_count) continue;

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
                  ...results[resultIndex].enriched_data,
                  employee_count: org.estimated_num_employees,
                  revenue_range: mapRevenueToRange(org.estimated_annual_revenue),
                  industry_norm: org.industry,
                  country: org.country,
                  linkedin_url: results[resultIndex].enriched_data.linkedin_url || org.linkedin_url,
                  domain: org.primary_domain || domain,
                  company_name: org.name
                };
                results[resultIndex].source = 'apollo';
                results[resultIndex].confidence = 0.95;
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
        
        for (const { input, resultIndex } of needsExternalEnrichment) {
          // Skip if already has company data
          if (results[resultIndex].enriched_data.employee_count) continue;

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
                  ...results[resultIndex].enriched_data,
                  employee_count: data.size,
                  revenue_range: mapRevenueToRange(data.estimated_annual_revenue),
                  industry_norm: data.industry,
                  country: data.location?.country,
                  linkedin_url: results[resultIndex].enriched_data.linkedin_url || data.linkedin_url,
                  domain: data.website || domain,
                  company_name: data.name
                };
                results[resultIndex].source = 'pdl';
                results[resultIndex].confidence = 0.85;
                stats.pdl_enriched++;
              }
            }
          } catch (e) {
            console.error(`[enrich-internal-first] PDL error:`, e);
          }
        }
      }

      // AI firmographic enrichment for remaining - ENHANCED with HQ address and SIC/NAICS
      const providers = getAvailableProviders();
      if (!skip_ai && providers.length > 0) {
        const stillNeedsCompanyData = needsExternalEnrichment.filter(
          ({ resultIndex }) => !results[resultIndex].enriched_data.employee_count
        );
        
        if (stillNeedsCompanyData.length > 0) {
          console.log(`[enrich-internal-first] Phase 2c: AI firmographic enrichment with HQ/SIC/NAICS (${stillNeedsCompanyData.length} remaining)`);
          
          const batchSize = 10; // Smaller batch for more detailed responses
          for (let i = 0; i < stillNeedsCompanyData.length; i += batchSize) {
            const batch = stillNeedsCompanyData.slice(i, i + batchSize);
            
            const prompt = `Research these companies and provide firmographic data. Return ONLY valid JSON array.

Format: [{
  "identifier": "email or domain used to identify",
  "company_name": "Official company name",
  "employee_count": number or null,
  "revenue_range": "range string",
  "industry": "Primary industry",
  "sub_industry": "Sub-industry or null",
  "country": "HQ country",
  "hq_city": "Headquarters city or null",
  "hq_state": "Headquarters state/province or null",
  "hq_address": "Full HQ street address or null",
  "hq_postal_code": "Postal/ZIP code or null",
  "sic_code": "4-digit SIC code or null",
  "naics": "6-digit NAICS code or null",
  "company_main_phone": "Main company phone or null",
  "confidence": 0-100
}]

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Companies to research:
${batch.map(({ input }) => `- ${input.email || input.domain || input.company_name}`).join('\n')}`;

            try {
              const aiResponse = await callAI('enrichment', [
                { role: 'system', content: 'You are a B2B data analyst. Research companies and provide accurate firmographic data including headquarters address and industry codes. Output only valid JSON.' },
                { role: 'user', content: prompt }
              ]);

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const content = aiData.choices?.[0]?.message?.content || '';
                
                console.log('[enrich-internal-first] AI firmographic response sample:', content.substring(0, 300));
                
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                
                if (jsonMatch) {
                  const estimates = JSON.parse(jsonMatch[0]);
                  
                  for (const est of estimates) {
                    if (est.confidence < 40) continue; // Lower threshold for partial data
                    
                    const matchedItem = batch.find(({ input }) => 
                      input.email === est.identifier ||
                      input.domain === est.identifier ||
                      extractDomain(input.email || '') === est.identifier ||
                      input.company_name?.toLowerCase() === est.company_name?.toLowerCase()
                    );
                    
                    if (matchedItem) {
                      const existing = results[matchedItem.resultIndex].enriched_data;
                      results[matchedItem.resultIndex].enriched_data = {
                        ...existing,
                        employee_count: existing.employee_count || est.employee_count,
                        revenue_range: existing.revenue_range || est.revenue_range,
                        industry_norm: existing.industry_norm || est.industry,
                        sub_industry: existing.sub_industry || est.sub_industry,
                        country: existing.country || est.country,
                        hq_city: existing.hq_city || est.hq_city,
                        hq_state: existing.hq_state || est.hq_state,
                        hq_address: existing.hq_address || est.hq_address,
                        hq_postal_code: existing.hq_postal_code || est.hq_postal_code,
                        sic_code: existing.sic_code || est.sic_code,
                        naics: existing.naics || est.naics,
                        company_main_phone: existing.company_main_phone || sanitizePhone(est.company_main_phone),
                        company_name: existing.company_name || est.company_name
                      };
                      results[matchedItem.resultIndex].source = 'ai';
                      results[matchedItem.resultIndex].confidence = est.confidence / 100;
                      stats.ai_enriched++;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[enrich-internal-first] AI firmographic error:', e);
            }
          }
        }
      }
    }

    // Phase 2d: Firecrawl Website Scraping Fallback for small/local businesses
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    // Fix: Trigger if EITHER employee_count OR industry_norm is missing (not requiring both)
    const stillMissingFirmographics = needsExternalEnrichment.filter(
      ({ resultIndex }) => {
        const data = results[resultIndex].enriched_data;
        const hasEmployeeCount = data.employee_count && data.employee_count > 0;
        const hasIndustry = data.industry_norm && String(data.industry_norm).trim() !== '';
        const hasDomain = !!data.domain;
        
        // Trigger Firecrawl if missing key firmographics (employee count OR industry) AND we have a domain
        return (!hasEmployeeCount || !hasIndustry) && hasDomain;
      }
    );
    
    // Debug logging for Phase 2d
    console.log('[enrich-internal-first] Phase 2d check:', {
      firecrawlKeyExists: !!firecrawlKey,
      needsExternalCount: needsExternalEnrichment.length,
      stillMissingCount: stillMissingFirmographics.length,
      firstResult: needsExternalEnrichment[0] ? {
        employee_count: results[needsExternalEnrichment[0].resultIndex].enriched_data.employee_count,
        industry_norm: results[needsExternalEnrichment[0].resultIndex].enriched_data.industry_norm,
        domain: results[needsExternalEnrichment[0].resultIndex].enriched_data.domain
      } : null
    });
    
    if (firecrawlKey && stillMissingFirmographics.length > 0) {
      console.log(`[enrich-internal-first] Phase 2d: Firecrawl website scraping STARTING for ${stillMissingFirmographics.length} leads`);
      
      for (const { resultIndex } of stillMissingFirmographics) {
        const domain = results[resultIndex].enriched_data.domain;
        if (!domain) continue;
        
        console.log(`[enrich-internal-first] Phase 2d: Scraping ${domain}...`);
        
        try {
          // Scrape the website
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: `https://${domain}`,
              formats: ['markdown'],
              onlyMainContent: false
            }),
          });
          
          if (!scrapeResponse.ok) {
            console.error(`[enrich-internal-first] Firecrawl scrape failed for ${domain}:`, {
              status: scrapeResponse.status,
              statusText: scrapeResponse.statusText
            });
            continue;
          }
          
          const scrapeData = await scrapeResponse.json();
          const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
          
          if (markdown && markdown.length > 100) {
            console.log(`[enrich-internal-first] Phase 2d: Scraped ${domain} successfully (${markdown.length} chars)`);
            
            // Also try to scrape /about page for better info
            let aboutMarkdown = '';
            try {
              const aboutResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${firecrawlKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: `https://${domain}/about`,
                  formats: ['markdown'],
                  onlyMainContent: true
                }),
              });
              if (aboutResponse.ok) {
                const aboutData = await aboutResponse.json();
                aboutMarkdown = aboutData.data?.markdown || aboutData.markdown || '';
              }
            } catch (e) {
              // About page might not exist, that's ok
            }
            
            const combinedContent = (markdown + '\n\n' + aboutMarkdown).substring(0, 6000);
            
            // Use AI to extract company info from scraped content
            const extractPrompt = `Extract company information from this website content. Return ONLY valid JSON:

{
  "company_name": "Official company name",
  "industry": "Primary industry/service type (e.g., Towing Services, Restaurant, Retail)",
  "sub_industry": "More specific category or null",
  "city": "City from address on website or null",
  "state": "State from address or null",
  "address": "Full street address or null",
  "phone": "Main phone number found on website or null",
  "employee_estimate": "1-10 | 11-50 | 51-200 | 201-500 | 500+ | null",
  "services": ["list of services or products offered"],
  "sic_code": "4-digit SIC code based on industry or null",
  "naics": "6-digit NAICS code based on industry or null"
}

Website (${domain}):
${combinedContent}`;

            try {
              const extractResponse = await callAI('enrichment', [
                { role: 'system', content: 'Extract business information from website content. Be thorough - look for address in footer, phone numbers, industry keywords.' },
                { role: 'user', content: extractPrompt }
              ]);
              
              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const extractContent = extractData.choices?.[0]?.message?.content || '';
                
                console.log(`[enrich-internal-first] Firecrawl extract for ${domain}:`, extractContent.substring(0, 300));
                
                const jsonMatch = extractContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const extracted = JSON.parse(jsonMatch[0]);
                  
                  // Map employee estimate to count
                  const employeeMap: Record<string, number> = {
                    '1-10': 5,
                    '11-50': 25,
                    '51-200': 100,
                    '201-500': 350,
                    '500+': 750
                  };
                  
                  const existing = results[resultIndex].enriched_data;
                  
                  // Fallback: derive company name from domain if not extracted
                  const derivedCompanyName = domain
                    .replace(/\.(com|biz|net|org|io|co|us|info)$/i, '')
                    .replace(/[-_]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                  
                  results[resultIndex].enriched_data = {
                    ...existing,
                    company_name: existing.company_name || extracted.company_name || derivedCompanyName,
                    industry_norm: existing.industry_norm || extracted.industry,
                    sub_industry: existing.sub_industry || extracted.sub_industry,
                    hq_city: existing.hq_city || extracted.city,
                    hq_state: existing.hq_state || extracted.state,
                    hq_address: existing.hq_address || extracted.address,
                    phone: existing.phone || sanitizePhone(extracted.phone),
                    company_main_phone: existing.company_main_phone || sanitizePhone(extracted.phone),
                    employee_count: existing.employee_count || employeeMap[extracted.employee_estimate] || null,
                    sic_code: existing.sic_code || extracted.sic_code,
                    naics: existing.naics || extracted.naics,
                    services: extracted.services || []
                  };
                  results[resultIndex].source = 'firecrawl';
                  results[resultIndex].confidence = 0.75;
                  
                  console.log(`[enrich-internal-first] Firecrawl enriched ${domain}:`, {
                    company: extracted.company_name,
                    industry: extracted.industry,
                    city: extracted.city,
                    phone: extracted.phone
                  });
                }
              }
            } catch (extractError) {
              console.error(`[enrich-internal-first] AI extraction error for ${domain}:`, extractError);
            }
          }
        } catch (scrapeError) {
          console.error(`[enrich-internal-first] Firecrawl scrape error for ${domain}:`, scrapeError);
        }
      }
    }

    // Phase 3: Person Enrichment (title, phone discovery) - ENHANCED with Perplexity
    console.log('[enrich-internal-first] Phase 3: Person enrichment with Perplexity phone discovery');
    
    const needsPersonEnrichment = results.filter(r => 
      r.input.email && (!r.enriched_data.title || !r.enriched_data.phone || !r.enriched_data.mobile)
    );
    
    if (needsPersonEnrichment.length > 0 && !skip_ai) {
      console.log(`[enrich-internal-first] Enriching ${needsPersonEnrichment.length} persons with AI + Perplexity`);
      
      for (const result of needsPersonEnrichment) {
        if (!result.input.email) continue;
        
        const domain = result.enriched_data.domain || extractDomain(result.input.email);
        const personName = [result.enriched_data.first_name, result.enriched_data.last_name].filter(Boolean).join(' ') 
          || result.input.email.split('@')[0];
        const companyName = result.enriched_data.company_name || '';
        
        // First try general AI for title discovery
        const personData = await discoverPersonWithAI(
          result.input.email,
          domain,
          result.enriched_data.first_name,
          result.enriched_data.last_name,
          companyName
        );
        
        if (personData) {
          if (personData.title && !result.enriched_data.title) {
            result.enriched_data.title = personData.title;
            result.enriched_data.level = personData.level || classifyTitle(personData.title).level;
            result.enriched_data.persona = personData.persona || classifyTitle(personData.title).persona;
          }
          if (personData.phone && !result.enriched_data.phone) {
            result.enriched_data.phone = personData.phone;
          }
          if (personData.mobile && !result.enriched_data.mobile) {
            result.enriched_data.mobile = personData.mobile;
          }
          if (personData.linkedin_url && !result.enriched_data.linkedin_url) {
            result.enriched_data.linkedin_url = personData.linkedin_url;
          }
          stats.person_enriched++;
        }
        
        // If still missing phone, try Perplexity web search specifically for phones
        if (!result.enriched_data.phone && !result.enriched_data.mobile) {
          console.log(`[enrich-internal-first] Trying Perplexity phone discovery for ${personName}`);
          
          const phoneData = await discoverPhoneWithPerplexity(
            personName,
            companyName || domain,
            domain
          );
          
          if (phoneData) {
            if (phoneData.phone && !result.enriched_data.phone) {
              result.enriched_data.phone = phoneData.phone;
            }
            if (phoneData.mobile && !result.enriched_data.mobile) {
              result.enriched_data.mobile = phoneData.mobile;
            }
            if (phoneData.direct_phone && !result.enriched_data.direct_phone) {
              result.enriched_data.direct_phone = phoneData.direct_phone;
            }
            if (phoneData.phones && phoneData.phones.length > 0) {
              result.enriched_data.phones = [
                ...(result.enriched_data.phones || []),
                ...phoneData.phones
              ];
            }
            if (phoneData.citations) {
              result.enriched_data.phone_citations = phoneData.citations;
            }
            console.log(`[enrich-internal-first] Perplexity found phones:`, phoneData);
          }
        }
      }
    }

    // Phase 4: Email Verification with Hunter
    console.log('[enrich-internal-first] Phase 4: Email verification');
    
    const hunterKey = Deno.env.get('HUNTER_API_KEY');
    if (hunterKey) {
      for (const result of results) {
        if (!result.input.email) continue;
        if (result.enriched_data.email_status) continue; // Already verified
        
        const verification = await verifyEmailWithHunter(result.input.email);
        if (verification) {
          result.enriched_data.email_status = verification.status;
          result.enriched_data.email_score = verification.score;
          stats.email_verified++;
        }
      }
    }

    // Phase 5: Calculate fields_filled for all results
    for (const result of results) {
      result.fields_filled = Object.keys(result.enriched_data).filter(k => 
        result.enriched_data[k] != null && result.enriched_data[k] !== ''
      );
    }

    // Count failures
    stats.failed = results.filter(r => r.fields_filled.length <= 2).length; // Only email and domain

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

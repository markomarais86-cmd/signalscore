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

// Use AI to discover person details (title, phone, linkedin)
const discoverPersonWithAI = async (
  email: string, 
  domain: string, 
  firstName?: string, 
  lastName?: string
): Promise<{ title?: string; phone?: string; mobile?: string; linkedin_url?: string } | null> => {
  const providers = getAvailableProviders();
  if (providers.length === 0) return null;
  
  const personName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
  
  const prompt = `Find professional details for this person. Return ONLY valid JSON, no other text.

Person: ${personName}
Email: ${email}
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
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || undefined,
          phone: sanitizePhone(parsed.phone) || undefined,
          mobile: sanitizePhone(parsed.mobile) || undefined,
          linkedin_url: parsed.linkedin_url || undefined
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { inputs, org_id, source_type, force_external = false, skip_ai = false, save_to_db = false } = await req.json();

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

      // AI firmographic enrichment for remaining
      const providers = getAvailableProviders();
      if (!skip_ai && providers.length > 0) {
        const stillNeedsCompanyData = needsExternalEnrichment.filter(
          ({ resultIndex }) => !results[resultIndex].enriched_data.employee_count
        );
        
        if (stillNeedsCompanyData.length > 0) {
          console.log(`[enrich-internal-first] Phase 2c: AI firmographic enrichment (${stillNeedsCompanyData.length} remaining)`);
          
          const batchSize = 20;
          for (let i = 0; i < stillNeedsCompanyData.length; i += batchSize) {
            const batch = stillNeedsCompanyData.slice(i, i + batchSize);
            
            const prompt = `Estimate firmographic data for these companies. Return ONLY valid JSON array.
Format: [{"identifier": "email or domain", "company_name": "name", "employee_count": number, "revenue_range": "range", "industry": "industry", "country": "country", "confidence": 0-100}]

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Companies:
${batch.map(({ input }) => `- ${input.email || input.domain || input.company_name}`).join('\n')}`;

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
                    
                    const matchedItem = batch.find(({ input }) => 
                      input.email === est.identifier ||
                      input.domain === est.identifier ||
                      extractDomain(input.email || '') === est.identifier
                    );
                    
                    if (matchedItem && !results[matchedItem.resultIndex].enriched_data.employee_count) {
                      results[matchedItem.resultIndex].enriched_data = {
                        ...results[matchedItem.resultIndex].enriched_data,
                        employee_count: est.employee_count,
                        revenue_range: est.revenue_range,
                        industry_norm: est.industry,
                        country: est.country,
                        company_name: est.company_name || results[matchedItem.resultIndex].enriched_data.company_name
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

    // Phase 3: Person Enrichment (title, phone discovery)
    console.log('[enrich-internal-first] Phase 3: Person enrichment');
    
    const needsPersonEnrichment = results.filter(r => 
      r.input.email && (!r.enriched_data.title || !r.enriched_data.phone)
    );
    
    if (needsPersonEnrichment.length > 0 && !skip_ai) {
      console.log(`[enrich-internal-first] Enriching ${needsPersonEnrichment.length} persons with AI`);
      
      for (const result of needsPersonEnrichment) {
        if (!result.input.email) continue;
        
        const domain = result.enriched_data.domain || extractDomain(result.input.email);
        const personData = await discoverPersonWithAI(
          result.input.email,
          domain,
          result.enriched_data.first_name,
          result.enriched_data.last_name
        );
        
        if (personData) {
          if (personData.title && !result.enriched_data.title) {
            result.enriched_data.title = personData.title;
            const classification = classifyTitle(personData.title);
            result.enriched_data.level = classification.level;
            result.enriched_data.persona = classification.persona;
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

// Lead/Contact Enrichment - Person-focused data enrichment
// Enriches email, title, phone, LinkedIn for individual people

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  domain?: string;
}

interface PhoneEntry {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  source: string;
  confidence: number;
}

interface LeadEnrichmentResult {
  input: LeadInput;
  enriched_data: {
    email?: string;
    email_verified?: boolean;
    title?: string;
    phone?: string;
    mobile?: string;
    linkedin_url?: string;
    company?: string;
    domain?: string;
    matched_account_id?: string;
    phones?: PhoneEntry[];
  };
  source: 'internal' | 'apollo' | 'pdl' | 'hunter' | 'ai' | 'gemini' | 'perplexity' | 'firecrawl';
  confidence: number;
  fields_filled: string[];
  phone_sources?: Record<string, PhoneEntry[]>;
}

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leads, org_id, save_to_db = false } = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ error: 'leads array required' }), {
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

    console.log(`[enrich-lead] Processing ${leads.length} leads for org ${org_id}`);

    const results: LeadEnrichmentResult[] = [];
    const stats = {
      total: leads.length,
      internal_matches: 0,
      gemini_enriched: 0,
      perplexity_enriched: 0,
      firecrawl_enriched: 0,
      apollo_enriched: 0,
      pdl_enriched: 0,
      hunter_enriched: 0,
      ai_enriched: 0,
      accounts_matched: 0,
      phones_found: 0,
      failed: 0,
      cost_estimate: 0
    };

    // Collect all emails/domains for batch lookup
    const emails = new Set<string>();
    const domains = new Set<string>();
    
    for (const lead of leads as LeadInput[]) {
      if (lead.email) {
        emails.add(lead.email.toLowerCase());
        domains.add(extractDomain(lead.email));
      }
      if (lead.domain) {
        domains.add(lead.domain.toLowerCase());
      }
    }

    // Batch fetch existing leads
    const { data: existingLeads } = await supabase
      .from('Leads')
      .select('*')
      .eq('org_id', org_id)
      .or(
        Array.from(emails).map(e => `email.ilike.${e}`).join(',') || 'email.is.null'
      );

    // Batch fetch accounts for matching
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('external_id, name, domain')
      .eq('org_id', org_id)
      .or(
        Array.from(domains).map(d => `domain.ilike.%${d}%`).join(',') || 'domain.is.null'
      );

    // Create lookup maps
    const leadByEmail = new Map<string, any>();
    const accountByDomain = new Map<string, any>();

    for (const lead of existingLeads || []) {
      if (lead.email) {
        leadByEmail.set(lead.email.toLowerCase(), lead);
      }
    }

    for (const account of existingAccounts || []) {
      if (account.domain) {
        const normalized = account.domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
        accountByDomain.set(normalized, account);
      }
    }

    // Process each lead
    const needsExternalEnrichment: LeadInput[] = [];

    for (const lead of leads as LeadInput[]) {
      const result: LeadEnrichmentResult = {
        input: lead,
        enriched_data: {},
        source: 'internal',
        confidence: 0,
        fields_filled: []
      };

      // Check for existing lead by email
      if (lead.email) {
        const existingLead = leadByEmail.get(lead.email.toLowerCase());
        
        if (existingLead && existingLead.title) {
          result.enriched_data = {
            email: existingLead.email,
            email_verified: true,
            title: existingLead.title,
            phone: existingLead.phone,
            mobile: existingLead.mobile,
            linkedin_url: existingLead.linkedin_url,
            company: existingLead.company
          };
          result.source = 'internal';
          result.confidence = 0.95;
          result.fields_filled = Object.keys(result.enriched_data).filter(k => result.enriched_data[k as keyof typeof result.enriched_data] != null);
          stats.internal_matches++;

          // Try to match to account
          const domain = extractDomain(lead.email);
          const matchedAccount = accountByDomain.get(domain);
          if (matchedAccount) {
            result.enriched_data.matched_account_id = matchedAccount.external_id;
            result.enriched_data.domain = matchedAccount.domain;
            stats.accounts_matched++;
          }

          results.push(result);
          continue;
        }
      }

      // Try to match account even if lead not found
      const domain = lead.domain || (lead.email ? extractDomain(lead.email) : null);
      if (domain) {
        const matchedAccount = accountByDomain.get(domain);
        if (matchedAccount) {
          result.enriched_data.matched_account_id = matchedAccount.external_id;
          result.enriched_data.domain = matchedAccount.domain;
          result.enriched_data.company = matchedAccount.name;
          stats.accounts_matched++;
        }
      }

      needsExternalEnrichment.push(lead);
      results.push(result);
    }

    console.log(`[enrich-lead] Internal matches: ${stats.internal_matches}, need external: ${needsExternalEnrichment.length}`);

    // Phase 2: External Enrichment - COST OPTIMIZED ORDER
    // Cheap AI first (Gemini ~$0.003, Perplexity ~$0.005), expensive data providers last (Apollo/PDL use credits)
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    // Track all phones from all sources for multi-source verification
    const allPhonesByLead = new Map<string, PhoneEntry[]>();

    // Phase 2a: Gemini Phone Research (CHEAP - ~$0.003 per contact)
    if (LOVABLE_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2a: Gemini phone research (low cost)');
      
      try {
        const geminiContacts = needsExternalEnrichment.map(lead => ({
          first_name: lead.first_name,
          last_name: lead.last_name,
          company: lead.company,
          email: lead.email
        }));

        const geminiResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-gemini-phones`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ contacts: geminiContacts })
        });

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          
          for (const result of geminiData.results || []) {
            const leadEmail = result.input?.email;
            if (!leadEmail) continue;

            const resultIndex = results.findIndex(r => r.input.email === leadEmail);
            if (resultIndex === -1) continue;

            // Collect phones with Gemini source
            const geminiPhones: PhoneEntry[] = (result.phones || []).map((p: any) => ({
              number: p.number,
              type: p.type || 'office',
              source: 'gemini',
              confidence: p.confidence || 70
            }));

            if (geminiPhones.length > 0) {
              const existing = allPhonesByLead.get(leadEmail) || [];
              allPhonesByLead.set(leadEmail, [...existing, ...geminiPhones]);
              
              // Update primary phone if not set
              if (!results[resultIndex].enriched_data.phone) {
                results[resultIndex].enriched_data.phone = geminiPhones[0].number;
              }
              stats.gemini_enriched++;
              stats.phones_found += geminiPhones.length;
            }
          }
          stats.cost_estimate += geminiData.stats?.cost_estimate || 0;
        }
      } catch (e) {
        console.error('[enrich-lead] Gemini error:', e);
      }
    }

    // Phase 2b: Perplexity Contact Search (CHEAP - ~$0.005 per contact)
    if (PERPLEXITY_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2b: Perplexity phone search (low cost)');
      
      // Only search for contacts still missing phones
      const needsPhones = needsExternalEnrichment.filter(lead => {
        const phones = allPhonesByLead.get(lead.email || '') || [];
        return phones.length === 0;
      });

      if (needsPhones.length > 0) {
        try {
          const perplexityContacts = needsPhones.map(lead => ({
            first_name: lead.first_name,
            last_name: lead.last_name,
            company: lead.company,
            email: lead.email
          }));

          const perplexityResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-perplexity-contact`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contacts: perplexityContacts })
          });

          if (perplexityResponse.ok) {
            const perplexityData = await perplexityResponse.json();
            
            for (const result of perplexityData.results || []) {
              const leadEmail = result.input?.email;
              if (!leadEmail) continue;

              const resultIndex = results.findIndex(r => r.input.email === leadEmail);
              if (resultIndex === -1) continue;

              const perplexityPhones: PhoneEntry[] = (result.phones || []).map((p: any) => ({
                number: p.number,
                type: p.type || 'office',
                source: 'perplexity',
                confidence: p.confidence || 65
              }));

              if (perplexityPhones.length > 0) {
                const existing = allPhonesByLead.get(leadEmail) || [];
                allPhonesByLead.set(leadEmail, [...existing, ...perplexityPhones]);
                
                if (!results[resultIndex].enriched_data.phone) {
                  results[resultIndex].enriched_data.phone = perplexityPhones[0].number;
                }
                stats.perplexity_enriched++;
                stats.phones_found += perplexityPhones.length;
              }
            }
            stats.cost_estimate += perplexityData.stats?.cost_estimate || 0;
          }
        } catch (e) {
          console.error('[enrich-lead] Perplexity error:', e);
        }
      }
    }

    // Phase 2c: Firecrawl Contact Page Scraping (CHEAP - ~$0.002 per page)
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (FIRECRAWL_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2c: Firecrawl contact page scraping (low cost)');
      
      // Only scrape for contacts still missing phones
      const needsFirecrawl = needsExternalEnrichment.filter(lead => {
        const phones = allPhonesByLead.get(lead.email || '') || [];
        return phones.length === 0;
      });

      // Group by domain to avoid duplicate scrapes
      const domainLeadsMap = new Map<string, LeadInput[]>();
      for (const lead of needsFirecrawl) {
        const domain = lead.domain || (lead.email ? extractDomain(lead.email) : null);
        if (domain) {
          const existing = domainLeadsMap.get(domain) || [];
          domainLeadsMap.set(domain, [...existing, lead]);
        }
      }

      // Scrape contact/about pages for each unique domain
      const contactPaths = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/leadership'];
      const phonePatterns = [
        /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, // US/CA
        /\+44\s?[0-9]{10,11}/g, // UK
        /\+[1-9]\d{6,14}/g, // E.164 international
        /\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, // Local US format
      ];

      for (const [domain, leads] of domainLeadsMap) {
        let allMarkdown = '';
        let pagesScraped = 0;

        // Try scraping up to 2 contact pages per domain
        for (const path of contactPaths) {
          if (pagesScraped >= 2) break;
          
          const pageUrl = `https://${domain}${path}`;
          try {
            const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: pageUrl,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 2000,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const markdown = data.data?.markdown || '';
              if (markdown.length > 100) {
                allMarkdown += '\n\n' + markdown;
                pagesScraped++;
                console.log(`[enrich-lead] Firecrawl: Got ${markdown.length} chars from ${pageUrl}`);
              }
            }
            stats.cost_estimate += 0.002; // ~$0.002 per page
          } catch (e) {
            console.log(`[enrich-lead] Firecrawl error on ${pageUrl}:`, e);
          }
        }

        if (!allMarkdown) continue;

        // Extract phones from scraped content
        const foundPhones: Set<string> = new Set();
        for (const pattern of phonePatterns) {
          const matches = allMarkdown.matchAll(pattern);
          for (const match of matches) {
            const phone = match[0];
            // Skip fake/placeholder numbers
            if (!phone.includes('555') && !phone.includes('000-0000') && phone.length >= 10) {
              foundPhones.add(phone);
            }
          }
        }

        if (foundPhones.size > 0) {
          console.log(`[enrich-lead] Firecrawl found ${foundPhones.size} phones for ${domain}`);
          
          // Extract context around phones for role attribution (Phase 3 prep)
          const phoneArray = Array.from(foundPhones);
          
          // Assign phones to all leads at this domain
          for (const lead of leads) {
            const leadEmail = lead.email;
            if (!leadEmail) continue;

            const resultIndex = results.findIndex(r => r.input.email === leadEmail);
            if (resultIndex === -1) continue;

            // Create phone entries with firecrawl source
            const firecrawlPhones: PhoneEntry[] = phoneArray.map((p, idx) => ({
              number: p,
              type: idx === 0 ? 'main' : 'office' as 'main' | 'office',
              source: 'firecrawl',
              confidence: 75
            }));

            const existing = allPhonesByLead.get(leadEmail) || [];
            allPhonesByLead.set(leadEmail, [...existing, ...firecrawlPhones]);
            
            if (!results[resultIndex].enriched_data.phone) {
              results[resultIndex].enriched_data.phone = firecrawlPhones[0].number;
            }
            stats.firecrawl_enriched++;
            stats.phones_found += firecrawlPhones.length;
          }
        }
      }
    }

    // Phase 2d: Apollo People Enrichment (EXPENSIVE - uses credits, only if still missing data)
    if (APOLLO_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2d: Apollo person enrichment (uses credits - last resort)');
      
      // Only use Apollo for contacts still missing critical data (phone or title)
      const needsApollo = needsExternalEnrichment.filter(lead => {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) return false;
        const phones = allPhonesByLead.get(lead.email || '') || [];
        return phones.length === 0 || !results[resultIndex].enriched_data.title;
      });

      for (const lead of needsApollo) {
        if (!lead.email) continue;

        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) continue;

        try {
          const response = await withHttpRetry(
            () => fetch('https://api.apollo.io/v1/people/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: APOLLO_API_KEY,
                email: lead.email,
                first_name: lead.first_name,
                last_name: lead.last_name
              })
            }),
            { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
          );

          if (response.ok) {
            const data = await response.json();
            const person = data.person;
            
            if (person) {
              results[resultIndex].enriched_data = {
                ...results[resultIndex].enriched_data,
                email: person.email || lead.email,
                email_verified: person.email_status === 'verified',
                title: person.title || results[resultIndex].enriched_data.title,
                linkedin_url: person.linkedin_url || results[resultIndex].enriched_data.linkedin_url,
                company: person.organization?.name || results[resultIndex].enriched_data.company
              };
              
              // Add Apollo phones to collection
              const apolloPhones: PhoneEntry[] = (person.phone_numbers || []).map((p: any) => ({
                number: p.number,
                type: p.type === 'mobile' ? 'mobile' : 'office',
                source: 'apollo',
                confidence: 95
              }));
              
              if (apolloPhones.length > 0) {
                const existing = allPhonesByLead.get(lead.email!) || [];
                allPhonesByLead.set(lead.email!, [...existing, ...apolloPhones]);
                stats.phones_found += apolloPhones.length;
              }
              
              results[resultIndex].source = 'apollo';
              results[resultIndex].confidence = 0.95;
              results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                .filter(k => (results[resultIndex].enriched_data as any)[k] != null);
              stats.apollo_enriched++;
            }
          }
        } catch (e) {
          console.error('[enrich-lead] Apollo error:', e);
        }
      }
    }

    // Phase 2e: PDL People Enrichment (EXPENSIVE - uses credits, absolute last resort)
    if (PDL_API_KEY) {
      console.log('[enrich-lead] Phase 2d: PDL person enrichment (uses credits - last resort)');
      
      // Only use PDL for contacts still missing critical data after all cheaper sources
      const needsPDL = needsExternalEnrichment.filter(lead => {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) return false;
        const phones = allPhonesByLead.get(lead.email || '') || [];
        // Only use PDL if still missing phones AND title
        return phones.length === 0 && !results[resultIndex].enriched_data.title;
      });

      for (const lead of needsPDL) {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) continue;

        try {
          const params = new URLSearchParams();
          if (lead.email) params.append('email', lead.email);
          if (lead.first_name) params.append('first_name', lead.first_name);
          if (lead.last_name) params.append('last_name', lead.last_name);
          if (lead.company) params.append('company', lead.company);

          const response = await withHttpRetry(
            () => fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`, {
              method: 'GET',
              headers: { 'X-Api-Key': PDL_API_KEY }
            }),
            { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
          );

          if (response.ok) {
            const data = await response.json();
            
            if (data.data) {
              const person = data.data;
              results[resultIndex].enriched_data = {
                ...results[resultIndex].enriched_data,
                email: person.work_email || person.personal_emails?.[0] || lead.email,
                title: person.job_title || results[resultIndex].enriched_data.title,
                linkedin_url: person.linkedin_url || results[resultIndex].enriched_data.linkedin_url,
                company: person.job_company_name || results[resultIndex].enriched_data.company
              };
              
              // Add PDL phones to collection
              const pdlPhones: PhoneEntry[] = [];
              if (person.phone_numbers?.[0]) {
                pdlPhones.push({ number: person.phone_numbers[0], type: 'office', source: 'pdl', confidence: 85 });
              }
              if (person.mobile_phone) {
                pdlPhones.push({ number: person.mobile_phone, type: 'mobile', source: 'pdl', confidence: 85 });
              }
              
              if (pdlPhones.length > 0) {
                const existing = allPhonesByLead.get(lead.email!) || [];
                allPhonesByLead.set(lead.email!, [...existing, ...pdlPhones]);
                stats.phones_found += pdlPhones.length;
              }
              
              results[resultIndex].source = 'pdl';
              results[resultIndex].confidence = 0.85;
              results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                .filter(k => (results[resultIndex].enriched_data as any)[k] != null);
              stats.pdl_enriched++;
            }
          }
        } catch (e) {
          console.error('[enrich-lead] PDL error:', e);
        }
      }
    }

    // Hunter.io for email verification/finding
    if (HUNTER_API_KEY) {
      console.log('[enrich-lead] Phase 2f: Hunter.io verification');
      
      for (const lead of needsExternalEnrichment) {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) continue;
        
        // Only verify if we have an email
        if (lead.email && !results[resultIndex].enriched_data.email_verified) {
          try {
            const response = await fetch(
              `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(lead.email)}&api_key=${HUNTER_API_KEY}`
            );

            if (response.ok) {
              const data = await response.json();
              if (data.data) {
                results[resultIndex].enriched_data.email_verified = 
                  data.data.status === 'valid' || data.data.result === 'deliverable';
                if (results[resultIndex].source === 'internal') {
                  results[resultIndex].source = 'hunter';
                }
                stats.hunter_enriched++;
              }
            }
          } catch (e) {
            console.error('[enrich-lead] Hunter error:', e);
          }
        }
      }
    }

    // AI enrichment for remaining
    const providers = getAvailableProviders();
    if (providers.length > 0) {
      const stillNeedsEnrichment = results.filter(r => r.fields_filled.length < 2);
      
      if (stillNeedsEnrichment.length > 0) {
        console.log(`[enrich-lead] Phase 2g: AI enrichment (${stillNeedsEnrichment.length} remaining)`);
        
        // Batch AI requests
        const batchSize = 10;
        for (let i = 0; i < stillNeedsEnrichment.length; i += batchSize) {
          const batch = stillNeedsEnrichment.slice(i, i + batchSize);
          
          const prompt = `Find professional information for these people. Return ONLY valid JSON array.
Format: [{"identifier": "email or name", "title": "job title", "company": "company name", "linkedin_url": "url if known", "confidence": 0-100}]

People:
${batch.map(r => {
  const lead = r.input;
  if (lead.email) return `- ${lead.email}`;
  if (lead.first_name && lead.last_name && lead.company) return `- ${lead.first_name} ${lead.last_name} at ${lead.company}`;
  return null;
}).filter(Boolean).join('\n')}`;

          try {
            const aiResponse = await callAI('research', [
              { role: 'system', content: 'You are a business researcher. Find professional information about people. Be accurate and conservative with confidence scores.' },
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
                  
                  const resultIndex = results.findIndex(r => 
                    r.input.email === est.identifier ||
                    `${r.input.first_name} ${r.input.last_name}`.toLowerCase() === est.identifier?.toLowerCase()
                  );
                  
                  if (resultIndex !== -1 && results[resultIndex].fields_filled.length < 2) {
                    results[resultIndex].enriched_data = {
                      ...results[resultIndex].enriched_data,
                      title: est.title,
                      company: est.company,
                      linkedin_url: est.linkedin_url
                    };
                    results[resultIndex].source = 'ai';
                    results[resultIndex].confidence = est.confidence / 100;
                    results[resultIndex].fields_filled = Object.keys(results[resultIndex].enriched_data)
                      .filter(k => (results[resultIndex].enriched_data as any)[k] != null);
                    stats.ai_enriched++;
                  }
                }
              }
            }
          } catch (e) {
            console.error('[enrich-lead] AI error:', e);
          }
        }
      }
    }

    // Attach collected phones to results
    for (const result of results) {
      const email = result.input.email;
      if (email) {
        const phones = allPhonesByLead.get(email) || [];
        result.enriched_data.phones = phones;
        result.phone_sources = {};
        for (const phone of phones) {
          if (!result.phone_sources[phone.source]) {
            result.phone_sources[phone.source] = [];
          }
          result.phone_sources[phone.source].push(phone);
        }
      }
    }

    // Save to database if requested
    if (save_to_db) {
      console.log('[enrich-lead] Saving enriched leads to database');
      
      let savedCount = 0;
      let saveErrors = 0;
      
      for (const result of results) {
        if (result.fields_filled.length === 0) continue;
        
        const lead = result.input;
        const enriched = result.enriched_data;
        const phones = enriched.phones || [];
        
        // Validate leadEmail is a string before using string methods
        const rawLeadEmail = enriched.email || lead.email;
        const leadEmail = typeof rawLeadEmail === 'string' ? rawLeadEmail : null;
        
        // Build phones JSONB for multi-source storage
        const phonesJson = phones.map(p => ({
          number: p.number,
          type: p.type,
          sources: [p.source],
          confidence: p.confidence,
          verified_at: new Date().toISOString()
        }));
        
        // Use external_id-based upsert for reliability (org_id, external_id has a proper unique constraint)
        // Generate external_id from email if not present
        const externalId = leadEmail ? `EMAIL_${leadEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : `LEAD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          // First, check if lead with this email exists
          const { data: existingLead } = await supabase
            .from('Leads')
            .select('id, external_id')
            .eq('org_id', org_id)
            .eq('email', leadEmail)
            .maybeSingle();
          
          const leadData = {
            org_id,
            external_id: existingLead?.external_id || externalId,
            email: leadEmail,
            first_name: lead.first_name,
            last_name: lead.last_name,
            title: enriched.title,
            phone: phones[0]?.number || enriched.phone,
            mobile: phones.find(p => p.type === 'mobile')?.number || enriched.mobile,
            direct_phone: phones.find(p => p.type === 'direct')?.number,
            phones: phonesJson,
            phone_sources: result.phone_sources,
            linkedin_url: enriched.linkedin_url,
            company: enriched.company || lead.company,
            website: enriched.domain || lead.domain,
            account_external_id: enriched.matched_account_id,
            enrichment_source: result.source,
            enrichment_confidence: result.confidence,
            enriched_at: new Date().toISOString()
          };
          
          // Use the existing unique constraint on (org_id, external_id)
          const { error } = await supabase
            .from('Leads')
            .upsert(leadData, {
              onConflict: 'org_id,external_id',
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error('[enrich-lead] Save error for', leadEmail, ':', error.message);
            saveErrors++;
          } else {
            savedCount++;
          }
        } catch (e: any) {
          console.error('[enrich-lead] Save exception for', leadEmail, ':', e.message);
          saveErrors++;
        }
      }
      
      console.log(`[enrich-lead] Saved ${savedCount} leads, ${saveErrors} errors`);
    }

    stats.failed = results.filter(r => r.fields_filled.length === 0).length;

    console.log(`[enrich-lead] Complete:`, stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-lead] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

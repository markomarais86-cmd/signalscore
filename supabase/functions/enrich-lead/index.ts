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
  source: 'internal' | 'apollo' | 'pdl' | 'hunter' | 'ai' | 'gemini' | 'perplexity';
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
      apollo_enriched: 0,
      pdl_enriched: 0,
      hunter_enriched: 0,
      ai_enriched: 0,
      accounts_matched: 0,
      failed: 0
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

    // Phase 2: External Enrichment
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');

    // Apollo People Enrichment
    if (APOLLO_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2a: Apollo person enrichment');
      
      for (const lead of needsExternalEnrichment) {
        if (!lead.email) continue;

        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1 || results[resultIndex].fields_filled.length > 3) continue;

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
                title: person.title,
                phone: person.phone_numbers?.[0]?.number,
                linkedin_url: person.linkedin_url,
                company: person.organization?.name
              };
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

    // PDL People Enrichment for remaining
    if (PDL_API_KEY) {
      console.log('[enrich-lead] Phase 2b: PDL person enrichment');
      
      for (const lead of needsExternalEnrichment) {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1 || results[resultIndex].fields_filled.length > 3) continue;

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
                title: person.job_title,
                phone: person.phone_numbers?.[0],
                mobile: person.mobile_phone,
                linkedin_url: person.linkedin_url,
                company: person.job_company_name
              };
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
      console.log('[enrich-lead] Phase 2c: Hunter.io verification');
      
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
        console.log(`[enrich-lead] Phase 2d: AI enrichment (${stillNeedsEnrichment.length} remaining)`);
        
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

    // Save to database if requested
    if (save_to_db) {
      console.log('[enrich-lead] Saving enriched leads to database');
      
      for (const result of results) {
        if (result.fields_filled.length === 0) continue;
        
        const lead = result.input;
        const enriched = result.enriched_data;
        
        // Upsert lead
        const { error } = await supabase
          .from('Leads')
          .upsert({
            org_id,
            email: enriched.email || lead.email,
            first_name: lead.first_name,
            last_name: lead.last_name,
            title: enriched.title,
            phone: enriched.phone,
            mobile: enriched.mobile,
            linkedin_url: enriched.linkedin_url,
            company: enriched.company || lead.company,
            website: enriched.domain || lead.domain,
            account_external_id: enriched.matched_account_id,
            enrichment_source: result.source,
            enrichment_confidence: result.confidence,
            enriched_at: new Date().toISOString()
          }, {
            onConflict: 'org_id,email',
            ignoreDuplicates: false
          });
          
        if (error) {
          console.error('[enrich-lead] Save error:', error);
        }
      }
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

// Lead/Contact Enrichment - Person-focused data enrichment
// Enriches email, title, phone, LinkedIn for individual people
// NOW WITH: Name extraction from email, AI discovery for sparse leads

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
  title?: string;        // From input CSV
  phone?: string;        // From input CSV
  linkedin_url?: string; // From input CSV
  company?: string;
  domain?: string;
  _discovered?: boolean; // Flag for discovered contacts
}

// Sanitize phone - reject boolean strings and invalid formats
const sanitizePhone = (phone: any): string | null => {
  if (!phone) return null;
  if (typeof phone === 'boolean') return null;
  if (phone === 'true' || phone === 'false' || phone === true || phone === false) return null;
  const str = String(phone);
  // Must contain at least 7 digits
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7) return null;
  // Skip placeholder numbers
  if (digits.includes('555') || digits.includes('0000000')) return null;
  return str.trim();
};

// Extract name from email address (e.g., john.smith@company.com -> John Smith)
const extractNameFromEmail = (email: string): { firstName?: string; lastName?: string } => {
  if (!email) return {};
  const localPart = email.split('@')[0].toLowerCase();
  
  // Pattern: firstname.lastname@domain or firstname_lastname@domain
  if (localPart.includes('.') || localPart.includes('_')) {
    const separator = localPart.includes('.') ? '.' : '_';
    const parts = localPart.split(separator);
    if (parts.length >= 2) {
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return {
        firstName: capitalize(parts[0]),
        lastName: capitalize(parts[parts.length - 1])
      };
    }
  }
  
  // Pattern: firstnamelastname@domain - try common first name patterns
  // Skip generic emails like info@, admin@, contact@
  const genericPrefixes = ['info', 'admin', 'contact', 'support', 'sales', 'hello', 'team', 'office', 'mail', 'no-reply', 'noreply'];
  if (genericPrefixes.includes(localPart)) {
    return {};
  }
  
  // If it looks like a name (4-15 chars, only letters), return as first name
  if (/^[a-z]{4,15}$/.test(localPart)) {
    return { firstName: localPart.charAt(0).toUpperCase() + localPart.slice(1) };
  }
  
  return {};
};

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
    first_name?: string;
    last_name?: string;
    title?: string;
    phone?: string;
    mobile?: string;
    linkedin_url?: string;
    company?: string;
    domain?: string;
    matched_account_id?: string;
    phones?: PhoneEntry[];
  };
  source: 'internal' | 'apollo' | 'pdl' | 'hunter' | 'ai' | 'gemini' | 'perplexity' | 'firecrawl' | 'discovered';
  confidence: number;
  fields_filled: string[];
  phone_sources?: Record<string, PhoneEntry[]>;
}

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// Background processing function for async enrichment jobs
async function processEnrichmentJobBackground(
  supabase: any,
  jobId: string,
  leads: LeadInput[],
  org_id: string,
  save_to_db: boolean,
  target_titles: string[]
) {
  console.log(`[enrich-lead-bg] Starting background processing for job ${jobId} with ${leads.length} leads`);
  
  try {
    // Update job status to processing
    await supabase
      .from('enrichment_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', jobId);
    
    // Process leads in smaller batches to update progress
    const BATCH_SIZE = 25;
    let processedCount = 0;
    let enrichedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      
      // Check if job was paused/cancelled
      const { data: jobStatus } = await supabase
        .from('enrichment_jobs')
        .select('status')
        .eq('id', jobId)
        .single();
      
      if (jobStatus?.status === 'cancelled' || jobStatus?.status === 'paused') {
        console.log(`[enrich-lead-bg] Job ${jobId} was ${jobStatus.status}, stopping`);
        return;
      }
      
      // Invoke synchronous enrich-lead for this batch (without async_mode)
      const { data, error } = await supabase.functions.invoke('enrich-lead', {
        body: { 
          leads: batch, 
          org_id, 
          save_to_db,
          target_titles,
          async_mode: false // Process synchronously
        }
      });
      
      if (error) {
        console.error(`[enrich-lead-bg] Batch error:`, error);
        failedCount += batch.length;
      } else {
        processedCount += batch.length;
        enrichedCount += data?.results?.filter((r: any) => r.fields_filled?.length > 0).length || 0;
        failedCount += data?.stats?.failed || 0;
      }
      
      // Update job progress
      const progressPercent = Math.round((processedCount / leads.length) * 100);
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
      
      await supabase
        .from('enrichment_jobs')
        .update({
          processed_records: processedCount,
          enriched_records: enrichedCount,
          failed_records: failedCount,
          progress_percentage: progressPercent,
          current_batch: currentBatch,
          total_batches: totalBatches,
          last_heartbeat: new Date().toISOString(),
          last_progress_update: new Date().toISOString()
        })
        .eq('id', jobId);
      
      console.log(`[enrich-lead-bg] Job ${jobId}: ${processedCount}/${leads.length} processed (${progressPercent}%)`);
    }
    
    // Mark job as completed
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_records: processedCount,
        enriched_records: enrichedCount,
        failed_records: failedCount,
        progress_percentage: 100
      })
      .eq('id', jobId);
    
    console.log(`[enrich-lead-bg] Job ${jobId} completed: ${enrichedCount} enriched, ${failedCount} failed`);
    
  } catch (error: any) {
    console.error(`[enrich-lead-bg] Job ${jobId} failed:`, error);
    
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error during background processing',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ALL API KEYS - DECLARED ONCE HERE AT TOP
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

const { 
  leads, 
  org_id, 
  save_to_db = false, 
  async_mode = false,
  force_external = false, // NEW: Skip internal DB matching, always use external sources
  job_id = null, // If provided, this is a background job continuation
  target_titles = ['CEO', 'President', 'Owner', 'Founder', 'VP', 'Director', 'Head of', 'Manager'] 
} = await req.json();

// Title classification for Level and Persona
const classifyTitle = (title: string): { level: string; persona: string } => {
  const t = (title || '').toLowerCase();
  if (/\b(ceo|chief executive|president|owner|founder|co-founder|managing partner|principal)\b/.test(t)) 
    return { level: 'C-Level', persona: 'Executive' };
  if (/\b(cfo|cto|coo|cmo|cio|ciso|chief)\b/.test(t)) 
    return { level: 'C-Level', persona: 'Executive' };
  if (/\b(evp|svp|vp|vice president)\b/.test(t)) 
    return { level: 'VP', persona: 'Senior Leadership' };
  if (/\b(director|head of|general manager)\b/.test(t)) 
    return { level: 'Director', persona: 'Decision Maker' };
  if (/\b(manager|supervisor|team lead|lead)\b/.test(t)) 
    return { level: 'Manager', persona: 'Influencer' };
  if (/\b(senior|sr\.|principal|staff)\b/.test(t)) 
    return { level: 'Senior', persona: 'Individual Contributor' };
  if (/\b(operations|ops)\b/.test(t)) 
    return { level: 'Manager', persona: 'Operations' };
  if (/\b(sales|account executive|ae|bdr|sdr)\b/.test(t)) 
    return { level: 'Individual Contributor', persona: 'Sales' };
  if (/\b(marketing|growth)\b/.test(t)) 
    return { level: 'Individual Contributor', persona: 'Marketing' };
  return { level: 'Individual Contributor', persona: 'End User' };
};

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

    // ASYNC MODE: For large batches, create job and process in background
    const ASYNC_THRESHOLD = 10; // Use async for 10+ leads
    const isLargeBatch = leads.length >= ASYNC_THRESHOLD;
    
    if (async_mode && isLargeBatch && !job_id) {
      console.log(`[enrich-lead] Async mode: Creating job for ${leads.length} leads`);
      
      // Create enrichment job
      const { data: newJob, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id,
          provider: 'ai',
          job_type: 'contacts',
          status: 'pending',
          total_records: leads.length,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0,
          can_pause: true,
          input_data: { leads, save_to_db, target_titles }
        })
        .select('id')
        .single();
      
      if (jobError || !newJob) {
        console.error('[enrich-lead] Failed to create job:', jobError);
        return new Response(JSON.stringify({ error: 'Failed to create enrichment job' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const createdJobId = newJob.id;
      console.log(`[enrich-lead] Created job ${createdJobId}, starting background processing`);
      
      // Start background processing using EdgeRuntime.waitUntil
      // @ts-ignore - EdgeRuntime is available in Deno Deploy
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processEnrichmentJobBackground(supabase, createdJobId, leads, org_id, save_to_db, target_titles));
      } else {
        // Fallback: invoke self with job_id (for local testing)
        supabase.functions.invoke('enrich-lead', {
          body: { leads, org_id, save_to_db, job_id: createdJobId, target_titles }
        }).catch(err => console.error('[enrich-lead] Background invoke failed:', err));
      }
      
      // Return immediately with job_id
      return new Response(JSON.stringify({
        success: true,
        async: true,
        job_id: createdJobId,
        message: `Enrichment job started for ${leads.length} leads`,
        total_records: leads.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // If this is a background job, update status to processing
    if (job_id) {
      await supabase
        .from('enrichment_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job_id);
    }

    console.log(`[enrich-lead] Processing ${leads.length} leads for org ${org_id}${job_id ? ` (job ${job_id})` : ''}`);

    const results: LeadEnrichmentResult[] = [];
    const stats = {
      total: leads.length,
      internal_matches: 0,
      names_extracted_from_email: 0,
      names_discovered_by_ai: 0,
      contacts_discovered: 0,
      sparse_leads_processed: 0,
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

    // Batch fetch accounts for matching - include company_main_phone for phone discovery
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('external_id, name, domain, company_main_phone')
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

    // =========================================
    // PHASE 0: Pre-process leads - Extract names from emails, identify sparse leads
    // =========================================
    console.log('[enrich-lead] Phase 0: Pre-processing leads');
    
    const processedLeads: LeadInput[] = [];
    
    for (const lead of leads as LeadInput[]) {
      const processedLead = { ...lead };
      
      // Phase 0a: Extract names from email if missing
      if (lead.email && !lead.first_name && !lead.last_name) {
        const extracted = extractNameFromEmail(lead.email);
        if (extracted.firstName) {
          processedLead.first_name = extracted.firstName;
          stats.names_extracted_from_email++;
          console.log(`[enrich-lead] Extracted name from email: ${lead.email} -> ${extracted.firstName} ${extracted.lastName || ''}`);
        }
        if (extracted.lastName) {
          processedLead.last_name = extracted.lastName;
        }
      }
      
      processedLeads.push(processedLead);
    }
    
    // Phase 0b: Identify sparse leads (company/domain but NO identifying info)
    const sparseLeads = processedLeads.filter(lead => {
      const hasCompany = lead.company || lead.domain;
      const hasIdentity = lead.email || lead.first_name || lead.linkedin_url;
      return hasCompany && !hasIdentity;
    });
    
    console.log(`[enrich-lead] Found ${sparseLeads.length} sparse leads (company-only, need discovery)`);
    
    // Phase 0c: Discover contacts for sparse leads using AI
    if (sparseLeads.length > 0 && LOVABLE_API_KEY) {
      console.log('[enrich-lead] Phase 0c: AI Contact Discovery for sparse leads');
      stats.sparse_leads_processed = sparseLeads.length;
      
      // Group by company/domain to avoid duplicate searches
      const uniqueCompanies = new Map<string, LeadInput>();
      for (const lead of sparseLeads) {
        const key = lead.domain || lead.company || '';
        if (key && !uniqueCompanies.has(key)) {
          uniqueCompanies.set(key, lead);
        }
      }
      
      // Discover contacts at each company
      for (const [companyKey, originalLead] of uniqueCompanies) {
        try {
          const discoveryPrompt = `Find current executives at ${originalLead.company || companyKey}${originalLead.domain ? ` (website: ${originalLead.domain})` : ''}.

Target roles: ${target_titles.join(', ')}

For EACH person found, provide:
- Full name (first and last)
- Current job title
- LinkedIn URL if findable
- Work email (try to find real one, or guess pattern: firstname.lastname@${originalLead.domain || 'company.com'})
- Direct phone number if publicly available

Return ONLY valid JSON array (no other text):
[{
  "first_name": "John",
  "last_name": "Smith",
  "title": "CEO",
  "email": "john.smith@company.com",
  "phone": "+1-555-123-4567",
  "linkedin_url": "https://linkedin.com/in/johnsmith",
  "confidence": 85
}]

Maximum 3 people. Only include people you're confident currently work there. If you can't find anyone, return empty array [].`;

          const discoveryResponse = await callAI('research', [
            { role: 'system', content: 'You are a business researcher specializing in finding executive contacts. Return ONLY valid JSON arrays.' },
            { role: 'user', content: discoveryPrompt }
          ]);

          if (discoveryResponse.ok) {
            const aiData = await discoveryResponse.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            
            if (jsonMatch) {
              try {
                const discoveredContacts = JSON.parse(jsonMatch[0]);
                console.log(`[enrich-lead] Discovered ${discoveredContacts.length} contacts at ${companyKey}`);
                
                for (const contact of discoveredContacts) {
                  if (contact.confidence < 50) continue;
                  
                  // Add discovered contact as a new lead to process
                  processedLeads.push({
                    first_name: contact.first_name,
                    last_name: contact.last_name,
                    email: contact.email,
                    title: contact.title,
                    linkedin_url: contact.linkedin_url,
                    phone: sanitizePhone(contact.phone) || undefined,
                    company: originalLead.company,
                    domain: originalLead.domain,
                    _discovered: true
                  });
                  stats.contacts_discovered++;
                }
              } catch (parseErr) {
                console.log(`[enrich-lead] Discovery parse error for ${companyKey}:`, parseErr);
              }
            }
          }
          
          stats.cost_estimate += 0.003; // ~$0.003 per Gemini call
        } catch (e) {
          console.error(`[enrich-lead] Discovery error for ${companyKey}:`, e);
        }
      }
      
      // Remove original sparse leads that have been replaced by discovered contacts
      const sparseKeys = new Set(sparseLeads.map(l => l.domain || l.company));
      const filteredLeads = processedLeads.filter(l => !sparseKeys.has(l.domain || l.company) || l._discovered);
      processedLeads.length = 0;
      processedLeads.push(...filteredLeads);
      
      console.log(`[enrich-lead] After discovery: ${processedLeads.length} leads to process`);
    }
    
    // Phase 0d: AI Name Discovery for leads with email but still no name
    const needsNameDiscovery = processedLeads.filter(lead => 
      lead.email && !lead.first_name && !lead.last_name && !lead._discovered
    );
    
    if (needsNameDiscovery.length > 0 && LOVABLE_API_KEY) {
      console.log(`[enrich-lead] Phase 0d: AI name discovery for ${needsNameDiscovery.length} email-only leads`);
      
      // Batch into groups of 10
      const batchSize = 10;
      for (let i = 0; i < needsNameDiscovery.length; i += batchSize) {
        const batch = needsNameDiscovery.slice(i, i + batchSize);
        
        const namePrompt = `Find the real names for these business email addresses:

${batch.map(l => `- ${l.email}${l.company ? ` (works at ${l.company})` : ''}`).join('\n')}

Return ONLY valid JSON array with the person's actual name:
[{"email": "john@company.com", "first_name": "John", "last_name": "Doe", "title": "CEO", "confidence": 85}]

Only include results where you're confident about the name. If unknown, omit that email.`;

        try {
          const nameResponse = await callAI('research', [
            { role: 'system', content: 'You are a business researcher. Find real names for email addresses. Return ONLY valid JSON.' },
            { role: 'user', content: namePrompt }
          ]);
          
          if (nameResponse.ok) {
            const aiData = await nameResponse.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            
            if (jsonMatch) {
              const names = JSON.parse(jsonMatch[0]);
              
              for (const found of names) {
                if (found.confidence < 50) continue;
                
                const leadIndex = processedLeads.findIndex(l => l.email?.toLowerCase() === found.email?.toLowerCase());
                if (leadIndex !== -1) {
                  processedLeads[leadIndex].first_name = found.first_name || processedLeads[leadIndex].first_name;
                  processedLeads[leadIndex].last_name = found.last_name || processedLeads[leadIndex].last_name;
                  if (found.title && !processedLeads[leadIndex].title) {
                    processedLeads[leadIndex].title = found.title;
                  }
                  stats.names_discovered_by_ai++;
                  console.log(`[enrich-lead] AI discovered name: ${found.email} -> ${found.first_name} ${found.last_name}`);
                }
              }
            }
          }
          
          stats.cost_estimate += 0.003;
        } catch (e) {
          console.error('[enrich-lead] AI name discovery error:', e);
        }
      }
    }

    // =========================================
    // PHASE 1: Internal Database Matching (SKIP if force_external=true)
    // =========================================
    console.log(`[enrich-lead] Phase 1: Internal database matching${force_external ? ' (SKIPPED - force_external=true)' : ''}`);
    
    // Process each lead - PRESERVE INPUT DATA AS BASELINE
    let needsExternalEnrichment: LeadInput[] = [];

    for (const lead of processedLeads) {
      // Initialize enriched_data with input values as baseline
      const result: LeadEnrichmentResult = {
        input: lead,
        enriched_data: {
          // Preserve input fields as baseline
          first_name: lead.first_name,
          last_name: lead.last_name,
          title: lead.title,
          phone: sanitizePhone(lead.phone) || undefined,
          linkedin_url: lead.linkedin_url,
          company: lead.company,
          domain: lead.domain,
        },
        source: lead._discovered ? 'discovered' : 'internal',
        confidence: lead._discovered ? 0.75 : 0,
        fields_filled: []
      };

      // SKIP internal matching if force_external is true - go straight to external sources
      if (force_external) {
        // Try to match account even when skipping internal lead matching
        const domain = lead.domain || (lead.email ? extractDomain(lead.email) : null);
        if (domain) {
          const matchedAccount = accountByDomain.get(domain);
          if (matchedAccount) {
            result.enriched_data.matched_account_id = matchedAccount.external_id;
            result.enriched_data.domain = matchedAccount.domain;
            result.enriched_data.company = matchedAccount.name || lead.company;
            stats.accounts_matched++;
          }
        }
        result.fields_filled = Object.keys(result.enriched_data).filter(k => result.enriched_data[k as keyof typeof result.enriched_data] != null);
        needsExternalEnrichment.push(lead);
        results.push(result);
        continue;
      }

      // Check for existing lead by email (only when NOT force_external)
      if (lead.email) {
        const existingLead = leadByEmail.get(lead.email.toLowerCase());
        
        // FIX: Only count as internal match if it actually has enriched data
        if (existingLead) {
          const hasEnrichmentData = existingLead.title || existingLead.phone || existingLead.linkedin_url;
          
          if (hasEnrichmentData) {
            result.enriched_data = {
              email: existingLead.email,
              email_verified: true,
              first_name: lead.first_name || existingLead.first_name,
              last_name: lead.last_name || existingLead.last_name,
              // Prefer enriched values but fallback to input
              title: existingLead.title || lead.title,
              phone: sanitizePhone(existingLead.phone) || sanitizePhone(lead.phone) || undefined,
              mobile: sanitizePhone(existingLead.mobile) || undefined,
              linkedin_url: existingLead.linkedin_url || lead.linkedin_url,
              company: existingLead.company || lead.company
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

            // FIX PHASE 1: Even for internal matches, still run phone discovery if missing mobile/direct
            const hasMobileOrDirect = existingLead.mobile || existingLead.direct_phone;
            if (!hasMobileOrDirect) {
              console.log(`[enrich-lead] Internal match ${lead.email} missing mobile/direct - adding to phone discovery`);
              needsExternalEnrichment.push(lead);
            }

            results.push(result);
            continue;
          }
        }
      }

      // Try to match account even if lead not found
      const domain = lead.domain || (lead.email ? extractDomain(lead.email) : null);
      if (domain) {
        const matchedAccount = accountByDomain.get(domain);
        if (matchedAccount) {
          result.enriched_data.matched_account_id = matchedAccount.external_id;
          result.enriched_data.domain = matchedAccount.domain;
          result.enriched_data.company = matchedAccount.name || lead.company;
          
          // FIX PHASE 5: Pull company_main_phone from matched account early
          if (matchedAccount.company_main_phone) {
            console.log(`[enrich-lead] Adding company main phone from account: ${matchedAccount.company_main_phone}`);
          }
          
          stats.accounts_matched++;
        }
      }

      // Calculate initial fields_filled
      result.fields_filled = Object.keys(result.enriched_data).filter(k => result.enriched_data[k as keyof typeof result.enriched_data] != null);
      
      needsExternalEnrichment.push(lead);
      results.push(result);
    }

    console.log(`[enrich-lead] Phase 0 stats: names_from_email=${stats.names_extracted_from_email}, names_from_ai=${stats.names_discovered_by_ai}, discovered=${stats.contacts_discovered}`);
    console.log(`[enrich-lead] Internal matches: ${stats.internal_matches}, need external: ${needsExternalEnrichment.length}`);

    // Phase 2: External Enrichment - COST OPTIMIZED ORDER
    // Cheap AI first (Gemini ~$0.003, Perplexity ~$0.005), expensive data providers last (Apollo/PDL use credits)

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
      
      // FIX PHASE 2: Search for contacts missing MOBILE phones, not just any phone
      const needsPhones = needsExternalEnrichment.filter(lead => {
        const phones = allPhonesByLead.get(lead.email || '') || [];
        const hasMobile = phones.some(p => p.type === 'mobile' || p.type === 'direct');
        return !hasMobile; // Run even if we have an office number
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
    if (FIRECRAWL_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2c: Firecrawl contact page scraping (low cost)');
      
      // FIX PHASE 2: Scrape for contacts missing MOBILE phones, not just any phone
      const needsFirecrawl = needsExternalEnrichment.filter(lead => {
        const phones = allPhonesByLead.get(lead.email || '') || [];
        const hasMobile = phones.some(p => p.type === 'mobile' || p.type === 'direct');
        return !hasMobile; // Run even if we have an office number
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
          
          const phoneArray = Array.from(foundPhones);
          
          // FIX PHASE 3: Get company main phone for classification
          const matchedAccount = accountByDomain.get(domain);
          const companyMainPhone = matchedAccount?.company_main_phone?.replace(/\D/g, '') || '';
          
          // FIX PHASE 3: Classify phones as main/direct/office based on context
          const classifyPhone = (phone: string, index: number): 'main' | 'direct' | 'office' => {
            const cleaned = phone.replace(/\D/g, '');
            // If it matches company main phone (last 7 digits), it's main
            if (companyMainPhone && cleaned.endsWith(companyMainPhone.slice(-7))) {
              return 'main';
            }
            // First non-main phone is likely direct line
            if (index === 0) return 'direct';
            // Additional phones are likely direct or office lines
            return index < 3 ? 'direct' : 'office';
          };
          
          // Assign phones to all leads at this domain
          for (const lead of leads) {
            const leadEmail = lead.email;
            if (!leadEmail) continue;

            const resultIndex = results.findIndex(r => r.input.email === leadEmail);
            if (resultIndex === -1) continue;

            // FIX PHASE 3: Create phone entries with proper type classification
            const firecrawlPhones: PhoneEntry[] = phoneArray.map((p, idx) => ({
              number: p,
              type: classifyPhone(p, idx),
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
          
          // FIX PHASE 6: Better phone type prioritization for mobile/direct assignment
          // Priority: mobile > direct > office > main for the primary phone field
          const mobilePhone = phones.find(p => p.type === 'mobile')?.number;
          const directPhone = phones.find(p => p.type === 'direct')?.number;
          const officePhone = phones.find(p => p.type === 'office' || p.type === 'main')?.number;
          
          // Use best available for primary phone (mobile preferred)
          const sanitizedPhone = sanitizePhone(mobilePhone) || sanitizePhone(directPhone) || sanitizePhone(officePhone) || sanitizePhone(enriched.phone) || sanitizePhone(lead.phone);
          const sanitizedMobile = sanitizePhone(mobilePhone) || sanitizePhone(enriched.mobile);
          const sanitizedDirectPhone = sanitizePhone(directPhone);
          
          console.log(`[enrich-lead] Phone assignment for ${leadEmail}: mobile=${sanitizedMobile}, direct=${sanitizedDirectPhone}, phone=${sanitizedPhone}`);
          
          // Fetch account firmographics if we have a matched account
          let accountFirmographics: any = {};
          if (enriched.matched_account_id) {
            const { data: accountData } = await supabase
              .from('accounts')
              .select('employee_count, revenue_range, industry_norm, industry_raw, sub_industry, city, state_province, country, hq_address, hq_city, hq_state, hq_postal_code, sic_code, naics, company_main_phone')
              .eq('external_id', enriched.matched_account_id)
              .eq('org_id', org_id)
              .maybeSingle();
            
            if (accountData) {
              accountFirmographics = {
                employee_count: accountData.employee_count,
                revenue_range: accountData.revenue_range,
                industry: accountData.industry_norm || accountData.industry_raw,
                sub_industry: accountData.sub_industry,
                location_city: accountData.city || accountData.hq_city,
                state_province: accountData.state_province || accountData.hq_state,
                country: accountData.country,
                company_hq_address: accountData.hq_address,
                company_hq_city: accountData.hq_city,
                company_hq_state: accountData.hq_state,
                company_hq_postal_code: accountData.hq_postal_code,
                company_sic_code: accountData.sic_code,
                company_naics_code: accountData.naics,
                company_main_phone: sanitizePhone(accountData.company_main_phone),
              };
            }
          }
          
          // Classify title for level and persona
          const finalTitle = enriched.title || lead.title || '';
          const { level, persona } = classifyTitle(finalTitle);
          
          // Determine the ACTUAL source that provided enrichment data
          // Only use 'internal' if we truly got data from internal DB
          let actualSource = result.source;
          if (force_external && actualSource === 'internal') {
            // If force_external was used, determine source from where data came
            const phones = enriched.phones || [];
            if (phones.length > 0) {
              // Use the source of the first discovered phone
              actualSource = phones[0].source as any || 'ai';
            } else if (stats.gemini_enriched > 0) {
              actualSource = 'gemini';
            } else if (stats.perplexity_enriched > 0) {
              actualSource = 'perplexity';
            } else if (stats.firecrawl_enriched > 0) {
              actualSource = 'firecrawl';
            } else {
              actualSource = 'ai';
            }
          }
          
          const leadData = {
            org_id,
            external_id: existingLead?.external_id || externalId,
            email: leadEmail,
            // CRITICAL: Preserve input first_name/last_name, use enriched as fallback
            first_name: lead.first_name || enriched.first_name,
            last_name: lead.last_name || enriched.last_name,
            // For other fields, prefer enriched values but fallback to input
            title: finalTitle || undefined,
            level: level || undefined,
            persona: persona || undefined,
            phone: sanitizedPhone || undefined,
            mobile: sanitizedMobile || undefined,
            direct_phone: sanitizedDirectPhone || undefined,
            phones: phonesJson,
            phone_sources: result.phone_sources,
            linkedin_url: enriched.linkedin_url || lead.linkedin_url,
            company: enriched.company || lead.company,
            website: enriched.domain || lead.domain,
            account_external_id: enriched.matched_account_id,
            enrichment_source: actualSource,
            enrichment_confidence: result.confidence,
            enriched_at: new Date().toISOString(),
            // Add firmographics from matched account
            ...accountFirmographics
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

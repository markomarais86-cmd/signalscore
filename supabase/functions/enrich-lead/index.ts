// Lead/Contact Enrichment - Person-focused data enrichment
// Enriches email, title, phone, LinkedIn for individual people
// NOW WITH: Name extraction from email, AI discovery for sparse leads

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

console.log('[enrich-lead] === EDGE FUNCTION LOADED ===');
console.log('[enrich-lead] Load timestamp:', new Date().toISOString());

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
    level?: string;
    persona?: string;
    phone?: string;
    mobile?: string;
    direct_phone?: string;
    linkedin_url?: string;
    company?: string;
    domain?: string;
    website?: string;
    matched_account_id?: string;
    phones?: PhoneEntry[];
    enrichment_source?: string;
    enrichment_confidence?: number;
    // Firmographic fields from account
    employee_count?: number;
    revenue_range?: string;
    industry?: string;
    sub_industry?: string;
    location_city?: string;
    state_province?: string;
    country?: string;
    company_hq_address?: string;
    company_hq_city?: string;
    company_hq_state?: string;
    company_hq_postal_code?: string;
    company_sic_code?: string;
    company_naics_code?: string;
    company_main_phone?: string;
    company_linkedin_url?: string;
    founded_year?: number;
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
  console.log('[enrich-lead] === REQUEST RECEIVED ===');
  console.log('[enrich-lead] Method:', req.method);
  console.log('[enrich-lead] Timestamp:', new Date().toISOString());
  console.log('[enrich-lead] URL:', req.url);

  // Health check endpoint for debugging deployment
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    console.log('[enrich-lead] Health check requested');
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      message: 'enrich-lead function is running'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[enrich-lead] Starting main try block...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[enrich-lead] Supabase client created');

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
      
      // Discover contacts at each company - MULTI-AI WATERFALL
      // Priority: Perplexity → Claude → Grok → Gemini (AI-first approach)
      for (const [companyKey, originalLead] of uniqueCompanies) {
        let discoverySucceeded = false;
        let discoveredContacts: any[] = [];
        
        const personName = [originalLead.first_name, originalLead.last_name].filter(Boolean).join(' ');
        const companyName = originalLead.company || companyKey;
        
        // ===== STEP 1: PERPLEXITY (Real-time web search) =====
        const PERPLEXITY_API_KEY_LOCAL = Deno.env.get('PERPLEXITY_API_KEY');
        if (PERPLEXITY_API_KEY_LOCAL && !discoverySucceeded) {
          try {
            let searchQuery: string;
            if (personName) {
              searchQuery = `Find contact information for ${personName} at ${companyName}. 
I need: email address, phone number, LinkedIn profile URL, job title.
Return ONLY valid JSON: {"email":"...","phone":"...","linkedin_url":"...","title":"...","first_name":"...","last_name":"..."}
If you can't find specific info, leave that field empty. Do not guess emails.`;
            } else {
              searchQuery = `Who is the owner, CEO, president, or key decision-maker at ${companyName}?
Find their: full name, email, phone number, LinkedIn URL, job title.
Return ONLY valid JSON array: [{"first_name":"...","last_name":"...","email":"...","phone":"...","linkedin_url":"...","title":"..."}]
Maximum 3 people. Only include real, verified information from web sources.`;
            }
            
            console.log(`[enrich-lead] 1/4 Perplexity discovery for: ${personName || 'executives'} at ${companyName}`);
            
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY_LOCAL}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                  { role: 'system', content: 'You are a business contact researcher. Return ONLY valid JSON with real, verified contact information found on the web. Never guess or fabricate data.' },
                  { role: 'user', content: searchQuery }
                ],
                temperature: 0.1
              })
            });
            
            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const content = perplexityData.choices?.[0]?.message?.content || '';
              
              console.log(`[enrich-lead] Perplexity response for ${companyKey}:`, content.substring(0, 200));
              
              const jsonMatch = content.match(/\[[\s\S]*?\]/) || content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  let contacts = JSON.parse(jsonMatch[0]);
                  if (!Array.isArray(contacts)) contacts = [contacts];
                  
                  for (const contact of contacts) {
                    if (contact.email || contact.phone || contact.linkedin_url) {
                      discoveredContacts.push({ ...contact, _source: 'perplexity' });
                      discoverySucceeded = true;
                    }
                  }
                  stats.cost_estimate += 0.005;
                  if (discoverySucceeded) stats.perplexity_enriched++;
                } catch (parseErr) {
                  console.log(`[enrich-lead] Perplexity JSON parse error:`, parseErr);
                }
              }
            }
          } catch (e) {
            console.error(`[enrich-lead] Perplexity discovery error for ${companyKey}:`, e);
          }
        }
        
        // ===== STEP 2: CLAUDE (Deep reasoning/verification) =====
        const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
        if (ANTHROPIC_API_KEY && !discoverySucceeded) {
          try {
            console.log(`[enrich-lead] 2/4 Claude discovery for: ${personName || 'executives'} at ${companyName}`);
            
            const claudePrompt = personName 
              ? `Find contact details for ${personName} at ${companyName}. Return JSON: {"first_name":"...","last_name":"...","email":"...","phone":"...","linkedin_url":"...","title":"..."}`
              : `Find executives at ${companyName}. Return JSON array: [{"first_name":"...","last_name":"...","email":"...","phone":"...","linkedin_url":"...","title":"..."}] Max 3 people.`;
            
            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                system: 'You are a business contact researcher. Return ONLY valid JSON with real contact information. Never fabricate data.',
                messages: [{ role: 'user', content: claudePrompt }]
              })
            });
            
            if (claudeResponse.ok) {
              const claudeData = await claudeResponse.json();
              const content = claudeData.content?.[0]?.text || '';
              
              console.log(`[enrich-lead] Claude response for ${companyKey}:`, content.substring(0, 200));
              
              const jsonMatch = content.match(/\[[\s\S]*?\]/) || content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  let contacts = JSON.parse(jsonMatch[0]);
                  if (!Array.isArray(contacts)) contacts = [contacts];
                  
                  for (const contact of contacts) {
                    if (contact.email || contact.phone || contact.linkedin_url) {
                      discoveredContacts.push({ ...contact, _source: 'claude' });
                      discoverySucceeded = true;
                    }
                  }
                  stats.cost_estimate += 0.003;
                  if (discoverySucceeded) console.log(`[enrich-lead] Claude found ${discoveredContacts.length} contacts`);
                } catch (parseErr) {
                  console.log(`[enrich-lead] Claude JSON parse error:`, parseErr);
                }
              }
            }
          } catch (e) {
            console.error(`[enrich-lead] Claude discovery error for ${companyKey}:`, e);
          }
        }
        
        // ===== STEP 3: GROK (X/Twitter social data) =====
        const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
        if (XAI_API_KEY && !discoverySucceeded) {
          try {
            console.log(`[enrich-lead] 3/4 Grok discovery for: ${personName || 'executives'} at ${companyName}`);
            
            const grokPrompt = personName
              ? `Search for ${personName} who works at ${companyName}. Find their: email, phone, LinkedIn, Twitter/X handle, job title. Return JSON: {"first_name":"...","last_name":"...","email":"...","phone":"...","linkedin_url":"...","twitter_url":"...","title":"..."}`
              : `Who runs ${companyName}? Find executives: name, email, phone, LinkedIn, Twitter. Return JSON array: [{"first_name":"...","last_name":"...","email":"...","phone":"...","linkedin_url":"...","twitter_url":"...","title":"..."}]`;
            
            const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'grok-3',
                messages: [
                  { role: 'system', content: 'You are a social media researcher. Find real contact info from X/Twitter and public sources. Return ONLY valid JSON.' },
                  { role: 'user', content: grokPrompt }
                ],
                temperature: 0.1
              })
            });
            
            if (grokResponse.ok) {
              const grokData = await grokResponse.json();
              const content = grokData.choices?.[0]?.message?.content || '';
              
              console.log(`[enrich-lead] Grok response for ${companyKey}:`, content.substring(0, 200));
              
              const jsonMatch = content.match(/\[[\s\S]*?\]/) || content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  let contacts = JSON.parse(jsonMatch[0]);
                  if (!Array.isArray(contacts)) contacts = [contacts];
                  
                  for (const contact of contacts) {
                    if (contact.email || contact.phone || contact.linkedin_url || contact.twitter_url) {
                      discoveredContacts.push({ ...contact, _source: 'grok' });
                      discoverySucceeded = true;
                    }
                  }
                  stats.cost_estimate += 0.005;
                  if (discoverySucceeded) console.log(`[enrich-lead] Grok found ${discoveredContacts.length} contacts`);
                } catch (parseErr) {
                  console.log(`[enrich-lead] Grok JSON parse error:`, parseErr);
                }
              }
            }
          } catch (e) {
            console.error(`[enrich-lead] Grok discovery error for ${companyKey}:`, e);
          }
        }
        
        // ===== STEP 4: GEMINI (Fast fallback via callAI) =====
        if (!discoverySucceeded) {
          try {
            console.log(`[enrich-lead] 4/4 Gemini/AI fallback for: ${companyName}`);
            
            const discoveryPrompt = `Find current executives at ${companyName}${originalLead.domain ? ` (website: ${originalLead.domain})` : ''}.

Target roles: ${target_titles.join(', ')}

For EACH person found, provide:
- Full name (first and last)
- Current job title
- LinkedIn URL if findable
- Work email (try to find real one, or guess pattern: firstname.lastname@${originalLead.domain || 'company.com'})
- Direct phone number if publicly available

Return ONLY valid JSON array:
[{"first_name": "John", "last_name": "Smith", "title": "CEO", "email": "john.smith@company.com", "phone": "+1-555-123-4567", "linkedin_url": "https://linkedin.com/in/johnsmith", "confidence": 85}]

Maximum 3 people. If you can't find anyone, return empty array [].`;

            const discoveryResponse = await callAI('research', [
              { role: 'system', content: 'You are a business researcher specializing in finding executive contacts. Return ONLY valid JSON arrays.' },
              { role: 'user', content: discoveryPrompt }
            ]);

            if (discoveryResponse.ok) {
              const aiData = await discoveryResponse.json();
              // Handle both OpenAI-style and Anthropic-style responses
              const content = aiData.choices?.[0]?.message?.content || aiData.content?.[0]?.text || '';
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              
              if (jsonMatch) {
                try {
                  const contacts = JSON.parse(jsonMatch[0]);
                  console.log(`[enrich-lead] Gemini/AI discovered ${contacts.length} contacts at ${companyKey}`);
                  
                  for (const contact of contacts) {
                    if (contact.confidence && contact.confidence < 50) continue;
                    discoveredContacts.push({ ...contact, _source: 'gemini' });
                  }
                  if (discoveredContacts.length > 0) {
                    discoverySucceeded = true;
                    stats.gemini_enriched++;
                  }
                } catch (parseErr) {
                  console.log(`[enrich-lead] Gemini discovery parse error:`, parseErr);
                }
              }
            }
            
            stats.cost_estimate += 0.003;
          } catch (e) {
            console.error(`[enrich-lead] Gemini discovery error for ${companyKey}:`, e);
          }
        }
        
        // ===== ADD DISCOVERED CONTACTS TO PROCESSING QUEUE =====
        for (const contact of discoveredContacts) {
          processedLeads.push({
            first_name: contact.first_name || originalLead.first_name,
            last_name: contact.last_name || originalLead.last_name,
            email: contact.email || undefined,
            title: contact.title || originalLead.title,
            linkedin_url: contact.linkedin_url || undefined,
            phone: sanitizePhone(contact.phone) || undefined,
            company: originalLead.company,
            domain: originalLead.domain,
            _discovered: true,
            _source: contact._source
          });
          stats.contacts_discovered++;
          console.log(`[enrich-lead] ${contact._source.toUpperCase()} discovered: ${contact.first_name} ${contact.last_name} at ${companyName}`);
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
      // CRITICAL: Set source to 'pending' initially - will be updated when external data is found
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
        source: lead._discovered ? 'discovered' : (force_external ? 'ai' : 'internal'),
        confidence: lead._discovered ? 0.75 : 0,
        fields_filled: []
      };

      // SKIP internal matching if force_external is true - go straight to external sources
      if (force_external) {
        console.log(`[enrich-lead] force_external=true: Skipping internal DB for ${lead.email}, using external sources`);
        // Try to match account even when skipping internal lead matching
        const domain = lead.domain || (lead.email ? extractDomain(lead.email) : null);
        if (domain) {
          const normalizedDomain = domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
          let matchedAccount = accountByDomain.get(normalizedDomain);
          if (matchedAccount) {
            result.enriched_data.matched_account_id = matchedAccount.external_id;
            result.enriched_data.domain = matchedAccount.domain;
            result.enriched_data.company = matchedAccount.name || lead.company;
            stats.accounts_matched++;
            console.log(`[enrich-lead] Matched account ${matchedAccount.external_id} for domain ${normalizedDomain}`);
          } else {
            // AUTO-CREATE AND ENRICH MISSING ACCOUNTS (same as non-force_external path)
            console.log(`[enrich-lead] No account for ${normalizedDomain} - auto-creating stub with enrichment`);
            
            const stubExternalId = `AUTO_${normalizedDomain.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
            
            try {
              // Create stub account
              const { data: newAccount, error: createErr } = await supabase
                .from('accounts')
                .upsert({
                  org_id,
                  external_id: stubExternalId,
                  domain: normalizedDomain,
                  name: lead.company || normalizedDomain.split('.')[0].charAt(0).toUpperCase() + normalizedDomain.split('.')[0].slice(1),
                  enrichment_phase: 'pending',
                  updated_at: new Date().toISOString()
                }, { onConflict: 'org_id,external_id' })
                .select()
                .single();
              
            if (newAccount && !createErr) {
              console.log(`[enrich-lead] Created stub account: ${stubExternalId} (id=${newAccount.id})`);
              stats.accounts_created = (stats.accounts_created || 0) + 1;
              
              // Immediately enrich the account with Firecrawl (cheap, fast)
              try {
                const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-with-firecrawl`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ domain: normalizedDomain, companyName: lead.company })
                });
                
                if (enrichResponse.ok) {
                  const enrichData = await enrichResponse.json();
                  console.log(`[enrich-lead] Firecrawl enrichment for ${normalizedDomain}:`, JSON.stringify(enrichData).slice(0, 300));
                  
                  // Update account with enriched data
                  if (enrichData.company) {
                    const accountUpdate = {
                      employee_count: enrichData.company.employee_count,
                      revenue_range: enrichData.company.revenue_range,
                      industry_raw: enrichData.company.industry,
                      city: enrichData.company.city,
                      hq_city: enrichData.company.city,
                      hq_state: enrichData.company.state,
                      country: enrichData.company.country,
                      company_main_phone: enrichData.company.phone,
                      linkedin_url: enrichData.company.linkedin_url,
                      founded_year: enrichData.company.founded_year,
                      enrichment_phase: 'completed',
                      enriched_at: new Date().toISOString(),
                      enriched_from: 'firecrawl'
                    };
                    
                    await supabase
                      .from('accounts')
                      .update(accountUpdate)
                      .eq('id', newAccount.id);
                    
                    // Add to accountByDomain map so lead can use it
                    const enrichedAccount = {
                      ...newAccount,
                      ...accountUpdate,
                      external_id: stubExternalId
                    };
                    accountByDomain.set(normalizedDomain, enrichedAccount);
                    matchedAccount = enrichedAccount;
                    
                    console.log(`[enrich-lead] Enriched account ${normalizedDomain}: emp=${enrichData.company.employee_count}, rev=${enrichData.company.revenue_range}, ind=${enrichData.company.industry}`);
                  }
                } else {
                  console.error(`[enrich-lead] Firecrawl failed for ${normalizedDomain}: ${enrichResponse.status}`);
                }
              } catch (e: any) {
                console.error(`[enrich-lead] Firecrawl enrichment failed for ${normalizedDomain}:`, e.message);
              }
              
              // Set matched account info even if enrichment failed
              result.enriched_data.matched_account_id = stubExternalId;
              result.enriched_data.domain = normalizedDomain;
              result.enriched_data.company = lead.company || normalizedDomain.split('.')[0];
              stats.accounts_matched++;
            } else if (createErr) {
                console.error(`[enrich-lead] Account creation failed for ${normalizedDomain}:`, {
                  code: createErr.code,
                  message: createErr.message,
                  details: createErr.details,
                  hint: createErr.hint
                });
              }
            } catch (e: any) {
              console.error(`[enrich-lead] Auto-create exception for ${normalizedDomain}:`, e.message);
            }
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
      let matchedAccount = null;
      
      if (domain) {
        // Normalize domain for lookup
        const normalizedDomain = domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
        matchedAccount = accountByDomain.get(normalizedDomain);
        if (matchedAccount) {
          result.enriched_data.matched_account_id = matchedAccount.external_id;
          result.enriched_data.account_external_id = matchedAccount.external_id; // ALSO SET THIS FOR CONSISTENCY
          result.enriched_data.domain = matchedAccount.domain || domain;
          result.enriched_data.company = matchedAccount.name || lead.company;
          
          // FIX PHASE 5: Pull company_main_phone from matched account early
          if (matchedAccount.company_main_phone) {
            console.log(`[enrich-lead] Adding company main phone from account: ${matchedAccount.company_main_phone}`);
          }
          
          stats.accounts_matched++;
        } else {
          // AUTO-CREATE AND ENRICH MISSING ACCOUNTS
          console.log(`[enrich-lead] No account for ${domain} - auto-creating stub with enrichment`);
          
          const stubExternalId = `AUTO_${domain.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
          
          try {
            // Create stub account
            const { data: newAccount, error: createErr } = await supabase
              .from('accounts')
              .upsert({
                org_id,
                external_id: stubExternalId,
                domain: domain,
                name: lead.company || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
                enrichment_phase: 'pending',
                updated_at: new Date().toISOString()
              }, { onConflict: 'org_id,external_id' })
              .select()
              .single();
            
            if (newAccount && !createErr) {
              console.log(`[enrich-lead] Created stub account: ${stubExternalId}`);
              stats.accounts_created = (stats.accounts_created || 0) + 1;
              
              // Immediately enrich the account with Firecrawl (cheap, fast)
              try {
                const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-with-firecrawl`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ domain, companyName: lead.company })
                });
                
                if (enrichResponse.ok) {
                  const enrichData = await enrichResponse.json();
                  console.log(`[enrich-lead] Firecrawl enrichment for ${domain}:`, JSON.stringify(enrichData).slice(0, 300));
                  
                  // Update account with enriched data
                  if (enrichData.company) {
                    const accountUpdate = {
                      employee_count: enrichData.company.employee_count,
                      revenue_range: enrichData.company.revenue_range,
                      industry_raw: enrichData.company.industry,
                      city: enrichData.company.city,
                      hq_city: enrichData.company.city,
                      hq_state: enrichData.company.state,
                      country: enrichData.company.country,
                      company_main_phone: enrichData.company.phone,
                      linkedin_url: enrichData.company.linkedin_url,
                      founded_year: enrichData.company.founded_year,
                      enrichment_phase: 'completed',
                      enriched_at: new Date().toISOString(),
                      enriched_from: 'firecrawl'
                    };
                    
                    await supabase
                      .from('accounts')
                      .update(accountUpdate)
                      .eq('id', newAccount.id);
                    
                    // Add to accountByDomain map so lead can use it
                    const enrichedAccount = {
                      ...newAccount,
                      ...accountUpdate,
                      external_id: stubExternalId
                    };
                    accountByDomain.set(domain, enrichedAccount);
                    matchedAccount = enrichedAccount;
                    
                    console.log(`[enrich-lead] Enriched account ${domain}: emp=${enrichData.company.employee_count}, rev=${enrichData.company.revenue_range}, ind=${enrichData.company.industry}`);
                  }
                } else {
                  console.error(`[enrich-lead] Firecrawl failed for ${domain}: ${enrichResponse.status}`);
                }
              } catch (e: any) {
                console.error(`[enrich-lead] Firecrawl enrichment failed for ${domain}:`, e.message);
              }
              
              // Set matched account info even if enrichment failed
              result.enriched_data.matched_account_id = stubExternalId;
              result.enriched_data.account_external_id = stubExternalId; // ALSO SET FOR CONSISTENCY
              result.enriched_data.domain = domain;
              result.enriched_data.company = lead.company || domain.split('.')[0];
            } else if (createErr) {
              console.error(`[enrich-lead] Account creation failed for ${domain}:`, {
                code: createErr.code,
                message: createErr.message,
                details: createErr.details,
                hint: createErr.hint
              });
            }
          } catch (e: any) {
            console.error(`[enrich-lead] Auto-create exception for ${domain}:`, e.message);
          }
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

    // Phase 2a: AI-First Phone Discovery Waterfall (Perplexity → Claude → Grok)
    // Run for ALL leads missing phones/mobiles, not just sparse leads
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    
    if (needsExternalEnrichment.length > 0 && (PERPLEXITY_API_KEY || ANTHROPIC_API_KEY || XAI_API_KEY)) {
      console.log('[enrich-lead] Phase 2a: AI-First Phone Discovery Waterfall (Perplexity → Claude → Grok)');
      
      // Find leads that need phone discovery (missing any phone)
      const needsPhoneDiscovery = needsExternalEnrichment.filter(lead => {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) return true;
        const enriched = results[resultIndex].enriched_data;
        return !enriched.phone && !enriched.mobile && !enriched.direct_phone;
      });
      
      console.log(`[enrich-lead] ${needsPhoneDiscovery.length}/${needsExternalEnrichment.length} leads need phone discovery`);
      
      for (const lead of needsPhoneDiscovery) {
        const resultIndex = results.findIndex(r => r.input.email === lead.email);
        if (resultIndex === -1) continue;
        
        const personName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
        const companyName = lead.company || lead.domain || '';
        
        if (!personName && !companyName) continue;
        
        let phoneFound = false;
        const discoveredPhones: PhoneEntry[] = [];
        
        // ===== STEP 1: PERPLEXITY (Real-time web search for full contact info) =====
        // Expanded to also discover: title, LinkedIn, last name, email status
        if (PERPLEXITY_API_KEY) {
          try {
            const needsLastName = !lead.last_name;
            const needsTitle = !results[resultIndex].enriched_data.title && !lead.title;
            const needsLinkedIn = !results[resultIndex].enriched_data.linkedin_url && !lead.linkedin_url;
            
            const discoveryQuery = `Find professional information for ${personName}${companyName ? ` at ${companyName}` : ''}${lead.email ? ` (email: ${lead.email})` : ''}.
Return ONLY valid JSON with ALL available data:
{
  "phone":"direct or mobile number if found",
  "phone_type":"mobile|direct|office",
  "title":"job title or role",
  "linkedin_url":"LinkedIn profile URL",
  "last_name":"last name if not provided",
  "email_valid":true if email appears current/valid,
  "confidence":0-100
}
Only include REAL data found on the web. Do not guess. Include null for fields not found.`;
            
            console.log(`[enrich-lead] AI Waterfall 1/3 Perplexity FULL discovery: ${personName} at ${companyName}`);
            
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                  { role: 'system', content: 'You are a professional contact researcher. Find real contact information from public web sources. Return ONLY valid JSON with ALL fields.' },
                  { role: 'user', content: discoveryQuery }
                ],
                temperature: 0.1
              })
            });
            
            if (perplexityResponse.ok) {
              const data = await perplexityResponse.json();
              const content = data.choices?.[0]?.message?.content || '';
              console.log(`[enrich-lead] Perplexity response: ${content.substring(0, 250)}`);
              
              const jsonMatch = content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  const contactData = JSON.parse(jsonMatch[0]);
                  
                  // Phone
                  if (contactData.phone && contactData.confidence >= 50 && !phoneFound) {
                    const sanitized = sanitizePhone(contactData.phone);
                    if (sanitized) {
                      discoveredPhones.push({
                        number: sanitized,
                        type: contactData.phone_type || 'direct',
                        source: 'perplexity',
                        confidence: contactData.confidence || 70
                      });
                      phoneFound = true;
                      stats.perplexity_enriched++;
                      console.log(`[enrich-lead] Perplexity found phone: ${sanitized}`);
                    }
                  }
                  
                  // Title (if not already set)
                  if (contactData.title && needsTitle) {
                    results[resultIndex].enriched_data.title = contactData.title;
                    console.log(`[enrich-lead] Perplexity found title: ${contactData.title}`);
                  }
                  
                  // LinkedIn URL
                  if (contactData.linkedin_url && needsLinkedIn && contactData.linkedin_url.includes('linkedin.com')) {
                    results[resultIndex].enriched_data.linkedin_url = contactData.linkedin_url;
                    console.log(`[enrich-lead] Perplexity found LinkedIn: ${contactData.linkedin_url}`);
                  }
                  
                  // Last name (if missing)
                  if (contactData.last_name && needsLastName) {
                    results[resultIndex].enriched_data.last_name = contactData.last_name;
                    console.log(`[enrich-lead] Perplexity found last name: ${contactData.last_name}`);
                  }
                  
                  // Email status
                  if (contactData.email_valid !== null && contactData.email_valid !== undefined) {
                    results[resultIndex].enriched_data.email_status = contactData.email_valid ? 'valid' : 'uncertain';
                    results[resultIndex].enriched_data.email_verified = contactData.email_valid;
                  }
                  
                } catch (e) {
                  console.log(`[enrich-lead] Perplexity JSON parse error:`, e);
                }
              }
            }
            stats.cost_estimate += 0.005;
          } catch (e) {
            console.error(`[enrich-lead] Perplexity discovery error:`, e);
          }
        }
        
        // ===== STEP 2: CLAUDE (Deep reasoning for missing fields) =====
        // Only call Claude if we still need data after Perplexity
        const stillNeedsTitle = !results[resultIndex].enriched_data.title && !lead.title;
        const stillNeedsLinkedIn = !results[resultIndex].enriched_data.linkedin_url && !lead.linkedin_url;
        const stillNeedsPhone = !phoneFound;
        
        if (ANTHROPIC_API_KEY && (stillNeedsPhone || stillNeedsTitle || stillNeedsLinkedIn)) {
          try {
            const claudePrompt = `Find professional contact information for ${personName}${companyName ? ` who works at ${companyName}` : ''}.
Return ONLY valid JSON with all available data:
{
  "phone":"phone number if found",
  "phone_type":"mobile|direct|office",
  "title":"job title/role",
  "linkedin_url":"LinkedIn profile URL",
  "confidence":0-100
}`;
            
            console.log(`[enrich-lead] AI Waterfall 2/3 Claude discovery: ${personName}`);
            
            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 512,
                system: 'You are a contact researcher. Find real contact information. Return ONLY valid JSON.',
                messages: [{ role: 'user', content: claudePrompt }]
              })
            });
            
            if (claudeResponse.ok) {
              const data = await claudeResponse.json();
              const content = data.content?.[0]?.text || '';
              console.log(`[enrich-lead] Claude response: ${content.substring(0, 200)}`);
              
              const jsonMatch = content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  const contactData = JSON.parse(jsonMatch[0]);
                  
                  // Phone
                  if (contactData.phone && contactData.confidence >= 50 && !phoneFound) {
                    const sanitized = sanitizePhone(contactData.phone);
                    if (sanitized) {
                      discoveredPhones.push({
                        number: sanitized,
                        type: contactData.phone_type || 'direct',
                        source: 'claude',
                        confidence: contactData.confidence || 65
                      });
                      phoneFound = true;
                      console.log(`[enrich-lead] Claude found phone: ${sanitized}`);
                    }
                  }
                  
                  // Title
                  if (contactData.title && stillNeedsTitle) {
                    results[resultIndex].enriched_data.title = contactData.title;
                    console.log(`[enrich-lead] Claude found title: ${contactData.title}`);
                  }
                  
                  // LinkedIn URL
                  if (contactData.linkedin_url && stillNeedsLinkedIn && contactData.linkedin_url.includes('linkedin.com')) {
                    results[resultIndex].enriched_data.linkedin_url = contactData.linkedin_url;
                    console.log(`[enrich-lead] Claude found LinkedIn: ${contactData.linkedin_url}`);
                  }
                  
                } catch (e) {
                  console.log(`[enrich-lead] Claude JSON parse error:`, e);
                }
              }
            }
            stats.cost_estimate += 0.003;
          } catch (e) {
            console.error(`[enrich-lead] Claude discovery error:`, e);
          }
        }
        
        // ===== STEP 3: GROK (X/Twitter social data) =====
        if (XAI_API_KEY && !phoneFound) {
          try {
            const grokPrompt = `Find phone number for ${personName}${companyName ? ` at ${companyName}` : ''} from X/Twitter or public sources.
Return ONLY valid JSON: {"phone":"...","phone_type":"mobile|direct|office","confidence":0-100}`;
            
            console.log(`[enrich-lead] AI Waterfall 3/3 Grok phone search: ${personName}`);
            
            const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'grok-3',
                messages: [
                  { role: 'system', content: 'You are a social media researcher. Find phone numbers from X/Twitter bios and public sources. Return ONLY valid JSON.' },
                  { role: 'user', content: grokPrompt }
                ],
                temperature: 0.1
              })
            });
            
            if (grokResponse.ok) {
              const data = await grokResponse.json();
              const content = data.choices?.[0]?.message?.content || '';
              console.log(`[enrich-lead] Grok phone response: ${content.substring(0, 150)}`);
              
              const jsonMatch = content.match(/\{[\s\S]*?\}/);
              if (jsonMatch) {
                try {
                  const phoneData = JSON.parse(jsonMatch[0]);
                  if (phoneData.phone && phoneData.confidence >= 50) {
                    const sanitized = sanitizePhone(phoneData.phone);
                    if (sanitized) {
                      discoveredPhones.push({
                        number: sanitized,
                        type: phoneData.phone_type || 'direct',
                        source: 'grok',
                        confidence: phoneData.confidence || 60
                      });
                      phoneFound = true;
                      console.log(`[enrich-lead] Grok found phone: ${sanitized}`);
                    }
                  }
                } catch (e) {
                  console.log(`[enrich-lead] Grok JSON parse error:`, e);
                }
              }
            }
            stats.cost_estimate += 0.005;
          } catch (e) {
            console.error(`[enrich-lead] Grok phone error:`, e);
          }
        }
        
        // Add discovered phones to the collection
        if (discoveredPhones.length > 0) {
          const existing = allPhonesByLead.get(lead.email || '') || [];
          allPhonesByLead.set(lead.email || '', [...existing, ...discoveredPhones]);
          stats.phones_found += discoveredPhones.length;
          
          // Update result with first discovered phone
          const bestPhone = discoveredPhones[0];
          if (bestPhone.type === 'mobile') {
            results[resultIndex].enriched_data.mobile = bestPhone.number;
          } else if (bestPhone.type === 'direct') {
            results[resultIndex].enriched_data.direct_phone = bestPhone.number;
          } else {
            results[resultIndex].enriched_data.phone = bestPhone.number;
          }
        }
        
        console.log(`[enrich-lead] AI Waterfall complete for ${personName}: ${discoveredPhones.length} phones found`);
      }
    }
    
    // Phase 2b: Gemini Phone Research (CHEAP - ~$0.003 per contact)
    if (LOVABLE_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2b: Gemini phone research (low cost)');
      
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

    // Phase 2c: Perplexity Contact Search (CHEAP - ~$0.005 per contact)
    if (PERPLEXITY_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2c: Perplexity phone search (low cost)');
      
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

    // Phase 2d: Firecrawl Contact Page Scraping (CHEAP - ~$0.002 per page)
    if (FIRECRAWL_API_KEY && needsExternalEnrichment.length > 0) {
      console.log('[enrich-lead] Phase 2d: Firecrawl contact page scraping (low cost)');
      
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

    // Attach collected phones, level/persona, AND FIRMOGRAPHICS to results for export
    // This ensures ALL data is in the response even when save_to_db=false
    for (const result of results) {
      const email = result.input.email;
      const lead = result.input;
      
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
        
        // CRITICAL: Also add level/persona to enriched_data for export
        const finalTitle = result.enriched_data.title || lead.title || '';
        const { level, persona } = classifyTitle(finalTitle);
        result.enriched_data.level = level;
        result.enriched_data.persona = persona;
        
        // CRITICAL FIX: Add phone to enriched_data from collected phones
        if (phones.length > 0) {
          const sortedPhones = [...phones].sort((a, b) => b.confidence - a.confidence);
          const mobilePhone = phones.find(p => p.type === 'mobile');
          const directPhone = phones.find(p => p.type === 'direct');
          
          // Set mobile/direct/phone fields based on discovered phones
          if (mobilePhone) {
            result.enriched_data.mobile = sanitizePhone(mobilePhone.number) || undefined;
          }
          if (directPhone) {
            result.enriched_data.direct_phone = sanitizePhone(directPhone.number) || undefined;
          }
          if (!result.enriched_data.phone) {
            result.enriched_data.phone = sanitizePhone(sortedPhones[0]?.number) || undefined;
          }
          
          result.source = sortedPhones[0].source as any;
        }
        
        // CRITICAL FIX: Fetch and attach firmographics for EVERY lead, not just save_to_db
        // Note: 'email' variable already declared at line 1986, reuse it
        const accountId = result.enriched_data.matched_account_id || result.enriched_data.account_external_id;
        
        if (accountId) {
          try {
            console.log(`[enrich-lead] Fetching firmographics for account: ${accountId}`);
            const { data: accountData, error: accountError } = await supabase
              .from('accounts')
              .select('employee_count, revenue_range, industry_norm, industry_raw, sub_industry, city, state_province, country, hq_address, hq_city, hq_state, hq_postal_code, sic_code, naics, company_main_phone, linkedin_url, founded_year, enriched_from')
              .eq('external_id', accountId)
              .eq('org_id', org_id)
              .maybeSingle();
            
            if (accountError) {
              console.error(`[enrich-lead] Firmographics query error:`, accountError);
            }
            
            if (accountData) {
              // Merge firmographics into enriched_data
              result.enriched_data.employee_count = accountData.employee_count;
              result.enriched_data.revenue_range = accountData.revenue_range;
              result.enriched_data.industry = accountData.industry_norm || accountData.industry_raw;
              result.enriched_data.sub_industry = accountData.sub_industry;
              result.enriched_data.location_city = accountData.city || accountData.hq_city;
              result.enriched_data.state_province = accountData.state_province || accountData.hq_state;
              result.enriched_data.country = accountData.country;
              result.enriched_data.company_hq_address = accountData.hq_address;
              result.enriched_data.company_hq_city = accountData.hq_city;
              result.enriched_data.company_hq_state = accountData.hq_state;
              result.enriched_data.company_hq_postal_code = accountData.hq_postal_code;
              result.enriched_data.company_sic_code = accountData.sic_code;
              result.enriched_data.company_naics_code = accountData.naics;
              result.enriched_data.company_main_phone = sanitizePhone(accountData.company_main_phone) || undefined;
              result.enriched_data.company_linkedin_url = accountData.linkedin_url;
              result.enriched_data.founded_year = accountData.founded_year;
              
              console.log(`[enrich-lead] FIRMOGRAPHICS attached for ${email}: emp=${accountData.employee_count}, rev=${accountData.revenue_range}, ind=${accountData.industry_norm || accountData.industry_raw}, city=${accountData.hq_city || accountData.city}`);
            } else {
              console.log(`[enrich-lead] No account data found for account_id=${accountId}`);
            }
          } catch (e: any) {
            console.error(`[enrich-lead] Firmographics fetch error for ${email}:`, e.message);
          }
        } else {
          // No account link - try to create one now based on domain
          const leadDomain = result.enriched_data.domain || (result.input.email ? extractDomain(result.input.email) : null);
          if (leadDomain) {
            console.log(`[enrich-lead] No account link for ${email} - attempting to create stub for ${leadDomain}`);
            const normalizedDomain = leadDomain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
            const stubExternalId = `stub_${normalizedDomain.replace(/[^a-z0-9]/gi, '_')}`;
            
            try {
              // Upsert stub account
              const { data: stubAccount, error: stubError } = await supabase
                .from('accounts')
                .upsert({
                  org_id,
                  external_id: stubExternalId,
                  domain: normalizedDomain,
                  name: result.enriched_data.company || normalizedDomain.split('.')[0],
                  enrichment_phase: 'pending',
                  updated_at: new Date().toISOString()
                }, { onConflict: 'org_id,external_id' })
                .select('external_id, employee_count, revenue_range, industry_norm, industry_raw, sub_industry, hq_city, hq_state, country, naics')
                .single();
              
              if (stubAccount && !stubError) {
                result.enriched_data.matched_account_id = stubAccount.external_id;
                result.enriched_data.account_external_id = stubAccount.external_id;
                
                // If stub has firmographics (from previous enrichment), attach them
                if (stubAccount.employee_count || stubAccount.industry_norm) {
                  result.enriched_data.employee_count = stubAccount.employee_count;
                  result.enriched_data.industry = stubAccount.industry_norm || stubAccount.industry_raw;
                  result.enriched_data.sub_industry = stubAccount.sub_industry;
                  result.enriched_data.company_hq_city = stubAccount.hq_city;
                  result.enriched_data.company_hq_state = stubAccount.hq_state;
                  result.enriched_data.country = stubAccount.country;
                  result.enriched_data.company_naics_code = stubAccount.naics;
                  console.log(`[enrich-lead] Created & attached stub account ${stubExternalId} with existing firmographics`);
                } else {
                  console.log(`[enrich-lead] Created stub account ${stubExternalId} - needs enrichment`);
                  // Trigger async account enrichment
                  supabase.functions.invoke('enrich-with-firecrawl', {
                    body: { domain: normalizedDomain, companyName: result.enriched_data.company }
                  }).catch(e => console.log(`[enrich-lead] Async firecrawl for ${normalizedDomain} failed:`, e.message));
                }
              } else if (stubError) {
                console.error(`[enrich-lead] Stub account creation failed:`, stubError.message);
              }
            } catch (e: any) {
              console.error(`[enrich-lead] Stub account exception for ${leadDomain}:`, e.message);
            }
          } else {
            console.log(`[enrich-lead] No domain for ${email} - cannot create account link`);
          }
        }
        
        // Update fields_filled after all enrichment
        result.fields_filled = Object.keys(result.enriched_data).filter(
          k => result.enriched_data[k as keyof typeof result.enriched_data] != null
        );
        
        // DIAGNOSTIC LOGGING: Track waterfall status for each lead
        console.log(`[enrich-lead] WATERFALL RESULT for ${email}:`, {
          phonesFound: phones.length,
          phoneSources: [...new Set(phones.map(p => p.source))],
          hasTitle: !!result.enriched_data.title,
          hasLevel: !!level,
          hasAccount: !!result.enriched_data.matched_account_id,
          hasFirmographics: !!result.enriched_data.employee_count || !!result.enriched_data.industry,
          fieldsFilled: result.fields_filled.length,
          source: result.source
        });
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
              .select('employee_count, revenue_range, industry_norm, industry_raw, sub_industry, city, state_province, country, hq_address, hq_city, hq_state, hq_postal_code, sic_code, naics, company_main_phone, linkedin_url, founded_year, enriched_from')
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
                company_linkedin_url: accountData.linkedin_url,
                founded_year: accountData.founded_year,
              };
              console.log(`[enrich-lead] Firmographics from account ${enriched.matched_account_id}: emp=${accountData.employee_count}, rev=${accountData.revenue_range}, ind=${accountData.industry_norm || accountData.industry_raw}, city=${accountData.hq_city || accountData.city}, source=${accountData.enriched_from}`);
            } else {
              console.log(`[enrich-lead] No account data found for ${enriched.matched_account_id}`);
            }
          } else {
            console.log(`[enrich-lead] No matched_account_id for ${leadEmail} - firmographics will be empty`);
          }
          
          // Classify title for level and persona - ALWAYS apply this
          const finalTitle = enriched.title || lead.title || '';
          const { level, persona } = classifyTitle(finalTitle);
          
          console.log(`[enrich-lead] Title classification for ${leadEmail}: title="${finalTitle}" => level="${level}", persona="${persona}"`);
          
          // Determine the ACTUAL source that provided enrichment data
          // CRITICAL: Never show 'internal' if force_external was used
          let actualSource = result.source;
          
          // Check what sources actually provided data for THIS specific lead
          const leadPhones = allPhonesByLead.get(leadEmail || '') || [];
          
          if (leadPhones.length > 0) {
            // Use the highest-confidence phone's source
            const sortedPhones = [...leadPhones].sort((a, b) => b.confidence - a.confidence);
            actualSource = sortedPhones[0].source as any;
            console.log(`[enrich-lead] Source from phones: ${actualSource} (${leadPhones.length} phones found)`);
          } else if (force_external || actualSource === 'internal') {
            // If no phones but force_external was used, check stats for this lead
            // Try to be more specific about source
            if (enriched.title && enriched.title !== lead.title) {
              // Title was enriched - likely from Gemini or Perplexity
              actualSource = stats.gemini_enriched > 0 ? 'gemini' : 
                             stats.perplexity_enriched > 0 ? 'perplexity' : 'ai';
            } else if (stats.gemini_enriched > 0) {
              actualSource = 'gemini';
            } else if (stats.perplexity_enriched > 0) {
              actualSource = 'perplexity';
            } else if (stats.firecrawl_enriched > 0) {
              actualSource = 'firecrawl';
            } else if (stats.apollo_enriched > 0) {
              actualSource = 'apollo';
            } else if (stats.pdl_enriched > 0) {
              actualSource = 'pdl';
            } else {
              actualSource = 'ai';
            }
          }
          
          console.log(`[enrich-lead] Final source for ${leadEmail}: ${actualSource}`);
          
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
          
          console.log(`[enrich-lead] SAVING lead ${leadEmail}:`, JSON.stringify({
            level: leadData.level,
            persona: leadData.persona,
            phone: leadData.phone,
            mobile: leadData.mobile,
            direct_phone: leadData.direct_phone,
            phones_count: phonesJson.length,
            enrichment_source: leadData.enrichment_source,
            account_firmographics: Object.keys(accountFirmographics)
          }));
          
          // Use the existing unique constraint on (org_id, external_id)
          const { data: savedData, error } = await supabase
            .from('Leads')
            .upsert(leadData, {
              onConflict: 'org_id,external_id',
              ignoreDuplicates: false
            })
            .select('id, email, level, persona, phone, mobile, enrichment_source');
            
          if (error) {
            console.error('[enrich-lead] SAVE FAILED for', leadEmail, ':', error.message, error.code, error.details);
            saveErrors++;
          } else {
            console.log(`[enrich-lead] SAVED ${leadEmail}:`, savedData);
            savedCount++;
            
            // CRITICAL: Update result.enriched_data with ALL saved values for export
            // This ensures the CSV export gets ALL the data including firmographics
            result.enriched_data = {
              ...result.enriched_data,
              // Personal fields
              first_name: leadData.first_name,
              last_name: leadData.last_name,
              title: leadData.title,
              level,
              persona,
              // Contact fields
              phone: sanitizedPhone || undefined,
              mobile: sanitizedMobile || undefined,
              direct_phone: sanitizedDirectPhone || undefined,
              phones: phonesJson,
              linkedin_url: leadData.linkedin_url,
              // Company fields
              company: leadData.company,
              website: leadData.website,
              domain: enriched.domain || lead.domain,
              matched_account_id: leadData.account_external_id,
              enrichment_source: actualSource,
              enrichment_confidence: result.confidence,
              // ALL firmographics from account
              ...accountFirmographics
            };
            result.source = actualSource;
            result.fields_filled = Object.keys(result.enriched_data).filter(
              k => result.enriched_data[k as keyof typeof result.enriched_data] != null
            );
          }
        } catch (e: any) {
          console.error('[enrich-lead] Save exception for', leadEmail, ':', e.message, e.stack);
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

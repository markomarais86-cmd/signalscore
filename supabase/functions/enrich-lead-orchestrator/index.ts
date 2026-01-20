// Lead Enrichment Orchestrator - Lightweight coordinator
// Calls enrich-person, enrich-contact-info, enrich-firmographics modules

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log('[enrich-lead-orchestrator] === EDGE FUNCTION LOADED ===');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  company?: string;
  domain?: string;
}

// Sanitize phone - reject boolean strings and invalid formats
const sanitizePhone = (phone: any): string | null => {
  if (!phone) return null;
  if (typeof phone === 'boolean') return null;
  if (phone === 'true' || phone === 'false') return null;
  const str = String(phone);
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.includes('555') || digits.includes('0000000')) return null;
  return str.trim();
};

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

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

serve(async (req) => {
  console.log('[enrich-lead-orchestrator] Request received:', req.method);

  // Health check
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      message: 'enrich-lead-orchestrator is running'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      leads, 
      org_id, 
      save_to_db = false, 
      async_mode = false,
      force_external = false,
      target_titles = ['CEO', 'President', 'Owner', 'Founder', 'VP', 'Director', 'Head of', 'Manager'] 
    } = await req.json();

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

    console.log(`[enrich-lead-orchestrator] Processing ${leads.length} leads for org ${org_id}`);

    const results: any[] = [];
    const stats = {
      total: leads.length,
      person_enriched: 0,
      contact_enriched: 0,
      firmographics_enriched: 0,
      phones_found: 0,
      accounts_matched: 0,
      failed: 0,
      cost_estimate: 0
    };

    // STEP 1: Enrich person data (names, titles, LinkedIn)
    console.log('[enrich-lead-orchestrator] Step 1: Person enrichment...');
    let personResults: any[] = [];
    try {
      const personResponse = await supabase.functions.invoke('enrich-person', {
        body: { leads, org_id, target_titles }
      });
      if (personResponse.data?.results) {
        personResults = personResponse.data.results;
        stats.person_enriched = personResponse.data.stats?.enriched || 0;
        stats.cost_estimate += personResponse.data.stats?.cost_estimate || 0;
        console.log(`[enrich-lead-orchestrator] Person enrichment: ${stats.person_enriched} enriched`);
      }
    } catch (e: any) {
      console.error('[enrich-lead-orchestrator] Person enrichment error:', e.message);
    }

    // Merge person results with original leads
    const enrichedLeads = leads.map((lead: LeadInput, idx: number) => ({
      ...lead,
      ...personResults[idx]?.enriched_data
    }));

    // STEP 2: Enrich contact info (phones, email verification)
    console.log('[enrich-lead-orchestrator] Step 2: Contact info enrichment...');
    let contactResults: any[] = [];
    try {
      const contactResponse = await supabase.functions.invoke('enrich-contact-info', {
        body: { leads: enrichedLeads, org_id }
      });
      if (contactResponse.data?.results) {
        contactResults = contactResponse.data.results;
        stats.contact_enriched = contactResponse.data.stats?.enriched || 0;
        stats.phones_found = contactResponse.data.stats?.phones_found || 0;
        stats.cost_estimate += contactResponse.data.stats?.cost_estimate || 0;
        console.log(`[enrich-lead-orchestrator] Contact enrichment: ${stats.phones_found} phones found`);
      }
    } catch (e: any) {
      console.error('[enrich-lead-orchestrator] Contact enrichment error:', e.message);
    }

    // Merge contact results
    const leadsWithContact = enrichedLeads.map((lead: any, idx: number) => ({
      ...lead,
      ...contactResults[idx]?.enriched_data,
      phones: contactResults[idx]?.phones || []
    }));

    // STEP 3: Enrich firmographics (company data)
    console.log('[enrich-lead-orchestrator] Step 3: Firmographics enrichment...');
    let firmographicsResults: any[] = [];
    try {
      const firmographicsResponse = await supabase.functions.invoke('enrich-firmographics', {
        body: { leads: leadsWithContact, org_id }
      });
      if (firmographicsResponse.data?.results) {
        firmographicsResults = firmographicsResponse.data.results;
        stats.firmographics_enriched = firmographicsResponse.data.stats?.enriched || 0;
        stats.accounts_matched = firmographicsResponse.data.stats?.accounts_matched || 0;
        stats.cost_estimate += firmographicsResponse.data.stats?.cost_estimate || 0;
        console.log(`[enrich-lead-orchestrator] Firmographics: ${stats.accounts_matched} accounts matched`);
      }
    } catch (e: any) {
      console.error('[enrich-lead-orchestrator] Firmographics enrichment error:', e.message);
    }

    // Build final results
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const person = personResults[i]?.enriched_data || {};
      const contact = contactResults[i]?.enriched_data || {};
      const firmographics = firmographicsResults[i]?.enriched_data || {};
      const phones = contactResults[i]?.phones || [];

      const finalTitle = person.title || lead.title || '';
      const { level, persona } = classifyTitle(finalTitle);

      const enriched_data = {
        // Person data
        email: person.email || lead.email,
        email_verified: contact.email_verified,
        first_name: person.first_name || lead.first_name,
        last_name: person.last_name || lead.last_name,
        title: finalTitle,
        level,
        persona,
        linkedin_url: person.linkedin_url || lead.linkedin_url,
        
        // Contact data
        phone: sanitizePhone(contact.phone) || sanitizePhone(lead.phone),
        mobile: sanitizePhone(contact.mobile),
        direct_phone: sanitizePhone(contact.direct_phone),
        phones,
        
        // Company data
        company: firmographics.company || person.company || lead.company,
        domain: firmographics.domain || (lead.email ? extractDomain(lead.email) : lead.domain),
        matched_account_id: firmographics.matched_account_id,
        
        // Firmographics
        employee_count: firmographics.employee_count,
        revenue_range: firmographics.revenue_range,
        industry: firmographics.industry,
        sub_industry: firmographics.sub_industry,
        location_city: firmographics.location_city,
        state_province: firmographics.state_province,
        country: firmographics.country,
        company_hq_city: firmographics.company_hq_city,
        company_hq_state: firmographics.company_hq_state,
        company_main_phone: firmographics.company_main_phone,
        company_linkedin_url: firmographics.company_linkedin_url,
        founded_year: firmographics.founded_year,
        company_naics_code: firmographics.company_naics_code,
        company_sic_code: firmographics.company_sic_code,
        
        enrichment_source: firmographics.enriched_from || contact.source || person.source || 'orchestrator'
      };

      const fields_filled = Object.keys(enriched_data).filter(
        k => enriched_data[k as keyof typeof enriched_data] != null
      );

      results.push({
        input: lead,
        enriched_data,
        source: enriched_data.enrichment_source,
        confidence: firmographicsResults[i]?.confidence || contactResults[i]?.confidence || 0.7,
        fields_filled,
        phone_sources: contactResults[i]?.phone_sources || {}
      });
    }

    // Save to database if requested
    if (save_to_db) {
      console.log('[enrich-lead-orchestrator] Saving to database...');
      let savedCount = 0;
      
      for (const result of results) {
        const lead = result.input;
        const enriched = result.enriched_data;
        
        const leadEmail = enriched.email || lead.email;
        if (!leadEmail) continue;
        
        const externalId = `lead_${leadEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        
        const leadData = {
          org_id,
          external_id: externalId,
          email: leadEmail,
          first_name: enriched.first_name || lead.first_name,
          last_name: enriched.last_name || lead.last_name,
          title: enriched.title,
          level: enriched.level,
          persona: enriched.persona,
          phone: enriched.phone,
          mobile: enriched.mobile,
          direct_phone: enriched.direct_phone,
          linkedin_url: enriched.linkedin_url,
          company: enriched.company,
          account_external_id: enriched.matched_account_id,
          enriched_at: new Date().toISOString(),
          enriched_from: enriched.enrichment_source
        };

        const { error } = await supabase
          .from('Leads')
          .upsert(leadData, { onConflict: 'org_id,external_id' });
        
        if (!error) savedCount++;
      }
      
      console.log(`[enrich-lead-orchestrator] Saved ${savedCount}/${results.length} leads`);
    }

    console.log('[enrich-lead-orchestrator] Complete:', stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats: {
        ...stats,
        total: results.length,
        enriched: results.filter(r => r.fields_filled.length > 3).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-lead-orchestrator] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

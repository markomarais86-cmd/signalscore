// Slim Lead Enrichment - Lightweight lead/contact enrichment
// Under 500 lines for reliable deployment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log('[enrich-lead-slim] === LOADED ===');

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

// Sanitize phone
const sanitizePhone = (phone: any): string | null => {
  if (!phone) return null;
  if (typeof phone === 'boolean' || phone === 'true' || phone === 'false') return null;
  const str = String(phone);
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7 || digits.includes('555')) return null;
  return str.trim();
};

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email?.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// Extract name from email
const extractNameFromEmail = (email: string): { firstName?: string; lastName?: string } => {
  if (!email) return {};
  const localPart = email.split('@')[0].toLowerCase();
  const genericPrefixes = ['info', 'admin', 'contact', 'support', 'sales', 'hello', 'team'];
  if (genericPrefixes.some(p => localPart.startsWith(p))) return {};
  
  if (localPart.includes('.') || localPart.includes('_')) {
    const sep = localPart.includes('.') ? '.' : '_';
    const parts = localPart.split(sep);
    if (parts.length >= 2) {
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return { firstName: cap(parts[0]), lastName: cap(parts[parts.length - 1]) };
    }
  }
  return {};
};

// Classify title to Level and Persona
const classifyTitle = (title: string): { level: string; persona: string } => {
  const t = (title || '').toLowerCase();
  if (/\b(ceo|chief executive|president|owner|founder|managing partner)\b/.test(t)) 
    return { level: 'C-Level', persona: 'Executive' };
  if (/\b(cfo|cto|coo|cmo|cio|ciso|chief)\b/.test(t)) 
    return { level: 'C-Level', persona: 'Executive' };
  if (/\b(evp|svp|vp|vice president)\b/.test(t)) 
    return { level: 'VP', persona: 'Senior Leadership' };
  if (/\b(director|head of)\b/.test(t)) 
    return { level: 'Director', persona: 'Decision Maker' };
  if (/\b(manager|supervisor|team lead|lead)\b/.test(t)) 
    return { level: 'Manager', persona: 'Influencer' };
  if (/\b(senior|sr\.|principal|staff)\b/.test(t)) 
    return { level: 'Senior', persona: 'Individual Contributor' };
  return { level: 'Individual Contributor', persona: 'End User' };
};

serve(async (req) => {
  console.log('[enrich-lead-slim] Request:', req.method);

  // Health check
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      function: 'enrich-lead-slim'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');

    const { leads, org_id, save_to_db = true } = await req.json();
    
    if (!leads || !Array.isArray(leads)) {
      throw new Error('leads array is required');
    }
    if (!org_id) {
      throw new Error('org_id is required');
    }

    console.log(`[enrich-lead-slim] Processing ${leads.length} leads for org ${org_id}`);
    
    const results: any[] = [];
    
    for (const lead of leads as LeadInput[]) {
      const email = lead.email?.toLowerCase().trim();
      const domain = lead.domain || extractDomain(email || '');
      
      // Start with input data
      let enrichedData: any = {
        email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        title: lead.title,
        mobile: sanitizePhone(lead.phone),
        linkedin_url: lead.linkedin_url,
        company: lead.company,
        domain,
      };

      // Extract name from email if not provided
      if (!enrichedData.first_name && email) {
        const extracted = extractNameFromEmail(email);
        enrichedData.first_name = extracted.firstName;
        enrichedData.last_name = enrichedData.last_name || extracted.lastName;
      }

      // Classify title
      if (enrichedData.title) {
        const { level, persona } = classifyTitle(enrichedData.title);
        enrichedData.level = level;
        enrichedData.persona = persona;
      }

      // Try to find matching account for firmographics
      let matchedAccount: any = null;
      if (domain) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('*')
          .eq('org_id', org_id)
          .or(`domain.ilike.%${domain}%,domain_normalized.ilike.%${domain}%`)
          .limit(1);
        
        if (accounts?.[0]) {
          matchedAccount = accounts[0];
          console.log(`[enrich-lead-slim] Found account match: ${matchedAccount.name}`);
          
          // Add firmographics from account
          enrichedData.company = enrichedData.company || matchedAccount.name;
          enrichedData.industry = matchedAccount.industry_norm;
          enrichedData.employee_count = matchedAccount.employee_count;
          enrichedData.revenue_range = matchedAccount.revenue_range;
          enrichedData.hq_city = matchedAccount.hq_city || matchedAccount.city;
          enrichedData.hq_state = matchedAccount.hq_state || matchedAccount.state_province;
          enrichedData.country = matchedAccount.country;
          enrichedData.linkedin_company = matchedAccount.linkedin_url;
        }
      }

      // AI enrichment for missing contact data
      if (PERPLEXITY_API_KEY && email && (!enrichedData.title || !enrichedData.mobile)) {
        try {
          console.log(`[enrich-lead-slim] AI enrichment for ${email}`);
          const personName = [enrichedData.first_name, enrichedData.last_name].filter(Boolean).join(' ');
          
          const aiResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar-pro',
              messages: [{
                role: 'user',
                content: `Find contact information for: ${personName || email} at ${enrichedData.company || domain}.
                
Return ONLY valid JSON (no markdown):
{
  "title": "job title if found",
  "phone": "direct phone number if found", 
  "linkedin_url": "LinkedIn profile URL if found"
}

Return null for any field not found with high confidence. Phone must be real business number.`
              }],
              max_tokens: 200,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            
            // Parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.title && !enrichedData.title) {
                enrichedData.title = parsed.title;
                const { level, persona } = classifyTitle(parsed.title);
                enrichedData.level = level;
                enrichedData.persona = persona;
              }
              if (parsed.phone && !enrichedData.mobile) {
                enrichedData.mobile = sanitizePhone(parsed.phone);
              }
              if (parsed.linkedin_url && !enrichedData.linkedin_url) {
                enrichedData.linkedin_url = parsed.linkedin_url;
              }
              console.log(`[enrich-lead-slim] AI found: title=${parsed.title}, phone=${parsed.phone ? 'yes' : 'no'}`);
            }
          }
        } catch (aiError) {
          console.error('[enrich-lead-slim] AI error:', aiError);
        }
      }

      // Email verification with Hunter
      if (HUNTER_API_KEY && email) {
        try {
          const hunterUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`;
          const hunterResp = await fetch(hunterUrl);
          if (hunterResp.ok) {
            const hunterData = await hunterResp.json();
            enrichedData.email_status = hunterData.data?.status || 'unknown';
            enrichedData.email_verified = hunterData.data?.status === 'valid';
          }
        } catch (e) {
          console.error('[enrich-lead-slim] Hunter error:', e);
        }
      }

      // Save to database if requested
      if (save_to_db) {
        try {
          const leadRecord: any = {
            org_id,
            email: enrichedData.email,
            first_name: enrichedData.first_name,
            last_name: enrichedData.last_name,
            title: enrichedData.title,
            level: enrichedData.level,
            persona: enrichedData.persona,
            mobile: enrichedData.mobile,
            linkedin_url: enrichedData.linkedin_url,
            company: enrichedData.company,
            industry: enrichedData.industry,
            employee_count: enrichedData.employee_count,
            revenue_range: enrichedData.revenue_range,
            hq_city: enrichedData.hq_city,
            hq_state: enrichedData.hq_state,
            country: enrichedData.country,
            domain: enrichedData.domain,
            data_source: 'enrichment_wizard',
            enrichment_status: 'enriched',
            enriched_at: new Date().toISOString(),
          };

          // Link to account if found
          if (matchedAccount) {
            leadRecord.account_external_id = matchedAccount.external_id;
          }

          // Upsert by email
          if (email) {
            const { data: savedLead, error: saveError } = await supabase
              .from('Leads')
              .upsert(leadRecord, { onConflict: 'email,org_id' })
              .select()
              .single();
            
            if (saveError) {
              console.error('[enrich-lead-slim] Save error:', saveError);
            } else {
              console.log('[enrich-lead-slim] Saved lead:', savedLead?.id);
            }
          }
        } catch (saveError) {
          console.error('[enrich-lead-slim] DB save error:', saveError);
        }
      }

      results.push({
        input: lead,
        enriched_data: enrichedData,
        account_matched: !!matchedAccount,
        account_name: matchedAccount?.name,
      });
    }

    const stats = {
      total: leads.length,
      enriched: results.length,
      with_title: results.filter(r => r.enriched_data.title).length,
      with_phone: results.filter(r => r.enriched_data.mobile).length,
      with_firmographics: results.filter(r => r.account_matched).length,
    };

    console.log('[enrich-lead-slim] Complete:', stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats,
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[enrich-lead-slim] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// Contact Info Enrichment - Phones, email verification
// Part of the modular enrichment system

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log('[enrich-contact-info] === EDGE FUNCTION LOADED ===');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize phone
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

interface PhoneEntry {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  source: string;
  confidence: number;
}

serve(async (req) => {
  console.log('[enrich-contact-info] Request received');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const { leads, org_id } = await req.json();

    if (!leads || !Array.isArray(leads)) {
      return new Response(JSON.stringify({ error: 'leads array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-contact-info] Processing ${leads.length} leads`);

    const results: any[] = [];
    const allPhones = new Map<string, PhoneEntry[]>();
    const stats = { enriched: 0, phones_found: 0, emails_verified: 0, cost_estimate: 0 };

    // Phase 1: AI Phone Discovery (Perplexity)
    if (PERPLEXITY_API_KEY) {
      console.log('[enrich-contact-info] Phase 1: Perplexity phone search');
      
      const needsPhone = leads.filter((l: any) => !l.phone && !l.mobile && l.first_name && l.company);
      
      for (const lead of needsPhone.slice(0, 20)) { // Limit to 20 for cost
        const personName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
        const companyName = lead.company;
        
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [{
                role: 'user',
                content: `Find the phone number for ${personName} at ${companyName}. 
Return ONLY valid JSON: {"phone":"...","phone_type":"mobile|direct|office","confidence":0-100}`
              }],
              temperature: 0.1
            })
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            
            if (jsonMatch) {
              const phoneData = JSON.parse(jsonMatch[0]);
              if (phoneData.phone && phoneData.confidence >= 50) {
                const sanitized = sanitizePhone(phoneData.phone);
                if (sanitized) {
                  const entry: PhoneEntry = {
                    number: sanitized,
                    type: phoneData.phone_type || 'direct',
                    source: 'perplexity',
                    confidence: phoneData.confidence
                  };
                  
                  const key = lead.email || `${lead.first_name}_${lead.company}`;
                  const existing = allPhones.get(key) || [];
                  allPhones.set(key, [...existing, entry]);
                  stats.phones_found++;
                  
                  console.log(`[enrich-contact-info] Found phone for ${personName}: ${sanitized}`);
                }
              }
            }
          }
          stats.cost_estimate += 0.005;
        } catch (e: any) {
          console.error(`[enrich-contact-info] Perplexity error for ${personName}:`, e.message);
        }
      }
    }

    // Phase 2: Gemini Phone Research
    if (LOVABLE_API_KEY) {
      console.log('[enrich-contact-info] Phase 2: Gemini phone research');
      
      const stillNeedsPhone = leads.filter((l: any) => {
        const key = l.email || `${l.first_name}_${l.company}`;
        return !allPhones.has(key) && l.first_name && l.company;
      });

      if (stillNeedsPhone.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < Math.min(stillNeedsPhone.length, 30); i += batchSize) {
          const batch = stillNeedsPhone.slice(i, i + batchSize);
          
          try {
            const prompt = `Find phone numbers for these business contacts:
${batch.map((l: any) => `- ${l.first_name} ${l.last_name || ''} at ${l.company}`).join('\n')}

Return ONLY valid JSON array:
[{"name":"John Smith","phone":"+1-555-123-4567","phone_type":"mobile|direct|office","confidence":0-100}]`;

            const response = await fetch('https://ai.lovable.dev/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gemini-2.0-flash',
                messages: [
                  { role: 'system', content: 'You are a business researcher. Find phone numbers. Return ONLY valid JSON.' },
                  { role: 'user', content: prompt }
                ]
              })
            });

            if (response.ok) {
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content || '';
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              
              if (jsonMatch) {
                const phones = JSON.parse(jsonMatch[0]);
                
                for (const found of phones) {
                  if (found.confidence < 50) continue;
                  
                  const sanitized = sanitizePhone(found.phone);
                  if (!sanitized) continue;
                  
                  // Find matching lead
                  const matchedLead = batch.find((l: any) => 
                    found.name?.toLowerCase().includes(l.first_name?.toLowerCase())
                  );
                  
                  if (matchedLead) {
                    const key = matchedLead.email || `${matchedLead.first_name}_${matchedLead.company}`;
                    const existing = allPhones.get(key) || [];
                    allPhones.set(key, [...existing, {
                      number: sanitized,
                      type: found.phone_type || 'direct',
                      source: 'gemini',
                      confidence: found.confidence
                    }]);
                    stats.phones_found++;
                  }
                }
              }
            }
            stats.cost_estimate += 0.003;
          } catch (e: any) {
            console.error('[enrich-contact-info] Gemini error:', e.message);
          }
        }
      }
    }

    // Phase 3: Email verification with Hunter
    if (HUNTER_API_KEY) {
      console.log('[enrich-contact-info] Phase 3: Hunter email verification');
      
      const emailsToVerify = leads.filter((l: any) => l.email).slice(0, 50);
      
      for (const lead of emailsToVerify) {
        try {
          const response = await fetch(
            `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(lead.email)}&api_key=${HUNTER_API_KEY}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.data) {
              const key = lead.email;
              const existing = allPhones.get(key) || [];
              // Store verification result in phones map (we'll extract later)
              allPhones.set(key, existing);
              
              // Tag lead as verified
              lead._email_verified = data.data.status === 'valid' || data.data.result === 'deliverable';
              if (lead._email_verified) stats.emails_verified++;
            }
          }
        } catch (e: any) {
          console.error(`[enrich-contact-info] Hunter error for ${lead.email}:`, e.message);
        }
      }
    }

    // Build results
    for (const lead of leads) {
      const key = lead.email || `${lead.first_name}_${lead.company}`;
      const phones = allPhones.get(key) || [];
      
      // Sort by confidence
      const sortedPhones = [...phones].sort((a, b) => b.confidence - a.confidence);
      const mobilePhone = phones.find(p => p.type === 'mobile');
      const directPhone = phones.find(p => p.type === 'direct');
      
      const enriched_data = {
        email: lead.email,
        email_verified: lead._email_verified || false,
        phone: sanitizePhone(lead.phone) || sortedPhones[0]?.number,
        mobile: mobilePhone?.number,
        direct_phone: directPhone?.number
      };
      
      const hasEnrichment = phones.length > 0 || lead._email_verified;
      if (hasEnrichment) stats.enriched++;
      
      // Build phone sources map
      const phone_sources: Record<string, PhoneEntry[]> = {};
      for (const phone of phones) {
        if (!phone_sources[phone.source]) phone_sources[phone.source] = [];
        phone_sources[phone.source].push(phone);
      }
      
      results.push({
        input: lead,
        enriched_data,
        phones,
        phone_sources,
        source: sortedPhones[0]?.source || 'none',
        confidence: sortedPhones[0]?.confidence ? sortedPhones[0].confidence / 100 : 0.5,
        fields_filled: Object.keys(enriched_data).filter(k => enriched_data[k as keyof typeof enriched_data])
      });
    }

    console.log('[enrich-contact-info] Complete:', stats);

    return new Response(JSON.stringify({ 
      success: true, 
      results, 
      stats 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-contact-info] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

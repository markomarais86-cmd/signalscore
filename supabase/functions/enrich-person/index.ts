// Person Enrichment - Names, titles, LinkedIn discovery
// Part of the modular enrichment system

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log('[enrich-person] === EDGE FUNCTION LOADED ===');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract name from email address
const extractNameFromEmail = (email: string): { firstName?: string; lastName?: string } => {
  if (!email) return {};
  const localPart = email.split('@')[0].toLowerCase();
  
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
  
  const genericPrefixes = ['info', 'admin', 'contact', 'support', 'sales', 'hello', 'team', 'office', 'mail', 'no-reply', 'noreply'];
  if (genericPrefixes.includes(localPart)) {
    return {};
  }
  
  if (/^[a-z]{4,15}$/.test(localPart)) {
    return { firstName: localPart.charAt(0).toUpperCase() + localPart.slice(1) };
  }
  
  return {};
};

// Check if email is generic/role-based
const isGenericEmail = (email: string): boolean => {
  if (!email) return false;
  const localPart = email.split('@')[0].toLowerCase();
  const genericPrefixes = ['info', 'admin', 'contact', 'support', 'sales', 'hello', 'team', 'office', 'mail', 'no-reply', 'noreply', 'general', 'billing', 'accounts'];
  return genericPrefixes.some(prefix => localPart === prefix || localPart.startsWith(prefix + '.'));
};

serve(async (req) => {
  console.log('[enrich-person] Request received');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    const { leads, org_id, target_titles = ['CEO', 'President', 'Owner', 'Founder', 'VP', 'Director'] } = await req.json();

    if (!leads || !Array.isArray(leads)) {
      return new Response(JSON.stringify({ error: 'leads array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-person] Processing ${leads.length} leads`);

    const results: any[] = [];
    const stats = { enriched: 0, names_from_email: 0, names_from_ai: 0, cost_estimate: 0 };

    // Phase 1: Extract names from emails
    const processedLeads = leads.map((lead: any) => {
      const result: any = { ...lead };
      
      if (lead.email && (!lead.first_name || !lead.last_name)) {
        const extracted = extractNameFromEmail(lead.email);
        if (extracted.firstName && !lead.first_name) {
          result.first_name = extracted.firstName;
          stats.names_from_email++;
        }
        if (extracted.lastName && !lead.last_name) {
          result.last_name = extracted.lastName;
        }
      }
      
      return result;
    });

    // Phase 2: AI discovery for sparse leads (company-only, no identity)
    const sparseLeads = processedLeads.filter((lead: any) => {
      const hasCompany = lead.company || lead.domain;
      const hasIdentity = lead.email || lead.first_name || lead.linkedin_url;
      return hasCompany && !hasIdentity;
    });

    if (sparseLeads.length > 0 && PERPLEXITY_API_KEY) {
      console.log(`[enrich-person] Discovering contacts for ${sparseLeads.length} sparse leads`);
      
      for (const lead of sparseLeads) {
        const companyName = lead.company || lead.domain;
        
        try {
          const searchQuery = `Who is the owner, CEO, president, or key decision-maker at ${companyName}?
Find their: full name, email, job title, LinkedIn URL.
Return ONLY valid JSON: {"first_name":"...","last_name":"...","email":"...","title":"...","linkedin_url":"..."}`;

          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                { role: 'system', content: 'You are a business contact researcher. Return ONLY valid JSON.' },
                { role: 'user', content: searchQuery }
              ],
              temperature: 0.1
            })
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            
            if (jsonMatch) {
              const contact = JSON.parse(jsonMatch[0]);
              const leadIdx = processedLeads.findIndex((l: any) => 
                (l.company || l.domain) === companyName && !l.email
              );
              
              if (leadIdx !== -1 && (contact.email || contact.first_name)) {
                processedLeads[leadIdx] = {
                  ...processedLeads[leadIdx],
                  first_name: contact.first_name || processedLeads[leadIdx].first_name,
                  last_name: contact.last_name || processedLeads[leadIdx].last_name,
                  email: contact.email,
                  title: contact.title,
                  linkedin_url: contact.linkedin_url,
                  _discovered: true
                };
                stats.names_from_ai++;
                console.log(`[enrich-person] Discovered: ${contact.first_name} ${contact.last_name} at ${companyName}`);
              }
            }
          }
          stats.cost_estimate += 0.005;
        } catch (e: any) {
          console.error(`[enrich-person] Discovery error for ${companyName}:`, e.message);
        }
      }
    }

    // Phase 3: AI name discovery for email-only leads
    const needsNameDiscovery = processedLeads.filter((lead: any) => 
      lead.email && !lead.first_name && !lead.last_name && !lead._discovered && !isGenericEmail(lead.email)
    );

    if (needsNameDiscovery.length > 0 && LOVABLE_API_KEY) {
      console.log(`[enrich-person] AI name discovery for ${needsNameDiscovery.length} leads`);
      
      const batchSize = 10;
      for (let i = 0; i < needsNameDiscovery.length; i += batchSize) {
        const batch = needsNameDiscovery.slice(i, i + batchSize);
        
        try {
          const prompt = `Find the real names for these business email addresses:
${batch.map((l: any) => `- ${l.email}${l.company ? ` (works at ${l.company})` : ''}`).join('\n')}

Return ONLY valid JSON array:
[{"email": "john@company.com", "first_name": "John", "last_name": "Doe", "title": "CEO", "confidence": 85}]`;

          const response = await fetch('https://ai.lovable.dev/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gemini-2.0-flash',
              messages: [
                { role: 'system', content: 'You are a business researcher. Find real names for email addresses. Return ONLY valid JSON.' },
                { role: 'user', content: prompt }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            
            if (jsonMatch) {
              const names = JSON.parse(jsonMatch[0]);
              
              for (const found of names) {
                if (found.confidence < 50) continue;
                
                const leadIdx = processedLeads.findIndex((l: any) => 
                  l.email?.toLowerCase() === found.email?.toLowerCase()
                );
                
                if (leadIdx !== -1) {
                  processedLeads[leadIdx].first_name = found.first_name || processedLeads[leadIdx].first_name;
                  processedLeads[leadIdx].last_name = found.last_name || processedLeads[leadIdx].last_name;
                  if (found.title) processedLeads[leadIdx].title = found.title;
                  stats.names_from_ai++;
                }
              }
            }
          }
          stats.cost_estimate += 0.003;
        } catch (e: any) {
          console.error('[enrich-person] AI name discovery error:', e.message);
        }
      }
    }

    // Build results
    for (let i = 0; i < leads.length; i++) {
      const original = leads[i];
      const enriched = processedLeads[i];
      
      const enriched_data = {
        email: enriched.email || original.email,
        first_name: enriched.first_name || original.first_name,
        last_name: enriched.last_name || original.last_name,
        title: enriched.title || original.title,
        linkedin_url: enriched.linkedin_url || original.linkedin_url,
        company: enriched.company || original.company,
        domain: enriched.domain || original.domain
      };
      
      const hasEnrichment = (enriched.first_name && !original.first_name) || 
                           (enriched.last_name && !original.last_name) ||
                           (enriched.title && !original.title) ||
                           enriched._discovered;
      
      if (hasEnrichment) stats.enriched++;
      
      results.push({
        input: original,
        enriched_data,
        source: enriched._discovered ? 'perplexity' : 'email_extract',
        confidence: enriched._discovered ? 0.75 : 0.85,
        fields_filled: Object.keys(enriched_data).filter(k => enriched_data[k as keyof typeof enriched_data])
      });
    }

    console.log('[enrich-person] Complete:', stats);

    return new Response(JSON.stringify({ 
      success: true, 
      results, 
      stats 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-person] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

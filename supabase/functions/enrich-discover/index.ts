import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAI } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sparse Data Discovery Function
 * 
 * When you only have company + title, this function discovers actual contacts
 * using AI-powered web search.
 */

interface DiscoverRequest {
  company: string;
  domain?: string;
  target_titles: string[];
  max_results?: number;
  org_id: string;
}

interface DiscoveredContact {
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  confidence: number;
  source: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: DiscoverRequest = await req.json();
    const { company, domain, target_titles, max_results = 5, org_id } = request;

    if (!company || !target_titles || target_titles.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'company and target_titles required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-discover] Discovering ${target_titles.join(', ')} at ${company}`);

    const discoveredContacts: DiscoveredContact[] = [];
    let totalCost = 0;

    // Step 1: Use Gemini to search for executives at the company
    try {
      const geminiPrompt = `Find the current people at ${company}${domain ? ` (${domain})` : ''} who hold these positions: ${target_titles.join(', ')}.

For each person found, provide:
- Full name
- Exact current title
- LinkedIn URL if known
- Email pattern guess based on company domain (e.g., firstname.lastname@${domain || 'company.com'})

Return as JSON array:
[{
  "full_name": "John Smith",
  "title": "VP of Sales",
  "linkedin_url": "https://linkedin.com/in/johnsmith",
  "email_guess": "john.smith@company.com",
  "confidence": 0.8
}]

Only include people you're confident currently work at ${company}. Maximum ${max_results} results.`;

      const geminiResponse = await callAI({
        provider: 'lovable',
        messages: [{ role: 'user', content: geminiPrompt }],
        temperature: 0.2,
        maxTokens: 2000,
      });

      if (geminiResponse?.content) {
        const jsonMatch = geminiResponse.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const geminiContacts = JSON.parse(jsonMatch[0]);
          for (const contact of geminiContacts) {
            discoveredContacts.push({
              first_name: contact.full_name?.split(' ')[0] || null,
              last_name: contact.full_name?.split(' ').slice(1).join(' ') || null,
              full_name: contact.full_name,
              title: contact.title,
              email: contact.email_guess || null,
              phone: null,
              linkedin_url: contact.linkedin_url || null,
              confidence: (contact.confidence || 0.7) * 100,
              source: 'gemini'
            });
          }
          totalCost += 0.003; // Estimated Gemini cost
        }
      }
    } catch (e) {
      console.error('[enrich-discover] Gemini error:', e);
    }

    // Step 2: Use Perplexity to verify and enhance discovered contacts
    if (PERPLEXITY_API_KEY && discoveredContacts.length > 0) {
      try {
        const perplexityPrompt = `Verify these people work at ${company} and find their contact details:

${discoveredContacts.map(c => `- ${c.full_name}, ${c.title}`).join('\n')}

For each person, confirm:
1. They currently work at ${company}
2. Their exact current title
3. Their LinkedIn profile URL
4. Their professional email if publicly available
5. Their phone number if publicly available

Return as JSON array with confirmed information only:
[{
  "full_name": "John Smith",
  "verified": true,
  "title": "VP of Sales",
  "linkedin_url": "...",
  "email": "...",
  "phone": "..."
}]`;

        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: perplexityPrompt }],
            temperature: 0.1,
            max_tokens: 2000
          })
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          const content = perplexityData.choices?.[0]?.message?.content;
          
          if (content) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const verifiedContacts = JSON.parse(jsonMatch[0]);
              
              // Merge Perplexity data into discovered contacts
              for (const verified of verifiedContacts) {
                const existing = discoveredContacts.find(
                  c => c.full_name.toLowerCase() === verified.full_name?.toLowerCase()
                );
                
                if (existing && verified.verified) {
                  existing.title = verified.title || existing.title;
                  existing.linkedin_url = verified.linkedin_url || existing.linkedin_url;
                  existing.email = verified.email || existing.email;
                  existing.phone = verified.phone || existing.phone;
                  existing.confidence = Math.min(existing.confidence + 15, 95);
                  existing.source = 'gemini+perplexity';
                }
              }
              totalCost += 0.005; // Estimated Perplexity cost
            }
          }
        }
      } catch (e) {
        console.error('[enrich-discover] Perplexity error:', e);
      }
    }

    // Step 3: For contacts with high confidence but missing phones, try Gemini phone search
    const contactsNeedingPhones = discoveredContacts.filter(
      c => c.confidence >= 70 && !c.phone && c.full_name
    );

    if (contactsNeedingPhones.length > 0) {
      try {
        const phonePrompt = `Find phone numbers for these executives at ${company}:

${contactsNeedingPhones.map(c => `- ${c.full_name}, ${c.title}`).join('\n')}

Search for their direct office phone, mobile, or main company line.
Return as JSON:
[{
  "full_name": "John Smith",
  "phone": "+1-555-123-4567",
  "phone_type": "direct"
}]`;

        const phoneResponse = await callAI({
          provider: 'lovable',
          messages: [{ role: 'user', content: phonePrompt }],
          temperature: 0.2,
          maxTokens: 1000,
        });

        if (phoneResponse?.content) {
          const jsonMatch = phoneResponse.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const phones = JSON.parse(jsonMatch[0]);
            for (const phoneResult of phones) {
              const contact = discoveredContacts.find(
                c => c.full_name.toLowerCase() === phoneResult.full_name?.toLowerCase()
              );
              if (contact && phoneResult.phone) {
                contact.phone = phoneResult.phone;
              }
            }
            totalCost += 0.002;
          }
        }
      } catch (e) {
        console.error('[enrich-discover] Phone search error:', e);
      }
    }

    // Log cost
    if (org_id) {
      await supabase.from('enrichment_costs').insert({
        org_id,
        source: 'discover',
        record_type: 'lead',
        cost_usd: totalCost,
        fields_enriched: ['name', 'title', 'email', 'phone', 'linkedin'],
        success: discoveredContacts.length > 0
      });
    }

    console.log(`[enrich-discover] Found ${discoveredContacts.length} contacts, cost: $${totalCost.toFixed(4)}`);

    return new Response(JSON.stringify({
      success: true,
      company,
      target_titles,
      discovered_contacts: discoveredContacts.slice(0, max_results),
      total_found: discoveredContacts.length,
      cost_estimate: totalCost
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-discover] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

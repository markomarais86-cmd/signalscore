// Perplexity Contact Phone Enrichment - Web search for contact phone numbers
// Uses Perplexity's real-time web search to find phone numbers with citations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactInput {
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
}

interface PhoneResult {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  confidence: number;
  citation?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      console.log('[enrich-perplexity-contact] PERPLEXITY_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Perplexity not configured',
        results: [] 
      }), {
        status: 200, // Return 200 so enrichment continues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { contacts } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: 'contacts array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[enrich-perplexity-contact] Processing ${contacts.length} contacts`);

    const results: Array<{
      input: ContactInput;
      phones: PhoneResult[];
      citations: string[];
      cost_estimate: number;
    }> = [];

    // Process one at a time for Perplexity (rate limits)
    for (const contact of contacts as ContactInput[]) {
      try {
        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
        
        if (!fullName && !contact.email) {
          results.push({
            input: contact,
            phones: [],
            citations: [],
            cost_estimate: 0
          });
          continue;
        }

        // Build search query
        let searchQuery = `Find phone number for ${fullName}`;
        if (contact.company) searchQuery += ` at ${contact.company}`;
        if (contact.title) searchQuery += ` (${contact.title})`;
        if (contact.email) searchQuery += `. Email: ${contact.email}`;
        searchQuery += `. Return direct dial, mobile, or office phone number if available.`;

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { 
                role: 'system', 
                content: 'You are a business researcher finding phone numbers for professionals. Return ONLY valid JSON with no markdown. Format: {"phones": [{"number": "+1XXXXXXXXXX", "type": "direct|mobile|office", "confidence": 0-100}], "sources": ["url1", "url2"]}' 
              },
              { role: 'user', content: searchQuery }
            ],
            max_tokens: 300,
            search_recency_filter: 'month',
          }),
        });

        if (!response.ok) {
          console.error(`[enrich-perplexity-contact] API error: ${response.status}`);
          results.push({
            input: contact,
            phones: [],
            citations: [],
            cost_estimate: 0.005
          });
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const citations = data.citations || [];

        let phones: PhoneResult[] = [];
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            phones = (parsed.phones || []).filter((p: any) => {
              const cleaned = p.number?.replace(/\D/g, '');
              return cleaned && cleaned.length >= 10;
            }).map((p: any) => ({
              number: p.number.replace(/[^+\d]/g, ''),
              type: ['direct', 'mobile', 'office', 'main'].includes(p.type) ? p.type : 'office',
              confidence: Math.min(Math.max(p.confidence || 60, 0), 100),
              citation: citations[0] || undefined
            }));
          }
        } catch (e) {
          console.error('[enrich-perplexity-contact] Parse error:', e);
        }

        results.push({
          input: contact,
          phones,
          citations,
          cost_estimate: 0.005 // ~$0.005 per Perplexity request
        });

        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error('[enrich-perplexity-contact] Contact error:', error);
        results.push({
          input: contact,
          phones: [],
          citations: [],
          cost_estimate: 0
        });
      }
    }

    const totalPhones = results.reduce((sum, r) => sum + r.phones.length, 0);
    const totalCost = results.reduce((sum, r) => sum + r.cost_estimate, 0);

    console.log(`[enrich-perplexity-contact] Complete: ${totalPhones} phones found, ~$${totalCost.toFixed(4)} cost`);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats: {
        contacts_processed: results.length,
        phones_found: totalPhones,
        cost_estimate: totalCost
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enrich-perplexity-contact] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

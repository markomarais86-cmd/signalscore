// Gemini Phone Enrichment - Uses Google Gemini via Lovable AI Gateway
// Researches phone numbers for contacts using AI search capabilities

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
  source_detail?: string;
}

interface GeminiPhoneResponse {
  phones: PhoneResult[];
  sources_searched: string[];
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[enrich-gemini-phones] LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Gemini not configured',
        phones: [] 
      }), {
        status: 200, // Return 200 with empty phones so enrichment continues
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

    console.log(`[enrich-gemini-phones] Processing ${contacts.length} contacts via Gemini`);

    const results: Array<{
      input: ContactInput;
      phones: PhoneResult[];
      sources_searched: string[];
      reasoning: string;
      cost_estimate: number;
    }> = [];

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (contact: ContactInput) => {
        try {
          const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
          
          if (!fullName && !contact.email && !contact.linkedin_url) {
            return {
              input: contact,
              phones: [],
              sources_searched: [],
              reasoning: 'Insufficient contact information',
              cost_estimate: 0
            };
          }

          const prompt = `You are a professional researcher finding phone numbers for business contacts.

Find phone numbers for this professional:
- Name: ${fullName || 'Unknown'}
- Company: ${contact.company || 'Unknown'}
- Title: ${contact.title || 'Unknown'}
- Email: ${contact.email || 'Not provided'}
- LinkedIn: ${contact.linkedin_url || 'Not provided'}

Search for their phone numbers using:
1. Company website contact pages
2. LinkedIn profile (if available)
3. Business directories
4. Press releases or news articles
5. Corporate directories

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "phones": [
    {"number": "+1XXXXXXXXXX", "type": "direct", "confidence": 85},
    {"number": "+1XXXXXXXXXX", "type": "mobile", "confidence": 70}
  ],
  "sources_searched": ["company_website", "linkedin", "press_releases"],
  "reasoning": "Found direct line on company website contact page. Mobile number mentioned in a conference speaker bio."
}

IMPORTANT:
- Phone numbers must be in E.164 format (+1XXXXXXXXXX for US numbers)
- Confidence should be 0-100 based on source reliability
- Type must be one of: direct, mobile, office, main
- If no phones found, return empty phones array
- Be conservative - only include numbers you're confident about`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { 
                  role: 'system', 
                  content: 'You are a business researcher specializing in finding contact information. Always respond with valid JSON only, no markdown formatting.' 
                },
                { role: 'user', content: prompt }
              ],
              max_tokens: 500,
              temperature: 0.1,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[enrich-gemini-phones] Gemini API error: ${response.status} - ${errorText}`);
            return {
              input: contact,
              phones: [],
              sources_searched: [],
              reasoning: `API error: ${response.status}`,
              cost_estimate: 0.002 // Charge for failed attempt
            };
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          
          // Parse the JSON response
          let parsed: GeminiPhoneResponse = { phones: [], sources_searched: [], reasoning: '' };
          
          try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsed = JSON.parse(jsonMatch[0]);
            }
          } catch (parseError) {
            console.error('[enrich-gemini-phones] Failed to parse Gemini response:', content);
          }

          // Validate and clean phone numbers
          const validPhones = (parsed.phones || []).filter((p: PhoneResult) => {
            // Basic phone validation - must look like a phone number
            const cleaned = p.number?.replace(/\D/g, '');
            return cleaned && cleaned.length >= 10 && cleaned.length <= 15;
          }).map((p: PhoneResult) => ({
            ...p,
            number: p.number.replace(/[^+\d]/g, ''), // Clean to just + and digits
            confidence: Math.min(Math.max(p.confidence || 50, 0), 100),
            type: ['direct', 'mobile', 'office', 'main'].includes(p.type) ? p.type : 'office'
          }));

          // Estimate cost: ~500 input tokens + 200 output tokens at Gemini pricing
          const costEstimate = 0.003; // ~$0.003 per request

          return {
            input: contact,
            phones: validPhones,
            sources_searched: parsed.sources_searched || [],
            reasoning: parsed.reasoning || '',
            cost_estimate: costEstimate
          };

        } catch (error) {
          console.error('[enrich-gemini-phones] Error processing contact:', error);
          return {
            input: contact,
            phones: [],
            sources_searched: [],
            reasoning: `Error: ${error.message}`,
            cost_estimate: 0
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const totalPhones = results.reduce((sum, r) => sum + r.phones.length, 0);
    const totalCost = results.reduce((sum, r) => sum + r.cost_estimate, 0);

    console.log(`[enrich-gemini-phones] Complete: ${totalPhones} phones found, ~$${totalCost.toFixed(4)} cost`);

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
    console.error('[enrich-gemini-phones] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icpName, targetSegment, campaignGoals, industries, geographies } = await req.json();
    console.log('[generate-campaign-name] Request:', { icpName, targetSegment, campaignGoals });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context for AI
    const context = `
ICP: ${icpName}
Target Segment: ${targetSegment || 'General'}
Campaign Goals: ${campaignGoals || 'Lead generation'}
Industries: ${industries?.join(', ') || 'All'}
Geographies: ${geographies?.join(', ') || 'All'}
`;

    const systemPrompt = `You are a B2B campaign naming expert. Generate creative, professional campaign names that:
- Are memorable and concise (3-5 words)
- Reflect the target segment and value proposition
- Use industry-standard naming conventions (e.g., Q1-2025, geographic indicators, persona focus)
- Avoid generic terms like "outreach" or "campaign"

Return exactly 5 campaign name suggestions as a JSON array of strings.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 5 campaign names for:\n${context}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_campaign_names",
            description: "Return 5 campaign name suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 5,
                  maxItems: 5
                }
              },
              required: ["suggestions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_campaign_names" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-campaign-name] AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[generate-campaign-name] AI response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const suggestions = JSON.parse(toolCall.function.arguments).suggestions;

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-campaign-name] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

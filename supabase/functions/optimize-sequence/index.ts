// Optimize Sequence - AI-powered sales engagement optimization
// Migrated to use centralized AI config with OpenAI as primary

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetPersona, marketSegment, avgDealSize, accountCount } = await req.json();
    console.log('[optimize-sequence] Request:', { targetPersona, marketSegment, avgDealSize, accountCount });

    const providers = getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No AI provider configured. Please set OPENAI_API_KEY, ABACUS_API_KEY, or LOVABLE_API_KEY.');
    }

    const context = `
Target Persona: ${targetPersona || 'Decision makers'}
Market Segment: ${marketSegment || 'General'}
Average Deal Size: $${avgDealSize?.toLocaleString() || 'Unknown'}
Account Count: ${accountCount || 'Unknown'}
`;

    const systemPrompt = `You are a sales engagement expert. Analyze the target persona and recommend:
1. The best sequence template (Enterprise, SMB, or Partner)
2. Optimal timing adjustments (spacing between touchpoints)
3. Channel mix recommendations (email, phone, LinkedIn)
4. Personalization tips specific to this audience

Provide actionable, data-driven recommendations.`;

    const response = await callAI('analysis', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Optimize sequence for:\n${context}` }
    ], {
      tools: [{
        type: 'function',
        function: {
          name: 'recommend_sequence',
          description: 'Return sequence optimization recommendations',
          parameters: {
            type: 'object',
            properties: {
              recommendedTemplate: {
                type: 'string',
                enum: ['enterprise', 'smb', 'partner']
              },
              reasoning: { type: 'string' },
              timingAdjustments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    step: { type: 'number' },
                    adjustment: { type: 'string' }
                  }
                }
              },
              channelMix: {
                type: 'object',
                properties: {
                  email: { type: 'number' },
                  phone: { type: 'number' },
                  linkedin: { type: 'number' }
                }
              },
              personalizationTips: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['recommendedTemplate', 'reasoning', 'channelMix', 'personalizationTips'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'recommend_sequence' } }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[optimize-sequence] AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const recommendations = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(recommendations),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[optimize-sequence] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

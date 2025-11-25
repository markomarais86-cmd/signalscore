import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { account_id, company_name, domain, org_id } = await req.json();

    if (!company_name || !org_id) {
      throw new Error('company_name and org_id are required');
    }

    console.log(`Enriching funding data for: ${company_name}`);

    // Use Lovable AI to research funding information
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a funding research analyst. Based on the company name and domain, estimate funding information. Return ONLY valid JSON with fields: total_raised_usd (number or null), last_funding_round (string like "Series A" or null), last_funding_date (YYYY-MM-DD or null). Use null if no reliable information is available.'
          },
          {
            role: 'user',
            content: `Research funding information for company: ${company_name}${domain ? ` (${domain})` : ''}. Return ONLY valid JSON with total_raised_usd, last_funding_round, last_funding_date.`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API error:', error);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '{}';
    
    // Parse funding data from AI response
    let fundingData: any = {};
    try {
      fundingData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      fundingData = {};
    }

    console.log(`Discovered funding data:`, fundingData);

    // Update account with funding data
    if (account_id) {
      const updateData: any = {
        enriched_at: new Date().toISOString(),
        enriched_from: 'ai_funding',
      };

      if (fundingData.total_raised_usd !== undefined) {
        updateData.total_raised_usd = fundingData.total_raised_usd;
      }
      if (fundingData.last_funding_round !== undefined) {
        updateData.last_funding_round = fundingData.last_funding_round;
      }
      if (fundingData.last_funding_date !== undefined) {
        updateData.last_funding_date = fundingData.last_funding_date;
      }

      const { error: updateError } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', account_id)
        .eq('org_id', org_id);

      if (updateError) {
        console.error('Error updating account:', updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        company_name,
        funding_data: fundingData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in enrich-funding-data function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

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

    const { account_id, domain, org_id } = await req.json();

    if (!domain || !org_id) {
      throw new Error('domain and org_id are required');
    }

    console.log(`Enriching tech stack for domain: ${domain}`);

    // Use Lovable AI to discover tech stack
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
            content: 'You are a technology stack analyst. Based on the company domain, identify likely technologies they use. Return ONLY a JSON array of technology names (max 10). Example: ["React", "AWS", "PostgreSQL"]'
          },
          {
            role: 'user',
            content: `Analyze the technology stack for company with domain: ${domain}. Consider common patterns, industry standards, and publicly available information. Return ONLY a JSON array of technology names.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API error:', error);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '[]';
    
    // Parse tech stack from AI response
    let techStack: string[] = [];
    try {
      techStack = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      techStack = [];
    }

    console.log(`Discovered tech stack:`, techStack);

    // Update account with tech stack
    if (account_id) {
      const { error: updateError } = await supabase
        .from('accounts')
        .update({
          tech_stack: techStack,
          enriched_at: new Date().toISOString(),
          enriched_from: 'ai_tech_stack',
        })
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
        domain,
        tech_stack: techStack,
        count: techStack.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in enrich-tech-stack function:', error);
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

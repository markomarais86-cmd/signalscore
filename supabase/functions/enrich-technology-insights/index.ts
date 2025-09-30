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
    const { accountIds, orgId } = await req.json();
    
    if (!accountIds || !orgId) {
      throw new Error('Missing required parameters: accountIds and orgId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Enriching ${accountIds.length} accounts for org ${orgId}`);

    // Fetch accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .in('external_id', accountIds);

    if (accountsError) throw accountsError;

    const enrichedAccounts = [];

    for (const account of accounts) {
      console.log(`Analyzing account: ${account.name}`);
      
      const prompt = `You are a B2B technology intelligence analyst. Analyze this company and provide insights about their likely technology stack, digital maturity, and buying signals.

Company Information:
- Name: ${account.name}
- Industry: ${account.industry_norm || account.industry_raw}
- Size: ${account.employee_count} employees
- Revenue: ${account.revenue_range}
- Location: ${account.country}

Based on this profile, provide:
1. Likely tech stack (3-5 key technologies they probably use)
2. Digital maturity level (1-5 scale with explanation)
3. Top 3 buying signals or triggers
4. Recommended engagement approach

Keep your response concise and actionable.`;

      // Call Lovable AI Gateway
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
              content: 'You are a B2B technology intelligence analyst. Provide concise, actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (aiResponse.status === 402) {
          throw new Error('Insufficient AI credits. Please add funds to your workspace.');
        }
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const insights = aiData.choices?.[0]?.message?.content;

      enrichedAccounts.push({
        account_id: account.external_id,
        account_name: account.name,
        ai_insights: insights,
        enriched_at: new Date().toISOString()
      });

      console.log(`Enriched account: ${account.name}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedAccounts.length,
        results: enrichedAccounts
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in enrich-technology-insights:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getModelConfig, buildHeaders, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-provider AI call with fallback
async function callAIWithFallback(messages: Array<{ role: string; content: string }>): Promise<any> {
  const providers = getAvailableProviders();
  console.log(`[Tech Insights] Available AI providers: ${providers.join(', ')}`);
  
  for (const provider of providers) {
    try {
      const config = getModelConfig('enrichment', provider);
      const headers = buildHeaders(provider);
      
      const body: any = {
        model: config.model,
        messages,
      };
      body[config.maxTokensParam] = 1000;
      
      console.log(`[Tech Insights] Trying ${provider} with model ${config.model}`);
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        console.log(`[Tech Insights] Success with ${provider}`);
        return await response.json();
      }
      
      const errorText = await response.text();
      console.error(`[Tech Insights] ${provider} error (${response.status}): ${errorText}`);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient AI credits. Please add funds to your workspace.');
      }
    } catch (error) {
      console.error(`[Tech Insights] ${provider} failed:`, error);
      if ((error as Error).message.includes('Rate limit') || (error as Error).message.includes('Insufficient')) {
        throw error;
      }
    }
  }
  
  throw new Error('All AI providers failed');
}

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

IMPORTANT: At the very end of your response, include a JSON array of technology names on its own line, formatted exactly like this:
TECH_STACK_JSON: ["Technology1", "Technology2", "Technology3"]

Include specific product names (e.g., "Epic EHR", "Salesforce", "AWS", "Cerner", "Athenahealth") not generic categories. Keep your analysis concise and actionable.`;

      try {
        const aiData = await callAIWithFallback([
          {
            role: 'system',
            content: 'You are a B2B technology intelligence analyst. Provide concise, actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]);

        const insights = aiData.choices?.[0]?.message?.content;

        // Extract tech stack JSON from response
        let techStack: string[] = [];
        if (insights) {
          const techMatch = insights.match(/TECH_STACK_JSON:\s*(\[.*?\])/s);
          if (techMatch) {
            try {
              techStack = JSON.parse(techMatch[1]);
            } catch (e) {
              console.error(`Failed to parse tech stack JSON for ${account.name}:`, e);
            }
          }
        }

        // Persist tech_stack to accounts table if extracted
        if (techStack.length > 0) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ tech_stack: techStack })
            .eq('external_id', account.external_id)
            .eq('org_id', orgId);

          if (updateError) {
            console.error(`Failed to update tech_stack for ${account.name}:`, updateError);
          } else {
            console.log(`Persisted ${techStack.length} tech stack items for ${account.name}`);
          }
        }

        // Clean insights text (remove the JSON line for display)
        const cleanInsights = insights?.replace(/\nTECH_STACK_JSON:.*$/s, '').trim();

        enrichedAccounts.push({
          account_id: account.external_id,
          account_name: account.name,
          ai_insights: cleanInsights,
          tech_stack: techStack,
          enriched_at: new Date().toISOString()
        });

        console.log(`Enriched account: ${account.name}`);
      } catch (aiError) {
        console.error(`Failed to enrich ${account.name}:`, aiError);
        enrichedAccounts.push({
          account_id: account.external_id,
          account_name: account.name,
          ai_insights: null,
          error: (aiError as Error).message,
          enriched_at: new Date().toISOString()
        });
      }
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
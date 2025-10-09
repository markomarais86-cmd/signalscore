import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { org_id } = await req.json();
    
    // Get current accounts data for analysis
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id)
      .limit(100);

    if (accountsError) throw accountsError;

    // Get existing ICP profiles for context
    const { data: icps, error: icpError } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id);

    if (icpError) throw icpError;

    // Analyze data to generate recommendations
    const dataAnalysis = analyzeAccountData(accounts);
    
    const prompt = `You are an expert B2B sales strategist analyzing CRM data to recommend the optimal Ideal Customer Profile (ICP).

CURRENT DATA ANALYSIS:
- Total Accounts: ${dataAnalysis.totalAccounts}
- Top Industries: ${dataAnalysis.topIndustries.join(', ')}
- Common Company Sizes: ${dataAnalysis.companySizes.join(', ')}
- Top Countries: ${dataAnalysis.topCountries.join(', ')}
- Revenue Ranges: ${dataAnalysis.revenueRanges.join(', ')}

EXISTING ICPs: ${icps.length > 0 ? icps.map(icp => icp.name).join(', ') : 'None'}

Based on this data, provide a specific ICP recommendation in the following format:
"Based on your data, the best ICP looks like [JOB TITLES] in [INDUSTRIES] ([GEOGRAPHY]) with [REVENUE RANGE] revenue."

Then provide 3-5 bullet points explaining why this ICP would be most effective, focusing on:
- Market size and opportunity
- Targeting precision
- Sales efficiency
- Competitive advantages

Keep the response concise and actionable.`;

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a B2B sales strategist expert at analyzing CRM data and recommending optimal ICPs.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const recommendation = aiData.choices[0].message.content;

    return new Response(JSON.stringify({ 
      recommendation,
      dataAnalysis,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-icp-recommendations:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeAccountData(accounts: any[]) {
  const industries = accounts.map(a => a.industry_norm).filter(Boolean);
  const countries = accounts.map(a => a.country).filter(Boolean);
  const revenues = accounts.map(a => a.revenue_range).filter(Boolean);
  const sizes = accounts.map(a => a.employee_count).filter(Boolean);

  const topIndustries = getTopItems(industries, 3);
  const topCountries = getTopItems(countries, 3);
  const topRevenues = getTopItems(revenues, 3);
  const companySizeRanges = categorizeSizes(sizes);

  return {
    totalAccounts: accounts.length,
    topIndustries,
    topCountries,
    revenueRanges: topRevenues,
    companySizes: companySizeRanges
  };
}

function getTopItems(items: string[], limit: number): string[] {
  const counts: { [key: string]: number } = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([item]) => item);
}

function categorizeSizes(sizes: number[]): string[] {
  const ranges = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
  const counts = {
    '1-10': 0,
    '11-50': 0,
    '51-200': 0,
    '201-1000': 0,
    '1000+': 0
  };

  sizes.forEach(size => {
    if (size <= 10) counts['1-10']++;
    else if (size <= 50) counts['11-50']++;
    else if (size <= 200) counts['51-200']++;
    else if (size <= 1000) counts['201-1000']++;
    else counts['1000+']++;
  });

  return Object.entries(counts)
    .filter(([,count]) => count > 0)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([range]) => range);
}
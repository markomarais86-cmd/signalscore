import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountExternalId, question } = await req.json();
    
    if (!accountExternalId || !question) {
      return new Response(
        JSON.stringify({ error: 'accountExternalId and question are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.org_id;
    console.log(`[ask-account-ai] Question for account ${accountExternalId}: "${question}"`);

    // Fetch comprehensive account data
    const [accountResult, scoreResult, leadsResult, activitiesResult, dealsResult, signalsResult] = await Promise.all([
      supabase
        .from('accounts')
        .select('*')
        .eq('org_id', orgId)
        .eq('external_id', accountExternalId)
        .single(),
      supabase
        .from('scores')
        .select('*')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .single(),
      supabase
        .from('Leads')
        .select('first_name, last_name, title, persona, email, status, created_at')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .limit(20),
      supabase
        .from('activities')
        .select('activity_type, activity_date, subject, outcome')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .order('activity_date', { ascending: false })
        .limit(10),
      supabase
        .from('deals')
        .select('name, stage, amount, status, expected_close_date')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .limit(5),
      supabase
        .from('account_signals')
        .select('signal_type, signal_priority, title, description')
        .eq('org_id', orgId)
        .eq('account_external_id', accountExternalId)
        .is('dismissed_at', null)
        .limit(10)
    ]);

    const account = accountResult.data;
    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for AI
    const context = buildAccountContext(
      account,
      scoreResult.data,
      leadsResult.data || [],
      activitiesResult.data || [],
      dealsResult.data || [],
      signalsResult.data || []
    );

    // Call Lovable AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert B2B sales intelligence analyst helping sales teams understand their accounts better. 
You have access to comprehensive data about the account and should provide actionable, specific insights.
Be concise but thorough. Use bullet points for clarity. Focus on actionable recommendations.
If you don't have enough data to answer confidently, say so and suggest what additional information would help.`
          },
          {
            role: 'user',
            content: `Here is the context about the account:\n\n${context}\n\n---\n\nUser Question: ${question}`
          }
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ask-account-ai] AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Return streaming response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[ask-account-ai] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildAccountContext(
  account: any,
  score: any | null,
  leads: any[],
  activities: any[],
  deals: any[],
  signals: any[]
): string {
  const sections: string[] = [];

  // Company overview
  sections.push(`## Company Overview
- Name: ${account.name || 'Unknown'}
- Domain: ${account.domain || 'Unknown'}
- Industry: ${account.industry_norm || account.industry_raw || 'Unknown'}
- Employee Count: ${account.employee_count?.toLocaleString() || 'Unknown'}
- Revenue Range: ${account.revenue_range || 'Unknown'}
- Location: ${[account.city, account.state_province, account.country].filter(Boolean).join(', ') || 'Unknown'}
- Founded: ${account.founded_year || 'Unknown'}
- Business Model: ${account.business_model || 'Unknown'}`);

  // ICP Score
  if (score) {
    sections.push(`## ICP Scoring
- Overall Score: ${score.overall}/100
- Fit Score: ${score.fit}/100
- Intent Score: ${score.intent}/100
- Reachability Score: ${score.reachability}/100
- ICP Qualified: ${account.icp_qualified ? 'Yes' : 'No'}
${account.icp_fail_reasons?.length > 0 ? `- Fail Reasons: ${account.icp_fail_reasons.join(', ')}` : ''}`);
  }

  // Contacts/Leads
  if (leads.length > 0) {
    const contactList = leads
      .map(l => `- ${l.first_name || ''} ${l.last_name || ''}: ${l.title || 'Unknown title'} (${l.persona || 'Unknown persona'}) - Status: ${l.status || 'Unknown'}`)
      .join('\n');
    sections.push(`## Known Contacts (${leads.length} total)
${contactList}`);
  } else {
    sections.push(`## Known Contacts
No contacts on file for this account.`);
  }

  // Recent Activities
  if (activities.length > 0) {
    const activityList = activities
      .map(a => `- ${a.activity_date}: ${a.activity_type} - ${a.subject || 'No subject'} (${a.outcome || 'No outcome'})`)
      .join('\n');
    sections.push(`## Recent Activities
${activityList}`);
  } else {
    sections.push(`## Recent Activities
No recent activities recorded.`);
  }

  // Deals
  if (deals.length > 0) {
    const dealList = deals
      .map(d => `- ${d.name}: ${d.stage} - $${(d.amount || 0).toLocaleString()} (${d.status})`)
      .join('\n');
    sections.push(`## Active Deals
${dealList}`);
  }

  // Active Signals
  if (signals.length > 0) {
    const signalList = signals
      .map(s => `- [${s.signal_priority.toUpperCase()}] ${s.title}: ${s.description || ''}`)
      .join('\n');
    sections.push(`## Active Signals
${signalList}`);
  }

  // Tech Stack
  if (account.tech_stack?.length > 0) {
    sections.push(`## Technology Stack
${account.tech_stack.join(', ')}`);
  }

  // Funding
  if (account.total_raised_usd || account.last_funding_round) {
    sections.push(`## Funding Information
- Total Raised: ${account.total_raised_usd ? `$${(account.total_raised_usd / 1000000).toFixed(1)}M` : 'Unknown'}
- Last Round: ${account.last_funding_round || 'Unknown'}
- Last Funding Date: ${account.last_funding_date || 'Unknown'}`);
  }

  return sections.join('\n\n');
}

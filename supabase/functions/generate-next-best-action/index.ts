import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NBARequest {
  account_external_id?: string;
  deal_id?: string;
  lead_id?: number;
  user_id?: string;
  trigger_source?: string;
  call_id?: string;
  email_thread_id?: string;
  urgency?: string;
  force_regenerate?: boolean;
}

interface ContextData {
  account?: Record<string, unknown>;
  deal?: Record<string, unknown>;
  lead?: Record<string, unknown>;
  recentCalls?: Record<string, unknown>[];
  recentEmails?: Record<string, unknown>[];
  recentActivities?: Record<string, unknown>[];
  callInsights?: Record<string, unknown>;
  emailAnalysis?: Record<string, unknown>;
  existingNBAs?: Record<string, unknown>[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.org_id) {
      return new Response(JSON.stringify({ error: 'User not associated with organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = userProfile.org_id;
    const body: NBARequest = await req.json();

    console.log(`[generate-next-best-action] Generating for org: ${orgId}, trigger: ${body.trigger_source}`);

    // Gather context
    const context: ContextData = {};

    // Get account info
    if (body.account_external_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', orgId)
        .eq('external_id', body.account_external_id)
        .single();
      context.account = account || undefined;
    }

    // Get deal info
    if (body.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', body.deal_id)
        .eq('org_id', orgId)
        .single();
      context.deal = deal || undefined;
    }

    // Get lead info
    if (body.lead_id) {
      const { data: lead } = await supabase
        .from('Leads')
        .select('*')
        .eq('id', body.lead_id)
        .single();
      context.lead = lead || undefined;
    }

    // Get recent calls for this account/deal
    const accountFilter = body.account_external_id 
      ? { column: 'account_external_id', value: body.account_external_id }
      : body.deal_id 
      ? { column: 'deal_id', value: body.deal_id }
      : null;

    if (accountFilter) {
      const { data: recentCalls } = await supabase
        .from('call_recordings')
        .select(`
          *,
          call_insights(*)
        `)
        .eq('org_id', orgId)
        .eq(accountFilter.column, accountFilter.value)
        .order('recorded_at', { ascending: false })
        .limit(5);
      context.recentCalls = recentCalls || [];

      const { data: recentEmails } = await supabase
        .from('email_threads')
        .select('*')
        .eq('org_id', orgId)
        .eq(accountFilter.column, accountFilter.value)
        .order('last_message_at', { ascending: false })
        .limit(5);
      context.recentEmails = recentEmails || [];

      const { data: recentActivities } = await supabase
        .from('activities')
        .select('*')
        .eq('org_id', orgId)
        .eq(accountFilter.column, accountFilter.value)
        .order('activity_date', { ascending: false })
        .limit(10);
      context.recentActivities = recentActivities || [];
    }

    // Get specific call insights if triggered by call processing
    if (body.call_id) {
      const { data: callInsights } = await supabase
        .from('call_insights')
        .select('*')
        .eq('call_id', body.call_id)
        .single();
      context.callInsights = callInsights || undefined;
    }

    // Get specific email analysis if triggered by email
    if (body.email_thread_id) {
      const { data: emailThread } = await supabase
        .from('email_threads')
        .select('*')
        .eq('id', body.email_thread_id)
        .single();
      context.emailAnalysis = emailThread || undefined;
    }

    // Get existing pending NBAs to avoid duplicates
    if (accountFilter) {
      const { data: existingNBAs } = await supabase
        .from('next_best_actions')
        .select('*')
        .eq('org_id', orgId)
        .eq(accountFilter.column, accountFilter.value)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(5);
      context.existingNBAs = existingNBAs || [];
    }

    // Get action templates
    const { data: templates } = await supabase
      .from('action_templates')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('priority_weight', { ascending: false });

    // Generate NBA using AI
    let recommendations: Array<{
      action_type: string;
      title: string;
      description: string;
      priority: number;
      reasoning: string;
      suggested_content?: Record<string, unknown>;
      suggested_talking_points?: string[];
      due_date?: string;
      template_id?: string;
    }> = [];

    if (openaiKey) {
      try {
        const contextSummary = JSON.stringify({
          account: context.account ? {
            name: (context.account as Record<string, unknown>).name,
            industry: (context.account as Record<string, unknown>).industry_norm,
            size: (context.account as Record<string, unknown>).employee_count,
            icp_qualified: (context.account as Record<string, unknown>).icp_qualified,
          } : null,
          deal: context.deal ? {
            name: (context.deal as Record<string, unknown>).name,
            stage: (context.deal as Record<string, unknown>).stage,
            amount: (context.deal as Record<string, unknown>).amount,
            expected_close: (context.deal as Record<string, unknown>).expected_close_date,
          } : null,
          recentCallSummaries: context.recentCalls?.slice(0, 3).map((c: Record<string, unknown>) => ({
            date: c.recorded_at,
            type: c.call_type,
            insights: (c.call_insights as Record<string, unknown>[])?.[0]?.summary,
          })),
          recentEmailSummaries: context.recentEmails?.slice(0, 3).map((e: Record<string, unknown>) => ({
            date: e.last_message_at,
            subject: e.subject,
            sentiment: e.sentiment,
            urgency: e.urgency,
            action_required: e.action_required,
          })),
          latestCallInsights: context.callInsights ? {
            summary: (context.callInsights as Record<string, unknown>).summary,
            action_items: (context.callInsights as Record<string, unknown>).action_items,
            objections: (context.callInsights as Record<string, unknown>).objections,
            risk_indicators: (context.callInsights as Record<string, unknown>).risk_indicators,
            next_steps: (context.callInsights as Record<string, unknown>).next_steps,
          } : null,
          latestEmailAnalysis: context.emailAnalysis ? {
            summary: (context.emailAnalysis as Record<string, unknown>).summary,
            urgency: (context.emailAnalysis as Record<string, unknown>).urgency,
            action_required: (context.emailAnalysis as Record<string, unknown>).action_required,
          } : null,
          existingPendingActions: context.existingNBAs?.map((n: Record<string, unknown>) => ({
            type: n.action_type,
            title: n.title,
          })),
          triggerSource: body.trigger_source,
        }, null, 2);

        const templateSummary = templates?.slice(0, 5).map(t => ({
          id: t.id,
          name: t.name,
          type: t.action_type,
          description: t.description,
        }));

        const prompt = `Based on the following context about a sales account/deal, recommend 1-3 next best actions the sales rep should take. Avoid recommending actions that are already pending.

Context:
${contextSummary}

Available action templates:
${JSON.stringify(templateSummary, null, 2)}

Respond with a JSON array of recommendations:
[{
  "action_type": "call/email/meeting/send_content/escalate/follow_up/demo/proposal/contract/other",
  "title": "Short action title",
  "description": "Detailed description of what to do",
  "priority": 1-5 (5 being highest),
  "reasoning": "Why this action is recommended now",
  "suggested_talking_points": ["point 1", "point 2"],
  "days_until_due": 1-7,
  "template_id": "template id if matching one above, null otherwise"
}]

Focus on actions that will move the deal forward. Be specific and actionable.`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert sales strategist. Recommend specific, actionable next steps for sales reps. Always respond with valid JSON array.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            response_format: { type: 'json_object' },
          }),
        });

        if (openaiResponse.ok) {
          const aiResult = await openaiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || [parsed];
          }
        }
      } catch (aiError) {
        console.error('[generate-next-best-action] AI error:', aiError);
      }
    }

    // Fallback if no AI recommendations
    if (recommendations.length === 0) {
      // Generate rule-based recommendation
      if (context.callInsights?.action_items && (context.callInsights.action_items as unknown[]).length > 0) {
        recommendations.push({
          action_type: 'follow_up',
          title: 'Follow up on call action items',
          description: 'Review and complete action items from recent call',
          priority: 4,
          reasoning: 'Action items were identified in the recent call',
        });
      } else if (context.emailAnalysis?.action_required) {
        recommendations.push({
          action_type: 'email',
          title: 'Respond to pending email',
          description: 'Email thread requires a response',
          priority: context.emailAnalysis.urgency === 'high' ? 5 : 3,
          reasoning: 'Email marked as requiring action',
        });
      } else {
        recommendations.push({
          action_type: 'follow_up',
          title: 'Check in with contact',
          description: 'Schedule a check-in to maintain engagement',
          priority: 2,
          reasoning: 'Regular follow-up recommended',
        });
      }
    }

    // Insert recommendations
    const insertedNBAs = [];
    for (const rec of recommendations) {
      const dueDate = rec.due_date 
        ? new Date(rec.due_date)
        : new Date(Date.now() + ((rec as Record<string, unknown>).days_until_due as number || 3) * 24 * 60 * 60 * 1000);

      const { data: nba, error: insertError } = await supabase
        .from('next_best_actions')
        .insert({
          org_id: orgId,
          account_external_id: body.account_external_id,
          deal_id: body.deal_id,
          lead_id: body.lead_id,
          user_id: body.user_id || user.id,
          template_id: rec.template_id || null,
          action_type: rec.action_type,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          reasoning: rec.reasoning,
          context_summary: JSON.stringify({
            trigger: body.trigger_source,
            account: context.account?.name,
            deal: context.deal?.name,
          }),
          suggested_content: rec.suggested_content || {},
          suggested_talking_points: rec.suggested_talking_points || [],
          related_call_id: body.call_id || null,
          related_email_id: body.email_thread_id || null,
          due_date: dueDate.toISOString(),
          expires_at: new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          ai_model: openaiKey ? 'gpt-4o-mini' : 'rule-based',
          ai_confidence: openaiKey ? 0.8 : 0.5,
          source: openaiKey ? 'ai' : 'rule',
        })
        .select()
        .single();

      if (!insertError && nba) {
        insertedNBAs.push(nba);
      } else {
        console.error('[generate-next-best-action] Insert error:', insertError);
      }
    }

    console.log(`[generate-next-best-action] Generated ${insertedNBAs.length} NBAs`);

    return new Response(JSON.stringify({
      success: true,
      actions: insertedNBAs,
      context_used: {
        has_account: !!context.account,
        has_deal: !!context.deal,
        recent_calls: context.recentCalls?.length || 0,
        recent_emails: context.recentEmails?.length || 0,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-next-best-action] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

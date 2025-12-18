import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailThreadRequest {
  thread_id?: string;
  subject: string;
  messages: Array<{
    from: string;
    to: string[];
    cc?: string[];
    body: string;
    sent_at: string;
  }>;
  account_external_id?: string;
  deal_id?: string;
  lead_id?: number;
  source?: string;
  external_id?: string;
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
    const body: EmailThreadRequest = await req.json();

    console.log(`[analyze-email-thread] Processing for org: ${orgId}, subject: ${body.subject}`);

    if (!body.messages || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract participants from all messages
    const participantSet = new Set<string>();
    body.messages.forEach(msg => {
      participantSet.add(msg.from);
      msg.to.forEach(to => participantSet.add(to));
      msg.cc?.forEach(cc => participantSet.add(cc));
    });
    const participants = Array.from(participantSet).map(email => ({ email }));

    // Calculate response times
    const responseTimes: number[] = [];
    for (let i = 1; i < body.messages.length; i++) {
      const prev = new Date(body.messages[i - 1].sent_at).getTime();
      const curr = new Date(body.messages[i].sent_at).getTime();
      const diffHours = (curr - prev) / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours < 168) { // Ignore gaps > 1 week
        responseTimes.push(diffHours);
      }
    }
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : null;

    // Prepare thread content for analysis
    const threadContent = body.messages.map(m => 
      `From: ${m.from}\nDate: ${m.sent_at}\n\n${m.body}`
    ).join('\n\n---\n\n');

    let analysis: Record<string, unknown> = {};

    if (openaiKey) {
      try {
        const analysisPrompt = `Analyze this email thread and extract insights in JSON format:

{
  "summary": "Brief summary of the thread conversation",
  "sentiment": "positive/neutral/negative/mixed",
  "intent": "buying/evaluating/objecting/closing/churning/support/other",
  "urgency": "low/medium/high/critical",
  "key_points": ["list of key discussion points"],
  "action_required": true/false,
  "action_required_by": "ISO date if a deadline is mentioned, null otherwise",
  "action_description": "What action is needed if any",
  "buying_signals": ["list of positive indicators"],
  "concerns": ["list of concerns or objections raised"],
  "next_steps_mentioned": "Any next steps discussed",
  "decision_timeline": "Any timeline mentioned for decisions"
}

Subject: ${body.subject}

Thread:
${threadContent.substring(0, 10000)}`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert email analyst for sales teams. Extract insights from email threads to help prioritize follow-ups. Always respond with valid JSON.' },
              { role: 'user', content: analysisPrompt }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (openaiResponse.ok) {
          const aiResult = await openaiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content;
          if (content) {
            analysis = JSON.parse(content);
          }
        }
      } catch (aiError) {
        console.error('[analyze-email-thread] AI analysis error:', aiError);
      }
    }

    // Fallback analysis if AI unavailable
    if (!analysis.summary) {
      analysis = {
        summary: 'Email thread received but AI analysis unavailable.',
        sentiment: 'neutral',
        intent: 'other',
        urgency: 'medium',
        key_points: [],
        action_required: false,
        action_required_by: null,
        buying_signals: [],
        concerns: [],
      };
    }

    // Sort messages to find first and last
    const sortedMessages = [...body.messages].sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages[sortedMessages.length - 1];

    // Upsert email thread
    const threadData = {
      org_id: orgId,
      thread_id: body.thread_id || body.external_id || `manual_${Date.now()}`,
      account_external_id: body.account_external_id,
      deal_id: body.deal_id,
      lead_id: body.lead_id,
      subject: body.subject,
      participants,
      message_count: body.messages.length,
      first_message_at: firstMessage.sent_at,
      last_message_at: lastMessage.sent_at,
      last_sender: lastMessage.from,
      sentiment: analysis.sentiment as string,
      intent: analysis.intent as string,
      urgency: analysis.urgency as string,
      response_time_avg_hours: avgResponseTime,
      source: body.source || 'manual',
      external_id: body.external_id,
      summary: analysis.summary as string,
      key_points: analysis.key_points || [],
      action_required: analysis.action_required as boolean,
      action_required_by: analysis.action_required_by as string | null,
      processed_at: new Date().toISOString(),
      processing_status: 'completed',
    };

    const { data: emailThread, error: upsertError } = await supabase
      .from('email_threads')
      .upsert(threadData, {
        onConflict: 'org_id,thread_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      console.error('[analyze-email-thread] Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save email thread', details: upsertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[analyze-email-thread] Processed thread: ${emailThread.id}`);

    // Trigger NBA if action required or high urgency
    if (analysis.action_required || analysis.urgency === 'high' || analysis.urgency === 'critical') {
      try {
        await supabase.functions.invoke('generate-next-best-action', {
          body: {
            trigger_source: 'email_analyzed',
            email_thread_id: emailThread.id,
            account_external_id: body.account_external_id,
            deal_id: body.deal_id,
            urgency: analysis.urgency,
          },
        });
      } catch (nbaError) {
        console.error('[analyze-email-thread] NBA trigger error:', nbaError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      email_thread: emailThread,
      analysis,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-email-thread] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallRecordingRequest {
  call_id?: string;
  recording_url?: string;
  transcript?: string;
  account_external_id?: string;
  deal_id?: string;
  lead_id?: number;
  call_type?: string;
  source?: string;
  recorded_at?: string;
  participants?: Array<{ name: string; email?: string; role?: string }>;
  metadata?: Record<string, unknown>;
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
    const body: CallRecordingRequest = await req.json();

    console.log(`[process-call-recording] Processing for org: ${orgId}`);

    let callId = body.call_id;
    let transcript = body.transcript;

    // If no call_id provided, create a new call recording
    if (!callId) {
      const { data: newCall, error: insertError } = await supabase
        .from('call_recordings')
        .insert({
          org_id: orgId,
          account_external_id: body.account_external_id,
          deal_id: body.deal_id,
          lead_id: body.lead_id,
          recording_url: body.recording_url,
          transcript: body.transcript,
          call_type: body.call_type || 'other',
          source: body.source || 'manual',
          recorded_at: body.recorded_at || new Date().toISOString(),
          participants: body.participants || [],
          metadata: body.metadata || {},
          processing_status: 'processing',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[process-call-recording] Insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create call recording', details: insertError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      callId = newCall.id;
      transcript = newCall.transcript;
      console.log(`[process-call-recording] Created new call recording: ${callId}`);
    } else {
      // Update existing call to processing status
      const { data: existingCall, error: fetchError } = await supabase
        .from('call_recordings')
        .select('*')
        .eq('id', callId)
        .eq('org_id', orgId)
        .single();

      if (fetchError || !existingCall) {
        return new Response(JSON.stringify({ error: 'Call recording not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      transcript = existingCall.transcript;

      await supabase
        .from('call_recordings')
        .update({ processing_status: 'processing' })
        .eq('id', callId);
    }

    // If no transcript, we can't process
    if (!transcript) {
      await supabase
        .from('call_recordings')
        .update({ 
          processing_status: 'failed',
          error_message: 'No transcript provided for analysis'
        })
        .eq('id', callId);

      return new Response(JSON.stringify({ 
        error: 'No transcript provided',
        call_id: callId 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to analyze the transcript
    let insights: Record<string, unknown> = {};
    let aiModel = 'fallback';

    if (openaiKey) {
      try {
        const analysisPrompt = `Analyze this sales call transcript and extract the following information in JSON format:

{
  "summary": "A 2-3 sentence summary of the call",
  "key_topics": ["list of main topics discussed"],
  "objections": [{"objection": "description", "response": "how it was handled", "resolved": true/false}],
  "action_items": [{"item": "description", "owner": "who should do it", "due": "timeframe if mentioned"}],
  "sentiment": "positive/neutral/negative/mixed",
  "sentiment_score": 0.0-1.0,
  "buying_signals": ["list of positive buying indicators"],
  "risk_indicators": ["list of concerns or risks identified"],
  "next_steps": "Summary of agreed next steps",
  "competitor_mentions": [{"name": "competitor name", "context": "what was said"}],
  "decision_makers_identified": [{"name": "name", "role": "role", "influence": "high/medium/low"}],
  "budget_discussed": true/false,
  "timeline_discussed": true/false
}

Transcript:
${transcript.substring(0, 12000)}`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert sales call analyst. Extract insights from sales call transcripts. Always respond with valid JSON.' },
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
            insights = JSON.parse(content);
            aiModel = 'gpt-4o-mini';
          }
        }
      } catch (aiError) {
        console.error('[process-call-recording] AI analysis error:', aiError);
      }
    }

    // If AI failed, provide basic analysis
    if (!insights.summary) {
      insights = {
        summary: 'Transcript received but AI analysis unavailable. Manual review recommended.',
        key_topics: [],
        objections: [],
        action_items: [],
        sentiment: 'neutral',
        sentiment_score: 0.5,
        buying_signals: [],
        risk_indicators: [],
        next_steps: null,
        competitor_mentions: [],
        decision_makers_identified: [],
        budget_discussed: false,
        timeline_discussed: false,
      };
    }

    // Store insights
    const { data: insightRecord, error: insightError } = await supabase
      .from('call_insights')
      .insert({
        org_id: orgId,
        call_id: callId,
        summary: insights.summary as string,
        key_topics: insights.key_topics || [],
        objections: insights.objections || [],
        action_items: insights.action_items || [],
        sentiment: insights.sentiment as string,
        sentiment_score: insights.sentiment_score as number,
        buying_signals: insights.buying_signals || [],
        risk_indicators: insights.risk_indicators || [],
        next_steps: insights.next_steps as string,
        competitor_mentions: insights.competitor_mentions || [],
        decision_makers_identified: insights.decision_makers_identified || [],
        budget_discussed: insights.budget_discussed as boolean,
        timeline_discussed: insights.timeline_discussed as boolean,
        confidence: aiModel === 'gpt-4o-mini' ? 0.85 : 0.3,
        ai_model: aiModel,
      })
      .select()
      .single();

    if (insightError) {
      console.error('[process-call-recording] Insight insert error:', insightError);
    }

    // Update call recording status
    await supabase
      .from('call_recordings')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', callId);

    console.log(`[process-call-recording] Completed processing call: ${callId}`);

    // Trigger NBA generation if there are action items or risk indicators
    if ((insights.action_items as unknown[])?.length > 0 || (insights.risk_indicators as unknown[])?.length > 0) {
      try {
        await supabase.functions.invoke('generate-next-best-action', {
          body: {
            trigger_source: 'call_processed',
            call_id: callId,
            account_external_id: body.account_external_id,
            deal_id: body.deal_id,
          },
        });
      } catch (nbaError) {
        console.error('[process-call-recording] NBA trigger error:', nbaError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      call_id: callId,
      insights: insightRecord,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-call-recording] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteActionRequest {
  action_id: string;
  status: 'accepted' | 'completed' | 'dismissed';
  outcome?: string;
  outcome_notes?: string;
  dismissed_reason?: string;
  effectiveness_score?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
    const body: CompleteActionRequest = await req.json();

    if (!body.action_id || !body.status) {
      return new Response(JSON.stringify({ error: 'action_id and status are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[complete-nba-action] Updating action ${body.action_id} to ${body.status}`);

    // Verify the action belongs to the user's org
    const { data: existingAction, error: fetchError } = await supabase
      .from('next_best_actions')
      .select('*')
      .eq('id', body.action_id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existingAction) {
      return new Response(JSON.stringify({ error: 'Action not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    if (body.status === 'accepted') {
      updateData.accepted_at = new Date().toISOString();
      updateData.status = 'in_progress';
    } else if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.outcome = body.outcome;
      updateData.outcome_notes = body.outcome_notes;
      updateData.effectiveness_score = body.effectiveness_score;
    } else if (body.status === 'dismissed') {
      updateData.dismissed_reason = body.dismissed_reason;
    }

    // Update the action
    const { data: updatedAction, error: updateError } = await supabase
      .from('next_best_actions')
      .update(updateData)
      .eq('id', body.action_id)
      .select()
      .single();

    if (updateError) {
      console.error('[complete-nba-action] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update action', details: updateError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If completed with a template, update template usage stats
    if (body.status === 'completed' && existingAction.template_id) {
      const { data: template } = await supabase
        .from('action_templates')
        .select('usage_count, success_rate')
        .eq('id', existingAction.template_id)
        .single();

      if (template) {
        const currentUsage = template.usage_count || 0;
        const currentSuccessRate = template.success_rate || 0;
        const isSuccess = body.effectiveness_score && body.effectiveness_score >= 3;
        
        // Calculate new success rate
        const newSuccessRate = currentUsage === 0 
          ? (isSuccess ? 1 : 0)
          : ((currentSuccessRate * currentUsage) + (isSuccess ? 1 : 0)) / (currentUsage + 1);

        await supabase
          .from('action_templates')
          .update({
            usage_count: currentUsage + 1,
            success_rate: newSuccessRate,
          })
          .eq('id', existingAction.template_id);
      }
    }

    // Log to AI feedback for learning
    if (body.status === 'completed' || body.status === 'dismissed') {
      try {
        await supabase
          .from('ai_agent_feedback')
          .insert({
            org_id: orgId,
            account_id: existingAction.account_external_id,
            decision_type: 'next_best_action',
            outcome: body.status === 'completed' ? 'accepted' : 'rejected',
            feedback_score: body.effectiveness_score || (body.status === 'dismissed' ? 1 : 3),
            feedback_notes: body.outcome_notes || body.dismissed_reason,
            ai_reasoning: existingAction.reasoning,
            confidence_score: existingAction.ai_confidence,
            context_data: {
              action_type: existingAction.action_type,
              title: existingAction.title,
              template_id: existingAction.template_id,
            },
          });
      } catch (feedbackError) {
        console.error('[complete-nba-action] Feedback logging error:', feedbackError);
      }
    }

    console.log(`[complete-nba-action] Successfully updated action to ${body.status}`);

    return new Response(JSON.stringify({
      success: true,
      action: updatedAction,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[complete-nba-action] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

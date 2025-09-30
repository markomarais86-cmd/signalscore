import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, account_external_id, features, version_hint } = await req.json();

    // Mock scoring logic - replace with actual scoring service
    const mockScore = {
      overall: Math.floor(Math.random() * 40) + 60, // 60-100 range
      fit: Math.floor(Math.random() * 30) + 70,
      intent: Math.floor(Math.random() * 50) + 50,
      reachability: Math.floor(Math.random() * 40) + 60,
      reasons: [
        "Company size matches ICP criteria",
        "Industry alignment detected",
        "Recent funding activity observed"
      ],
      scoring_version: version_hint || 'v1',
      computed_at: new Date().toISOString()
    };

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Store score in database with proper conflict resolution
    const { error: scoreError } = await supabase
      .from('scores')
      .upsert({
        org_id,
        account_external_id,
        overall: mockScore.overall,
        fit: mockScore.fit,
        intent: mockScore.intent,
        reachability: mockScore.reachability,
        reasons: mockScore.reasons,
        scoring_version: mockScore.scoring_version,
        computed_at: mockScore.computed_at
      }, {
        onConflict: 'org_id,account_external_id,scoring_version',
        ignoreDuplicates: false
      });

    if (scoreError) {
      throw scoreError;
    }

    // Log audit entry
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id,
        actor: 'scoring_api',
        action: 'account_scored',
        meta: {
          account_external_id,
          score: mockScore.overall,
          version: mockScore.scoring_version
        }
      });

    if (auditError) {
      console.error('Audit log error:', auditError);
    }

    return new Response(
      JSON.stringify({
        overall: mockScore.overall,
        components: {
          fit: mockScore.fit,
          intent: mockScore.intent,
          reachability: mockScore.reachability
        },
        reasons: mockScore.reasons,
        scoring_version: mockScore.scoring_version,
        computed_at: mockScore.computed_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
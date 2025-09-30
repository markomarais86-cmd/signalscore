import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScoreRequest {
  org_id: string;
  account_external_id: string;
  icp_id?: string;
  version_hint?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, account_external_id, icp_id, version_hint }: ScoreRequest = await req.json();

    if (!org_id || !account_external_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: org_id and account_external_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Scoring account:', account_external_id, 'for org:', org_id);

    // Get account data
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', org_id)
      .eq('external_id', account_external_id)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${account_external_id}`);
    }

    // Get ICP profiles (use specific one if provided, otherwise get all active)
    const icpQuery = supabase
      .from('icp_profiles')
      .select('*')
      .eq('org_id', org_id)
      .eq('status', 'active');
    
    if (icp_id) {
      icpQuery.eq('id', icp_id);
    }

    const { data: icpProfiles, error: icpError } = await icpQuery;

    if (icpError || !icpProfiles || icpProfiles.length === 0) {
      throw new Error('No active ICP profiles found for organization');
    }

    console.log(`Found ${icpProfiles.length} ICP profiles to score against`);

    // Calculate score using the database function for best ICP match
    let bestScore = null;
    let bestIcpId = null;

    for (const icp of icpProfiles) {
      const { data: scoreResult, error: scoreError } = await supabase
        .rpc('calculate_account_score', {
          account_external_id,
          icp_id: icp.id,
          org_id_param: org_id
        });

      if (scoreError) {
        console.error('Score calculation error:', scoreError);
        continue;
      }

      if (scoreResult && (!bestScore || scoreResult.overall > bestScore.overall)) {
        bestScore = scoreResult;
        bestIcpId = icp.id;
      }
    }

    if (!bestScore) {
      throw new Error('Failed to calculate score');
    }

    console.log('Best score calculated:', bestScore);

    // Store score in database
    const scoringVersion = version_hint || 'icp_v2.0';
    const { error: scoreError } = await supabase
      .from('scores')
      .upsert({
        org_id,
        account_external_id,
        overall: bestScore.overall,
        fit: bestScore.fit,
        intent: bestScore.intent,
        reachability: bestScore.reachability,
        reasons: bestScore.breakdown || {},
        scoring_version: scoringVersion,
        computed_at: new Date().toISOString()
      }, {
        onConflict: 'org_id,account_external_id'
      });

    if (scoreError) {
      console.error('Error storing score:', scoreError);
      throw scoreError;
    }

    // Log audit entry
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id,
        actor: 'scoring_engine',
        action: 'account_scored',
        meta: {
          account_external_id,
          account_name: account.name,
          icp_id: bestIcpId,
          score: bestScore.overall,
          fit: bestScore.fit,
          version: scoringVersion
        }
      });

    if (auditError) {
      console.error('Audit log error:', auditError);
    }

    console.log('Score stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        overall: bestScore.overall,
        components: {
          fit: bestScore.fit,
          intent: bestScore.intent,
          reachability: bestScore.reachability
        },
        breakdown: bestScore.breakdown || {},
        icp_id: bestIcpId,
        scoring_version: scoringVersion,
        computed_at: new Date().toISOString()
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
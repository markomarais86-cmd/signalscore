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

    // Check if we have cached feature weights (v2.0 scoring)
    const { data: hasWeights } = await supabase
      .from('icp_feature_weights')
      .select('id')
      .eq('org_id', org_id)
      .limit(1);

    let bestScore = null;
    let bestIcpId = null;

    // Iterate through ICPs
    for (const icp of icpProfiles) {
      try {
        let scoreData: any;
        
        // Use weighted scoring v2.0 if weights are available
        if (hasWeights && hasWeights.length > 0) {
          console.log('Using Statistical Scoring v2.0 with cached weights');
          
          const { data, error: scoreError } = await supabase
            .rpc('calculate_weighted_account_score', {
              p_account_external_id: account_external_id,
              p_icp_id: icp.id,
              p_org_id: org_id
            });

          if (scoreError) throw scoreError;
          
          // Calculate score band (A/B/C)
          let band = 'C';
          if (data.overall >= 70) band = 'A';
          else if (data.overall >= 40) band = 'B';
          
          scoreData = {
            overall: data.overall,
            fit: data.overall, // Use overall score for fit in v2
            intent: 50, // Placeholder for future intent signals
            reachability: 50, // Placeholder for future reachability calculation
            breakdown: data.breakdown,
            band: band,
            confidence: data.confidence,
            scoring_version: 'statistical_v2.0'
          };
          
          console.log(`Score: ${data.overall} (Band ${band}, Confidence ${data.confidence}%)`);
        } else {
          console.log('Falling back to legacy scoring (no weights available)');
          
          // Fallback to legacy scoring
          const { data, error: scoreError } = await supabase
            .rpc('calculate_account_score', {
              account_external_id,
              icp_id: icp.id,
              org_id_param: org_id
            });

          if (scoreError) throw scoreError;
          
          scoreData = {
            ...data,
            scoring_version: 'legacy_v1.0'
          };
        }

        if (!bestScore || scoreData.overall > bestScore.overall) {
          bestScore = scoreData;
          bestIcpId = icp.id;
        }
      } catch (error) {
        console.error(`Error scoring against ICP ${icp.id}:`, error);
        continue;
      }
    }

    if (!bestScore) {
      throw new Error('Failed to calculate score');
    }

    console.log('Best score calculated:', bestScore);

    // Store score in database
    const scoringVersion = bestScore.scoring_version || version_hint || 'statistical_v2.0';
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
        band: bestScore.band,
        confidence: bestScore.confidence,
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
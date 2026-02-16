import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  successResponse, 
  errorResponse, 
  handleCors, 
  parseJsonBody,
  validateRequired,
  ErrorCodes 
} from "../_shared/response-helpers.ts";

interface ScoreRequest {
  org_id: string;
  account_external_id: string;
  icp_id?: string;
  version_hint?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await parseJsonBody<ScoreRequest>(req);
    const validation = validateRequired(body, ['org_id', 'account_external_id']);

    if (!validation.valid) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(', ')}`,
        400
      );
    }

    const { org_id, account_external_id, icp_id } = body!;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Scoring account:', account_external_id, 'for org:', org_id);

    // Get organization scoring version
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('scoring_version')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      throw new Error(`Organization not found: ${org_id}`);
    }

    const orgScoringVersion = org.scoring_version || 'legacy_v1.0';
    console.log(`Using org-level scoring version: ${orgScoringVersion}`);

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

    let bestScore = null;
    let bestIcpId = null;

    // Iterate through ICPs
    for (const icp of icpProfiles) {
      try {
        let scoreData: any;
        
        // Use org-level scoring version
        if (orgScoringVersion === 'statistical_v2.0') {
          console.log('Using Statistical Scoring v2.0 (org-level)');
          
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
          
          // Compute real intent score from signals
          let intentScore = 50; // default fallback
          try {
            const { data: signals } = await supabase
              .from('account_signals')
              .select('signal_priority, signal_type')
              .eq('org_id', org_id)
              .eq('account_external_id', account_external_id)
              .in('signal_type', ['engagement_velocity', 'multi_thread', 'score_change', 'coverage_gap']);

            if (signals && signals.length > 0) {
              const priorityWeights: Record<string, number> = { critical: 25, high: 20, medium: 12, low: 5 };
              const signalScore = signals.reduce((sum, s) => sum + (priorityWeights[s.signal_priority] || 5), 0);
              intentScore = Math.min(100, Math.max(0, signalScore));
            }
          } catch (intentErr) {
            console.warn('Intent signal lookup failed, using default:', intentErr);
          }

          // Compute reachability from lead data
          let reachabilityScore = 50;
          try {
            const { data: leads } = await supabase
              .from('Leads')
              .select('email_verified, mobile')
              .eq('org_id', org_id)
              .eq('account_external_id', account_external_id)
              .limit(20);

            if (leads && leads.length > 0) {
              const verifiedCount = leads.filter((l: any) => l.email_verified).length;
              const hasPhone = leads.filter((l: any) => l.mobile).length;
              reachabilityScore = Math.min(100, Math.round(
                (verifiedCount / leads.length) * 60 + (hasPhone / leads.length) * 40
              ));
            }
          } catch (reachErr) {
            console.warn('Reachability lookup failed, using default:', reachErr);
          }

          scoreData = {
            overall: data.overall,
            fit: data.overall,
            intent: intentScore,
            reachability: reachabilityScore,
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

    // Store score in database with org-level version
    const scoringVersion = orgScoringVersion;
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

    return successResponse({
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
    });

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(
      ErrorCodes.SCORING_FAILED,
      error instanceof Error ? error.message : 'Unknown scoring error',
      500
    );
  }
});
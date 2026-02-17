import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { successResponse, errorResponse, handleCors, ErrorCodes, parseJsonBody, validateRequired } from '../_shared/response-helpers.ts';
import { checkExistingJob, generateIdempotencyKey, checkIdempotency, recordIdempotencyKey, IDEMPOTENCY_TTL } from '../_shared/idempotency.ts';

interface BulkScoreRequest {
  org_id: string;
  icp_id?: string;
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[bulk-score-accounts] Missing Authorization header');
      return errorResponse(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'Unauthorized - missing authorization header',
        401
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('[bulk-score-accounts] Auth error:', authError?.message);
      return errorResponse(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'Unauthorized - invalid token',
        401
      );
    }

    console.log(`[bulk-score-accounts] Authenticated user: ${user.id}`);

    const requestBody = await parseJsonBody<BulkScoreRequest>(req);
    
    const validation = validateRequired(requestBody, ['org_id']);
    if (!validation.valid) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(', ')}`,
        400
      );
    }
    const { org_id, icp_id } = requestBody!;

    // Verify user belongs to the requested org
    const { data: profile, error: profileError } = await authClient
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.org_id !== org_id) {
      console.error('[bulk-score-accounts] Org access denied for user:', user.id);
      return errorResponse(
        ErrorCodes.FORBIDDEN || 'FORBIDDEN',
        'Forbidden - you do not have access to this organization',
        403
      );
    }

    console.log(`[bulk-score-accounts] User ${user.id} authorized for org ${org_id}`);
    // ========== END AUTHENTICATION ==========

    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('\n=== BULK SCORING JOB STARTED ===');
    console.log('Org ID:', org_id);
    console.log('ICP ID:', icp_id);

    // Check for duplicate request using idempotency
    const idempotencyKey = generateIdempotencyKey(org_id, 'bulk-score-accounts', { org_id, icp_id });
    const idempotencyResult = await checkIdempotency(supabase, idempotencyKey, 'bulk-score-accounts', IDEMPOTENCY_TTL['bulk-score-accounts']);
    
    if (idempotencyResult.isDuplicate && idempotencyResult.cachedResponse) {
      console.log(`[BulkScore] Returning cached response for duplicate request`);
      return successResponse({
        ...idempotencyResult.cachedResponse,
        _cached: true,
      });
    }

    // Check for existing in-progress job for this org
    const { exists: hasExistingJob, existingJob } = await checkExistingJob(
      supabase,
      org_id,
      'bulk_scoring_jobs',
      'status',
      ['pending', 'processing'],
      60
    );

    if (hasExistingJob && existingJob) {
      console.log(`[BulkScore] Found existing job ${existingJob.id}, returning it`);
      return successResponse({
        job_id: existingJob.id,
        message: 'Existing scoring job in progress',
        status: existingJob.status,
        total_accounts: existingJob.total_accounts,
        processed_accounts: existingJob.processed_accounts,
        _existing_job: true,
      });
    }

    // 🧹 Clean up zombie jobs (stuck for >1 hour)
    console.log('🧹 Cleaning up zombie jobs...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabase
      .from('bulk_scoring_jobs')
      .select('id, started_at, last_processed_at')
      .eq('org_id', org_id)
      .eq('status', 'processing')
      .or(`last_processed_at.lt.${oneHourAgo},last_processed_at.is.null,started_at.lt.${oneHourAgo}`);

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck jobs - marking as failed`);
      
      await supabase
        .from('bulk_scoring_jobs')
        .update({ 
          status: 'failed',
          error_message: 'Job stuck for >1 hour - cleaned up automatically',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', stuckJobs.map(j => j.id));
      
      console.log(`✅ Cleaned up ${stuckJobs.length} zombie job(s)`);
    } else {
      console.log('✓ No stuck jobs found');
    }
    
    // ========== CALL SQL-BASED BULK SCORING ==========
    // This single RPC call scores ALL accounts in one SQL operation.
    // The SQL function creates its own job record and completes it.
    console.log(`🚀 Calling bulk_score_all_accounts SQL function...`);
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('bulk_score_all_accounts', {
      p_org_id: org_id,
      p_icp_id: icp_id || null,
    });

    if (rpcError) {
      console.error('❌ bulk_score_all_accounts RPC error:', rpcError);
      throw new Error(`Bulk scoring failed: ${rpcError.message}`);
    }

    console.log('✅ bulk_score_all_accounts completed:', JSON.stringify(rpcResult));

    // Parse the result - the SQL function returns a JSON object
    const result = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;

    // Update match_count for each active ICP after scoring
    console.log('📊 Updating ICP match counts...');
    const { data: icpProfiles } = await supabase
      .from('icp_profiles')
      .select('id, name')
      .eq('org_id', org_id)
      .eq('status', 'active');

    if (icpProfiles && icpProfiles.length > 0) {
      for (const icp of icpProfiles) {
        try {
          const { count } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', org_id)
            .eq('icp_id', icp.id)
            .gte('overall', 70);

          await supabase
            .from('icp_profiles')
            .update({ match_count: count || 0 })
            .eq('id', icp.id);

          console.log(`✓ Updated ${icp.name}: ${count} high-fit matches`);
        } catch (err) {
          console.error(`Failed to update match_count for ICP ${icp.id}:`, err);
        }
      }
    }

    const responseBody = {
      job_id: result?.job_id || null,
      message: 'Scoring completed successfully',
      total_accounts: result?.total_accounts || 0,
      processed: result?.processed || 0,
      duration_seconds: result?.duration_seconds || 0,
      success: true,
    };

    // Record idempotency key with response
    await recordIdempotencyKey(
      supabase,
      idempotencyKey,
      'bulk-score-accounts',
      org_id,
      responseBody,
      IDEMPOTENCY_TTL['bulk-score-accounts']
    );

    console.log('🎉 Bulk scoring complete!');
    return successResponse(responseBody);

  } catch (error) {
    console.error('=== BULK SCORING ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      500,
      { details: 'Check edge function logs for more information' }
    );
  }
});

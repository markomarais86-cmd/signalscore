import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { successResponse, errorResponse, handleCors, ErrorCodes, parseJsonBody, validateRequired } from '../_shared/response-helpers.ts';
import { checkExistingJob, generateIdempotencyKey, checkIdempotency, recordIdempotencyKey, IDEMPOTENCY_TTL } from '../_shared/idempotency.ts';

interface BulkScoreRequest {
  org_id: string;
  icp_id?: string;
  job_id?: string;
  chunk_index?: number;
  chunk_size?: number;
}

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  max_requests: number;
  reset_at: string;
}

// Rate limit helper functions (inlined)
async function checkRateLimit(
  supabase: SupabaseClient,
  orgId: string,
  endpoint: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_org_id: orgId,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return {
        allowed: true,
        current_count: 0,
        max_requests: maxRequests,
        reset_at: new Date().toISOString()
      };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error('Rate limit check exception:', error);
    return {
      allowed: true,
      current_count: 0,
      max_requests: maxRequests,
      reset_at: new Date().toISOString()
    };
  }
}

function rateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${result.max_requests} per ${Math.floor((new Date(result.reset_at).getTime() - Date.now()) / 1000)}s`,
      retry_after: result.reset_at,
      current: result.current_count,
      limit: result.max_requests
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000).toString()
      }
    }
  );
}

  // Background processing function
  async function processAllChunks(
    supabase: SupabaseClient,
    jobId: string,
    orgId: string,
    orgScoringVersion: string,
    icpProfiles: any[],
    totalAccounts: number,
    chunkSize: number
  ) {
  const totalChunks = Math.ceil(totalAccounts / chunkSize);
  console.log(`🚀 Background processing: ${totalChunks} chunks, ${totalAccounts} accounts`);
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    try {
      const startIndex = chunkIndex * chunkSize;
      const endIndex = startIndex + chunkSize - 1;
      
      console.log(`\n[Chunk ${chunkIndex + 1}/${totalChunks}] Fetching accounts ${startIndex}-${endIndex}`);
      
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, name')
        .eq('org_id', orgId)
        .range(startIndex, endIndex);
      
      if (accountsError || !accounts) {
        console.error(`❌ Chunk ${chunkIndex + 1} failed to fetch accounts:`, accountsError);
        continue;
      }
      
      console.log(`✓ Processing ${accounts.length} accounts`);
      
      let chunkSuccessful = 0;
      let chunkErrors = 0;
      
      // Process accounts in batches of 100 for efficiency
      const batchSize = 100;
      for (let i = 0; i < accounts.length; i += batchSize) {
        const batchAccounts = accounts.slice(i, Math.min(i + batchSize, accounts.length));
        
        const scoringPromises = [];
        for (const account of batchAccounts) {
          for (const icp of icpProfiles) {
            scoringPromises.push(
              supabase.rpc('calculate_account_score', {
                p_account_external_id: account.external_id,
                p_icp_id: icp.id,
                p_org_id: orgId
              })
              .then(({ data, error }) => ({ success: !error, account, icp, data, error }))
            );
          }
        }
        
        const results = await Promise.all(scoringPromises);
        chunkSuccessful += results.filter(r => r.success).length;
        chunkErrors += results.filter(r => !r.success).length;
      }
      
      // Update progress
      const processedSoFar = Math.min((chunkIndex + 1) * chunkSize, totalAccounts);
      const isLastChunk = processedSoFar >= totalAccounts;
      
      await supabase.rpc('increment_bulk_scoring_job_progress', {
        job_id_param: jobId,
        chunk_successful: chunkSuccessful,
        chunk_failed: chunkErrors,
        processed_count: processedSoFar,
        current_chunk_num: chunkIndex + 1,
        is_last_chunk: isLastChunk
      });
      
      console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} complete: ${chunkSuccessful} scored, ${chunkErrors} failed`);
      
    } catch (error) {
      console.error(`❌ Chunk ${chunkIndex + 1} error:`, error);
    }
  }
  
  console.log(`🎉 All ${totalAccounts} accounts scored!`);
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

    // Create auth client to verify user
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
    
    // Validate required fields
    const validation = validateRequired(requestBody, ['org_id']);
    if (!validation.valid) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(', ')}`,
        400
      );
    }
    const { org_id, icp_id, chunk_size = 5000 } = requestBody!;

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
    console.log('Chunk Size:', chunk_size);

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
      60 // 60 minutes
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
      
      const { error: updateError } = await supabase
        .from('bulk_scoring_jobs')
        .update({ 
          status: 'failed',
          error_message: 'Job stuck for >1 hour - cleaned up automatically',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', stuckJobs.map(j => j.id));
      
      if (updateError) {
        console.error('Failed to update stuck jobs:', updateError);
      } else {
        console.log(`✅ Cleaned up ${stuckJobs.length} zombie job(s)`);
      }
    } else {
      console.log('✓ No stuck jobs found');
    }
    
    // Get total account count
    const { count: totalAccounts, error: countError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    if (countError || !totalAccounts) {
      throw new Error(`Failed to count accounts: ${countError?.message}`);
    }

    console.log(`✓ Total accounts: ${totalAccounts}`);

    // Create new job
    const totalChunks = Math.ceil(totalAccounts / chunk_size);
    const { data: newJob, error: jobError } = await supabase
      .from('bulk_scoring_jobs')
      .insert({
        org_id,
        icp_id,
        total_accounts: totalAccounts,
        total_chunks: totalChunks,
        chunk_size,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !newJob) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    const jobId = newJob.id;
    console.log(`✓ Created job: ${jobId} (${totalChunks} chunks)`);

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
    console.log(`✓ Using org-level scoring version: ${orgScoringVersion}`);

    // Get ICP profiles
    const icpQuery = supabase
      .from('icp_profiles')
      .select('id, name')
      .eq('org_id', org_id)
      .eq('status', 'active');
    
    if (icp_id) {
      icpQuery.eq('id', icp_id);
    }

    const { data: icpProfiles, error: icpError } = await icpQuery;

    if (icpError || !icpProfiles || icpProfiles.length === 0) {
      throw new Error('No active ICP profiles found');
    }

    console.log(`✓ Found ${icpProfiles.length} active ICP profile(s)`);

    // Start background processing immediately
    // @ts-ignore - EdgeRuntime is available in Deno
    EdgeRuntime.waitUntil(
      processAllChunks(supabase, jobId, org_id, orgScoringVersion, icpProfiles, totalAccounts, chunk_size)
    );

    const responseBody = {
      job_id: jobId,
      message: "Scoring started in background",
      total_accounts: totalAccounts,
      total_chunks: totalChunks,
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

    // Return immediately - scoring happens in background
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

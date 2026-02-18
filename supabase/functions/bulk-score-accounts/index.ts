import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { successResponse, errorResponse, handleCors, ErrorCodes, parseJsonBody, validateRequired } from '../_shared/response-helpers.ts';
import { checkExistingJob, generateIdempotencyKey, checkIdempotency, recordIdempotencyKey, IDEMPOTENCY_TTL } from '../_shared/idempotency.ts';

const CHUNK_SIZE = 2000;
const MAX_RUNTIME_MS = 50_000; // Leave 10s buffer before 60s edge function limit

interface BulkScoreRequest {
  org_id: string;
  icp_id?: string;
  job_id?: string; // For resuming an existing job
}

interface IcpProfile {
  id: string;
  name: string;
  industries: string[] | null;
  company_sizes: number[] | null;
  geographies: string[] | null;
  revenue_ranges: string[] | null;
  vertical_filters: Record<string, unknown> | null;
}

interface AccountRow {
  external_id: string;
  industry_norm: string | null;
  employee_count: number | null;
  country: string | null;
  revenue_range: string | null;
  custom_attributes: Record<string, unknown> | null;
}

// ========== JS SCORING ENGINE (mirrors calculate_account_score_readonly) ==========

function scoreAccount(account: AccountRow, icp: IcpProfile) {
  let industryScore = 0;
  let sizeScore = 0;
  let geoScore = 0;
  let revenueScore = 0;
  let verticalScore = 0;
  let matches = 0;

  // Industry scoring (30 points) - fuzzy LIKE match
  if (account.industry_norm && icp.industries?.length) {
    const normLower = account.industry_norm.toLowerCase();
    const matched = icp.industries.some(ind => {
      const indLower = ind.toLowerCase();
      return normLower.includes(indLower) || indLower.includes(normLower);
    });
    if (matched) { industryScore = 30; matches++; }
  }

  // Size scoring (25 points) - range-based
  if (account.employee_count != null && icp.company_sizes?.length) {
    const ec = account.employee_count;
    const sizeMatch = icp.company_sizes.some(s => s === ec) ||
      (ec >= 100 && icp.company_sizes.includes(200)) ||
      (ec >= 400 && icp.company_sizes.includes(500)) ||
      (ec >= 800 && icp.company_sizes.includes(1000));
    if (sizeMatch) { sizeScore = 25; matches++; }
  }

  // Geography scoring (25 points) - exact country match
  if (account.country && icp.geographies?.length) {
    const countryLower = account.country.toLowerCase();
    if (icp.geographies.some(g => g.toLowerCase() === countryLower)) {
      geoScore = 25; matches++;
    }
  }

  // Revenue scoring (20 points) - exact range match
  if (account.revenue_range && icp.revenue_ranges?.length) {
    if (icp.revenue_ranges.includes(account.revenue_range)) {
      revenueScore = 20; matches++;
    }
  }

  // Vertical / custom attribute scoring (up to 15 bonus points)
  if (icp.vertical_filters && Object.keys(icp.vertical_filters).length > 0) {
    const vf = icp.vertical_filters as Record<string, unknown>;

    // Handle segments-based vertical filters (healthcare-style)
    if (Array.isArray(vf.segments) && vf.segments.length > 0) {
      const segments = vf.segments as Array<{ name?: string; size?: string; bed_range?: string; key_personas?: string[] }>;
      const ec = account.employee_count;
      const attrs = account.custom_attributes || {};
      const bedCount = attrs.bed_count != null ? Number(attrs.bed_count) : null;

      // Size label to employee_count range mapping
      const sizeRanges: Record<string, [number, number]> = {
        'small': [1, 100],
        'small-mid': [30, 300],
        'mid-large': [200, 5000],
        'large': [500, 999999],
      };

      let bestSegmentScore = 0;

      for (const seg of segments) {
        let critTotal = 0;
        let critMatched = 0;

        // Match on size label using employee_count
        if (seg.size && ec != null) {
          critTotal++;
          const sizeLower = seg.size.toLowerCase();
          const range = sizeRanges[sizeLower];
          if (range && ec >= range[0] && ec <= range[1]) critMatched++;
        }

        // Match on bed_range if bed_count custom attribute exists
        if (seg.bed_range && bedCount != null) {
          critTotal++;
          const rangeParts = seg.bed_range.replace('+', '').split('-').map(s => parseInt(s.trim(), 10));
          const minBeds = rangeParts[0] || 0;
          const maxBeds = seg.bed_range.includes('+') ? 999999 : (rangeParts[1] || 999999);
          if (bedCount >= minBeds && bedCount <= maxBeds) critMatched++;
        }

        // Match on key_personas against persona_job_titles in ICP (already scored elsewhere, but gives vertical affinity)
        // Skip to avoid double-counting

        if (critTotal > 0) {
          const segScore = Math.round(15 * critMatched / critTotal);
          bestSegmentScore = Math.max(bestSegmentScore, segScore);
        }
      }

      verticalScore = bestSegmentScore;
      if (verticalScore > 0) matches++;

    // Handle flat key-value vertical filters (original logic)
    } else if (account.custom_attributes) {
      let totalCriteria = 0;
      let matchedCriteria = 0;

      for (const [key, val] of Object.entries(vf)) {
        if (val == null) continue;
        totalCriteria++;

        const attrs = account.custom_attributes;
        if (key.endsWith('_min')) {
          const attrKey = key.replace(/_min$/, '');
          const attrVal = (attrs as Record<string, unknown>)[attrKey];
          if (attrVal != null && Number(attrVal) >= Number(val)) matchedCriteria++;
        } else if (key.endsWith('_max')) {
          const attrKey = key.replace(/_max$/, '');
          const attrVal = (attrs as Record<string, unknown>)[attrKey];
          if (attrVal != null && Number(attrVal) <= Number(val)) matchedCriteria++;
        } else if (Array.isArray(val)) {
          const attrVal = (attrs as Record<string, unknown>)[key];
          if (attrVal != null && val.includes(String(attrVal))) matchedCriteria++;
        } else {
          const attrVal = (attrs as Record<string, unknown>)[key];
          if (attrVal != null && String(attrVal).toLowerCase() === String(val).toLowerCase()) matchedCriteria++;
        }
      }

      if (totalCriteria > 0) {
        verticalScore = Math.round(15 * matchedCriteria / totalCriteria);
        if (matchedCriteria > 0) matches++;
      }
    }
  }

  let totalScore = industryScore + sizeScore + geoScore + revenueScore + verticalScore;

  // Multi-criteria boost
  if (matches >= 3) totalScore = Math.min(100, totalScore + 10);

  const fitScore = totalScore;

  return {
    overall: totalScore,
    fit: fitScore,
    intent: 50,
    reachability: 70,
    breakdown: { industry_score: industryScore, size_score: sizeScore, geo_score: geoScore, revenue_score: revenueScore, vertical_score: verticalScore, matches },
  };
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Unauthorized - missing authorization header', 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Unauthorized - invalid token', 401);
    }

    const requestBody = await parseJsonBody<BulkScoreRequest>(req);
    const validation = validateRequired(requestBody, ['org_id']);
    if (!validation.valid) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, `Missing required fields: ${validation.missing.join(', ')}`, 400);
    }
    const { org_id, icp_id, job_id: resumeJobId } = requestBody!;

    // ========== RESOLVE DATA ORG (parent) FOR ACCOUNT QUERIES ==========
    // Child orgs share accounts with their parent org. Use dataOrgId for
    // account queries, but keep org_id for ICP profiles and score writes.
    const supabaseForOrg = createClient(supabaseUrl, supabaseServiceKey);
    const { data: orgData } = await supabaseForOrg
      .from('organizations')
      .select('parent_org_id')
      .eq('id', org_id)
      .single();
    const dataOrgId = orgData?.parent_org_id || org_id;
    console.log(`Data org: ${dataOrgId} (child of parent: ${dataOrgId !== org_id})`);

    // Verify org access — allow if user belongs to the requested org OR its parent
    const { data: profile, error: profileError } = await authClient
      .from('user_profiles').select('org_id').eq('user_id', user.id).single();
    const userOrgId = profile?.org_id;
    const hasAccess = userOrgId === org_id || userOrgId === dataOrgId;
    if (profileError || !profile || !hasAccess) {
      console.log(`Access denied: user org ${userOrgId}, requested org ${org_id}, data org ${dataOrgId}`);
      return errorResponse(ErrorCodes.FORBIDDEN, 'Forbidden - you do not have access to this organization', 403);
    }

    // ========== SERVICE CLIENT ==========
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const startTime = Date.now();

    console.log(`\n=== BULK SCORING (CHUNKED) ===`);
    console.log(`Org: ${org_id}, ICP: ${icp_id || 'all'}, Resume: ${resumeJobId || 'no'}`);

    // ========== IDEMPOTENCY CHECK ==========
    if (!resumeJobId) {
      const idempotencyKey = generateIdempotencyKey(org_id, 'bulk-score-accounts', { org_id, icp_id });
      const idempotencyResult = await checkIdempotency(supabase, idempotencyKey, 'bulk-score-accounts', IDEMPOTENCY_TTL['bulk-score-accounts']);
      if (idempotencyResult.isDuplicate && idempotencyResult.cachedResponse) {
        return successResponse({ ...idempotencyResult.cachedResponse, _cached: true });
      }

      // Check for existing in-progress job
      const { exists: hasExistingJob, existingJob } = await checkExistingJob(
        supabase, org_id, 'bulk_scoring_jobs', 'status', ['pending', 'processing'], 60
      );
      if (hasExistingJob && existingJob) {
        return successResponse({
          job_id: existingJob.id, message: 'Existing scoring job in progress',
          status: existingJob.status, total_accounts: existingJob.total_accounts,
          processed_accounts: existingJob.processed_accounts, _existing_job: true,
        });
      }
    }

    // ========== FETCH ALL ICP PROFILES ==========
    let icpQuery = supabase.from('icp_profiles')
      .select('id, name, industries, company_sizes, geographies, revenue_ranges, vertical_filters')
      .eq('org_id', org_id).eq('status', 'active');
    if (icp_id) icpQuery = icpQuery.eq('id', icp_id);

    const { data: icpProfiles, error: icpError } = await icpQuery;
    if (icpError || !icpProfiles?.length) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'No active ICP profiles found', 400);
    }
    console.log(`Found ${icpProfiles.length} ICP profile(s)`);

    // ========== COUNT TOTAL ACCOUNTS ==========
    const { count: totalAccounts } = await supabase
      .from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', dataOrgId);

    const total = totalAccounts || 0;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);
    console.log(`Total accounts: ${total}, Chunks: ${totalChunks}`);

    // ========== CREATE OR RESUME JOB ==========
    let jobId = resumeJobId;
    let startChunk = 0;
    let processedSoFar = 0;

    if (resumeJobId) {
      // Resuming - read progress
      const { data: existingJob } = await supabase
        .from('bulk_scoring_jobs').select('current_chunk, processed_accounts').eq('id', resumeJobId).single();
      if (existingJob) {
        startChunk = existingJob.current_chunk || 0;
        processedSoFar = existingJob.processed_accounts || 0;
        console.log(`Resuming job ${resumeJobId} from chunk ${startChunk}`);
      }
    } else {
      // Create new job
      const { data: newJob, error: jobErr } = await supabase.from('bulk_scoring_jobs').insert({
        org_id,
        icp_id: icp_id || null,
        status: 'processing',
        total_accounts: total,
        total_chunks: totalChunks,
        chunk_size: CHUNK_SIZE,
        current_chunk: 0,
        processed_accounts: 0,
        successful_scores: 0,
        failed_scores: 0,
        started_at: new Date().toISOString(),
      }).select('id').single();

      if (jobErr || !newJob) {
        console.error('Failed to create job:', jobErr);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create scoring job', 500);
      }
      jobId = newJob.id;
      console.log(`Created job: ${jobId}`);
    }

    // ========== PROCESS CHUNKS ==========
    let successfulScores = 0;
    let failedScores = 0;
    let chunksProcessed = 0;
    let timedOut = false;

    for (let chunk = startChunk; chunk < totalChunks; chunk++) {
      // Check time budget
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`⏰ Time budget exceeded after ${chunksProcessed} chunks, pausing job`);
        timedOut = true;
        break;
      }

      const offset = chunk * CHUNK_SIZE;
      console.log(`📦 Chunk ${chunk + 1}/${totalChunks} (offset ${offset})`);

      // Fetch batch of accounts
      const { data: accounts, error: fetchErr } = await supabase
        .from('accounts')
        .select('external_id, industry_norm, employee_count, country, revenue_range, custom_attributes')
        .eq('org_id', dataOrgId)
        .order('external_id', { ascending: true })
        .range(offset, offset + CHUNK_SIZE - 1);

      if (fetchErr) {
        console.error(`Fetch error chunk ${chunk}:`, fetchErr);
        failedScores += CHUNK_SIZE;
        continue;
      }

      if (!accounts?.length) {
        console.log(`Chunk ${chunk} empty, skipping`);
        continue;
      }

      // Score each account against each ICP
      const scoreRows: Array<{
        org_id: string; account_external_id: string; icp_id: string;
        overall: number; fit: number; intent: number; reachability: number;
        reasons: Record<string, unknown>; scoring_version: string; computed_at: string;
      }> = [];

      for (const account of accounts) {
        for (const icp of icpProfiles) {
          try {
            const result = scoreAccount(account as AccountRow, icp as IcpProfile);
            scoreRows.push({
              org_id,
              account_external_id: account.external_id,
              icp_id: icp.id,
              overall: result.overall,
              fit: result.fit,
              intent: result.intent,
              reachability: result.reachability,
              reasons: result.breakdown as unknown as Record<string, unknown>,
              scoring_version: 'chunked_v1',
              computed_at: new Date().toISOString(),
            });
            successfulScores++;
          } catch (e) {
            failedScores++;
          }
        }
      }

      // Upsert scores in bulk
      if (scoreRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('scores')
          .upsert(scoreRows, { onConflict: 'org_id,account_external_id' });

        if (upsertErr) {
          console.error(`Upsert error chunk ${chunk}:`, upsertErr);
          // Scores were counted as successful but upsert failed - adjust
          failedScores += scoreRows.length;
          successfulScores -= scoreRows.length;
        }
      }

      processedSoFar += accounts.length;
      chunksProcessed++;

      // Update job progress
      await supabase.from('bulk_scoring_jobs').update({
        current_chunk: chunk + 1,
        processed_accounts: processedSoFar,
        successful_scores: successfulScores,
        failed_scores: failedScores,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    // ========== FINALIZE ==========
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    if (timedOut) {
      // Mark as paused so auto-recovery can resume
      await supabase.from('bulk_scoring_jobs').update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);

      console.log(`⏸️ Job paused after ${chunksProcessed} chunks (${processedSoFar}/${total})`);
      return successResponse({
        job_id: jobId, message: 'Scoring in progress - will auto-resume',
        status: 'processing', total_accounts: total,
        processed_accounts: processedSoFar, duration_seconds: durationSeconds,
        chunks_processed: chunksProcessed, success: true,
      });
    }

    // Complete - update job and ICP match counts
    await supabase.from('bulk_scoring_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processed_accounts: processedSoFar,
      successful_scores: successfulScores,
      failed_scores: failedScores,
    }).eq('id', jobId);

    // Update match_count for each ICP
    for (const icp of icpProfiles) {
      try {
        const { count } = await supabase.from('scores')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', org_id).eq('icp_id', icp.id).gte('overall', 70);
        await supabase.from('icp_profiles').update({ match_count: count || 0 }).eq('id', icp.id);
      } catch (_) { /* best effort */ }
    }

    const responseBody = {
      job_id: jobId, message: 'Scoring completed successfully',
      total_accounts: total, processed: processedSoFar,
      successful_scores: successfulScores, failed_scores: failedScores,
      duration_seconds: durationSeconds, success: true,
    };

    // Record idempotency
    const idempotencyKey = generateIdempotencyKey(org_id, 'bulk-score-accounts', { org_id, icp_id });
    await recordIdempotencyKey(supabase, idempotencyKey, 'bulk-score-accounts', org_id, responseBody, IDEMPOTENCY_TTL['bulk-score-accounts']);

    console.log(`🎉 Scoring complete! ${processedSoFar} accounts in ${durationSeconds}s`);
    return successResponse(responseBody);

  } catch (error) {
    console.error('=== BULK SCORING ERROR ===', error.message, error.stack);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'An unexpected error occurred', 500);
  }
});

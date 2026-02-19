import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { successResponse, errorResponse, handleCors, ErrorCodes, parseJsonBody, validateRequired } from '../_shared/response-helpers.ts';
import { checkExistingJob, generateIdempotencyKey, checkIdempotency, recordIdempotencyKey, IDEMPOTENCY_TTL } from '../_shared/idempotency.ts';

const CHUNK_SIZE = 500;
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
  excluded_industries: string[] | null;
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

// ========== JS SCORING ENGINE (segment-weighted, mirrors calculate_account_score_readonly) ==========

function scoreAccount(account: AccountRow, icp: IcpProfile, intentMap?: Map<string, number>) {
  const intentScore = intentMap?.get(account.external_id) ?? 50;
  let industryScore = 0;
  let sizeScore = 0;
  let geoScore = 0;
  let revenueScore = 0;
  let segmentScore = 0;
  let matches = 0;
  let matchedSegmentName: string | null = null;
  let missingRequiredVertical = false;

  // --- Excluded industries check ---
  if (account.industry_norm && icp.excluded_industries?.length) {
    const normLower = account.industry_norm.toLowerCase();
    const excluded = icp.excluded_industries.some(ex => normLower.includes(ex.toLowerCase()));
    if (excluded) {
      return {
        overall: 0, fit: 0, intent: intentScore, reachability: 0,
        breakdown: { industry_score: 0, size_score: 0, geo_score: 0, revenue_score: 0, segment_score: 0, matches: 0, missing_required_vertical: false, matched_segment: null },
      };
    }
  }

  // --- Industry scoring (20 points) ---
  if (account.industry_norm && icp.industries?.length) {
    const normLower = account.industry_norm.toLowerCase();
    const tokens = normLower.split(/[,\/&;]+/).map(t => t.trim()).filter(t => t.length > 0);
    const matched = icp.industries.some(ind => {
      const indLower = ind.toLowerCase();
      return normLower.includes(indLower) || indLower.includes(normLower) ||
        tokens.some(token => token.includes(indLower) || indLower.includes(token));
    });
    if (matched) { industryScore = 20; matches++; }
  }

  // --- Size scoring (15 points) ---
  if (account.employee_count != null && icp.company_sizes?.length) {
    const ec = account.employee_count;
    const sortedSizes = [...icp.company_sizes].sort((a, b) => a - b);
    const minSize = sortedSizes[0];
    const maxSize = sortedSizes[sortedSizes.length - 1];
    if (ec >= minSize && ec <= maxSize) {
      sizeScore = 15; matches++;
    } else if (ec >= minSize * 0.5 && ec <= maxSize * 2) {
      sizeScore = 8; matches++;
    }
  }

  // --- Geography scoring (10 points) ---
  if (account.country && icp.geographies?.length) {
    const countryLower = account.country.toLowerCase();
    if (icp.geographies.some(g => g.toLowerCase() === countryLower)) {
      geoScore = 10; matches++;
    }
  }

  // --- Revenue scoring (20 points) - tiered by parsed dollar value ---
  if (account.revenue_range && icp.revenue_ranges?.length) {
    if (icp.revenue_ranges.includes(account.revenue_range)) {
      // Parse approximate dollar value from range string to tier
      const revStr = account.revenue_range.toLowerCase();
      const isEnterprise = revStr.includes('$1b') || revStr.includes('$5b') || revStr.includes('$10b') ||
        revStr.includes('$250m') || revStr.includes('$500m');
      if (isEnterprise) {
        revenueScore = 20; matches++;
      } else {
        revenueScore = 12; matches++;
      }
    }
  }

  // --- Segment scoring (30 points) — the core differentiator ---
  const vf = icp.vertical_filters as Record<string, unknown> | null;
  if (vf && Array.isArray(vf.segments) && vf.segments.length > 0) {
    const segments = vf.segments as Array<{ name?: string; size?: string; bed_range?: string; key_personas?: string[] }>;
    const ec = account.employee_count;
    const attrs = (account.custom_attributes || {}) as Record<string, unknown>;
    const bedCount = attrs.bed_count != null ? Number(attrs.bed_count) : null;

    const sizeRanges: Record<string, [number, number]> = {
      'small': [1, 100],
      'small-mid': [30, 300],
      'mid-large': [200, 5000],
      'large': [500, 999999],
    };

    const anySegHasBeds = segments.some(s => s.bed_range != null);
    if (anySegHasBeds && bedCount == null) {
      missingRequiredVertical = true;
    }

    let bestScore = 0;
    let bestSegName: string | null = null;

    for (const seg of segments) {
      let critTotal = 0;
      let critMatched = 0;

      // Bed range matching (primary criterion)
      if (seg.bed_range) {
        critTotal += 2; // Double weight for bed_count
        if (bedCount != null) {
          const rangeParts = seg.bed_range.replace('+', '').split('-').map(s => parseInt(s.trim(), 10));
          const minBeds = rangeParts[0] || 0;
          const maxBeds = seg.bed_range.includes('+') ? 999999 : (rangeParts[1] || 999999);
          if (bedCount >= minBeds && bedCount <= maxBeds) critMatched += 2;
        }
      }

      // Size tier matching
      if (seg.size && ec != null) {
        critTotal++;
        const sizeLower = seg.size.toLowerCase();
        const range = sizeRanges[sizeLower];
        if (range && ec >= range[0] && ec <= range[1]) critMatched++;
      }

      if (critTotal > 0) {
        const score = Math.round(30 * critMatched / critTotal);
        if (score > bestScore) {
          bestScore = score;
          bestSegName = seg.name || null;
        }
      }
    }

    segmentScore = bestScore;
    matchedSegmentName = bestSegName;
    if (segmentScore > 0) matches++;

  } else if (icp.vertical_filters && account.custom_attributes) {
    // Flat key-value vertical filters (non-segment ICPs)
    const vfFlat = icp.vertical_filters as Record<string, unknown>;
    let totalCriteria = 0;
    let matchedCriteria = 0;

    for (const [key, val] of Object.entries(vfFlat)) {
      if (val == null || key === 'segments') continue;
      totalCriteria++;
      const attrs = account.custom_attributes as Record<string, unknown>;
      if (key.endsWith('_min')) {
        const attrKey = key.replace(/_min$/, '');
        const attrVal = attrs[attrKey];
        if (attrVal != null && Number(attrVal) >= Number(val)) matchedCriteria++;
      } else if (key.endsWith('_max')) {
        const attrKey = key.replace(/_max$/, '');
        const attrVal = attrs[attrKey];
        if (attrVal != null && Number(attrVal) <= Number(val)) matchedCriteria++;
      } else if (Array.isArray(val)) {
        const attrVal = attrs[key];
        if (attrVal != null && val.includes(String(attrVal))) matchedCriteria++;
      } else {
        const attrVal = attrs[key];
        if (attrVal != null && String(attrVal).toLowerCase() === String(val).toLowerCase()) matchedCriteria++;
      }
    }
    if (totalCriteria > 0) {
      segmentScore = Math.round(30 * matchedCriteria / totalCriteria);
      if (matchedCriteria > 0) matches++;
    }
  }

  // --- Total score (max 95 base + 5 boost = 100) ---
  let totalScore = industryScore + sizeScore + geoScore + revenueScore + segmentScore;

  // Multi-criteria boost: 3+ dimensions matched
  if (matches >= 3) totalScore = Math.min(100, totalScore + 5);

  let fitScore = totalScore;

  // Proportional penalty (15%) + cap at 69 when bed_count is missing
  // Prevents Band A assignment while preserving score differentiation
  if (missingRequiredVertical) {
    totalScore = Math.min(Math.round(totalScore * 0.85), 69);
    fitScore = Math.min(Math.round(fitScore * 0.85), 69);
  }

  return {
    overall: totalScore,
    fit: fitScore,
    intent: intentScore,
    reachability: 70,
    breakdown: { industry_score: industryScore, size_score: sizeScore, geo_score: geoScore, revenue_score: revenueScore, segment_score: segmentScore, matches, missing_required_vertical: missingRequiredVertical, matched_segment: matchedSegmentName },
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

    // Detect service role key (used by auto-recovery cron)
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      // Regular user auth flow
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return errorResponse(ErrorCodes.UNAUTHORIZED, 'Unauthorized - invalid token', 401);
      }

      // Parse body early so we can check org access
      const requestBody = await parseJsonBody<BulkScoreRequest>(req);
      const validation = validateRequired(requestBody, ['org_id']);
      if (!validation.valid) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Missing required fields: ${validation.missing.join(', ')}`, 400);
      }
      var { org_id, icp_id, job_id: requestedJobId } = requestBody!;
      var resumeJobId = requestedJobId;

      // Resolve data org for access check
      const supabaseForOrg = createClient(supabaseUrl, supabaseServiceKey);
      const { data: orgData } = await supabaseForOrg
        .from('organizations')
        .select('parent_org_id')
        .eq('id', org_id)
        .single();
      var dataOrgId = orgData?.parent_org_id || org_id;

      // Verify org access
      const { data: profile, error: profileError } = await authClient
        .from('user_profiles').select('org_id').eq('user_id', user.id).single();
      const userOrgId = profile?.org_id;
      const hasAccess = userOrgId === org_id || userOrgId === dataOrgId;
      if (profileError || !profile || !hasAccess) {
        console.log(`Access denied: user org ${userOrgId}, requested org ${org_id}, data org ${dataOrgId}`);
        return errorResponse(ErrorCodes.FORBIDDEN, 'Forbidden - you do not have access to this organization', 403);
      }
    } else {
      // Service role auth (auto-recovery cron) — skip user check
      console.log('[Auth] Service role key detected — skipping user auth');
      const requestBody = await parseJsonBody<BulkScoreRequest>(req);
      const validation = validateRequired(requestBody, ['org_id']);
      if (!validation.valid) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, `Missing required fields: ${validation.missing.join(', ')}`, 400);
      }
      var { org_id, icp_id, job_id: requestedJobId } = requestBody!;
      var resumeJobId = requestedJobId;

      // Resolve data org
      const supabaseForOrg = createClient(supabaseUrl, supabaseServiceKey);
      const { data: orgData } = await supabaseForOrg
        .from('organizations')
        .select('parent_org_id')
        .eq('id', org_id)
        .single();
      var dataOrgId = orgData?.parent_org_id || org_id;
    }
    console.log(`Data org: ${dataOrgId} (child of parent: ${dataOrgId !== org_id})`);
    console.log(`Auth: ${isServiceRole ? 'service-role' : 'user-jwt'}, Org: ${org_id}`);

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
        const jobAge = Date.now() - new Date(existingJob.updated_at).getTime();
        if (jobAge > 60_000) {
          // Stale for > 1 minute — resume instead of blocking
          console.log(`Resuming stale job ${existingJob.id} (age: ${Math.round(jobAge / 1000)}s)`);
          resumeJobId = existingJob.id;
        } else {
          return successResponse({
            job_id: existingJob.id, message: 'Existing scoring job in progress',
            status: existingJob.status, total_accounts: existingJob.total_accounts,
            processed_accounts: existingJob.processed_accounts, _existing_job: true,
          });
        }
      }
    }

    // ========== FETCH ALL ICP PROFILES ==========
    let icpQuery = supabase.from('icp_profiles')
      .select('id, name, industries, excluded_industries, company_sizes, geographies, revenue_ranges, vertical_filters')
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

    // ========== COMPUTE INTENT SIGNALS FROM SCORE HISTORY ==========
    const intentMap = new Map<string, number>();
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentHistory } = await supabase
        .from('score_history')
        .select('account_external_id, old_score, new_score, computed_at')
        .eq('org_id', org_id)
        .gte('computed_at', thirtyDaysAgo)
        .order('computed_at', { ascending: false })
        .limit(5000);

      if (recentHistory?.length) {
        // Group by account and compute intent
        const byAccount = new Map<string, Array<{ old_overall: number; new_overall: number; computed_at: string }>>();
        for (const h of recentHistory) {
          const oldScore = (h.old_score as any)?.overall ?? 0;
          const newScore = (h.new_score as any)?.overall ?? 0;
          if (!byAccount.has(h.account_external_id)) byAccount.set(h.account_external_id, []);
          byAccount.get(h.account_external_id)!.push({ old_overall: oldScore, new_overall: newScore, computed_at: h.computed_at });
        }

        for (const [accountId, entries] of byAccount) {
          let intent = 50; // baseline
          const latestDelta = entries[0].new_overall - entries[0].old_overall;
          if (latestDelta > 10) intent = 75;       // Recent big improvement
          else if (latestDelta > 0) intent = 65;    // Recent improvement
          else if (entries.length >= 2 && entries[0].new_overall >= 60) intent = 60; // Stable high fit
          else if (latestDelta < -10) intent = 35;  // Declining
          intentMap.set(accountId, intent);
        }
        console.log(`Computed intent signals for ${intentMap.size} accounts from score_history`);
      }
    } catch (e) {
      console.log('Intent signal computation skipped (non-critical):', e.message);
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
            const result = scoreAccount(account as AccountRow, icp as IcpProfile, intentMap);
            scoreRows.push({
              org_id,
              account_external_id: account.external_id,
              icp_id: icp.id,
    overall: result.overall,
              fit: result.fit,
              intent: result.intent,
              reachability: result.reachability,
              reasons: result.breakdown as unknown as Record<string, unknown>,
              scoring_version: 'chunked_v3_soft_penalty',
              computed_at: new Date().toISOString(),
            });
            successfulScores++;
          } catch (e) {
            failedScores++;
          }
        }
      }

      // Upsert scores in bulk with retry on failure
      if (scoreRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('scores')
          .upsert(scoreRows, { onConflict: 'org_id,account_external_id' });

        if (upsertErr) {
          console.warn(`Upsert error chunk ${chunk}, retrying with smaller batches:`, upsertErr.message);
          // Retry with smaller sub-chunks of 100
          const RETRY_SIZE = 100;
          let retrySuccess = 0;
          let retryFail = 0;
          for (let r = 0; r < scoreRows.length; r += RETRY_SIZE) {
            const subChunk = scoreRows.slice(r, r + RETRY_SIZE);
            const { error: retryErr } = await supabase
              .from('scores')
              .upsert(subChunk, { onConflict: 'org_id,account_external_id' });
            if (retryErr) {
              console.error(`Retry sub-chunk failed:`, retryErr.message);
              retryFail += subChunk.length;
            } else {
              retrySuccess += subChunk.length;
            }
          }
          // Adjust counts based on retry results
          failedScores += retryFail;
          successfulScores -= retryFail;
          console.log(`Retry results: ${retrySuccess} succeeded, ${retryFail} failed`);
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
          .eq('org_id', org_id).eq('icp_id', icp.id).gte('overall', 60);
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

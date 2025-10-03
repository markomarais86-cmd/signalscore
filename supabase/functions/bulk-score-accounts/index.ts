import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkScoreRequest {
  org_id: string;
  icp_id?: string;
  job_id?: string;
  chunk_index?: number;
  chunk_size?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const requestBody = await req.json() as BulkScoreRequest;
    const { org_id, icp_id, job_id, chunk_index, chunk_size = 2000 } = requestBody;
    
    console.log('\n=== BULK SCORING CHUNK STARTED ===');
    console.log('Org ID:', org_id);
    console.log('Job ID:', job_id);
    console.log('Chunk Index:', chunk_index);
    console.log('Chunk Size:', chunk_size);
    console.log('Timestamp:', new Date().toISOString());

    // SERVER-SIDE IDEMPOTENCY: Check if this chunk has already been processed
    if (job_id && chunk_index !== undefined) {
      const startIndex = chunk_index * chunk_size;
      const endIndex = startIndex + chunk_size;
      
      // Check if we already have scores for accounts in this range
      const { data: existingJob } = await supabase
        .from('bulk_scoring_jobs')
        .select('processed_accounts, current_chunk, status')
        .eq('id', job_id)
        .single();
      
      if (existingJob) {
        const expectedProcessed = (chunk_index + 1) * chunk_size;
        
        // If this chunk was already processed, skip it
        if (existingJob.processed_accounts >= expectedProcessed) {
          console.log(`⚠️ SKIPPING: Chunk ${chunk_index} already processed (processed: ${existingJob.processed_accounts}, expected: ${expectedProcessed})`);
          
          return new Response(
            JSON.stringify({
              success: true,
              skipped: true,
              reason: 'Chunk already processed',
              job_id: job_id,
              chunk_index: chunk_index,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`✓ Idempotency check passed: Processing chunk ${chunk_index} (processed: ${existingJob.processed_accounts}, expected: ${expectedProcessed})`);
      }
    }

    // If no job_id provided, create a new job
    let currentJobId = job_id;
    let currentChunkIndex = chunk_index ?? 0;
    
    // Get total account count first
    const { count: totalAccounts, error: countError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    if (countError) {
      console.error('Failed to count accounts:', countError);
      throw new Error(`Failed to count accounts: ${countError.message}`);
    }

    console.log(`Total accounts to score: ${totalAccounts}`);

    // Create job if this is the first chunk
    if (!currentJobId) {
      const totalChunks = Math.ceil((totalAccounts || 0) / chunk_size);
      
      const { data: newJob, error: jobError } = await supabase
        .from('bulk_scoring_jobs')
        .insert({
          org_id,
          icp_id,
          total_accounts: totalAccounts || 0,
          total_chunks: totalChunks,
          chunk_size,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError || !newJob) {
        console.error('Failed to create job:', jobError);
        throw new Error(`Failed to create job: ${jobError?.message}`);
      }

      currentJobId = newJob.id;
      console.log(`✓ Created new job: ${currentJobId} (${totalChunks} chunks)`);
    } else {
      // Update existing job
      await supabase
        .from('bulk_scoring_jobs')
        .update({
          status: 'processing',
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', currentJobId);
    }

    // Fetch accounts for this chunk
    const startIndex = currentChunkIndex * chunk_size;
    const endIndex = startIndex + chunk_size - 1;
    
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name')
      .eq('org_id', org_id)
      .range(startIndex, endIndex);

    if (accountsError || !accounts) {
      console.error('Failed to fetch accounts:', accountsError);
      throw new Error(`Failed to fetch accounts: ${accountsError?.message}`);
    }

    console.log(`✓ Fetched ${accounts.length} accounts for chunk ${currentChunkIndex + 1}`);

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
      console.error('No active ICP profiles found:', icpError);
      throw new Error('No active ICP profiles found');
    }

    console.log(`✓ Found ${icpProfiles.length} active ICP profile(s)`);

    console.log(`\n=== PROCESSING CHUNK ${currentChunkIndex + 1} ===`);
    console.log(`Accounts in this chunk: ${accounts.length}\n`);

    let chunkSuccessful = 0;
    let chunkErrors = 0;
    const batchSize = 500;
    const totalBatches = Math.ceil(accounts.length / batchSize);

    // Process in smaller batches within the chunk
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, accounts.length);
      const batchAccounts = accounts.slice(batchStart, batchEnd);
      
      console.log(`\n[Batch ${batchIndex + 1}/${totalBatches}] Processing accounts ${startIndex + batchStart + 1}-${startIndex + batchEnd}`);
      const batchStartTime = Date.now();

      const scoringPromises = [];
      for (const account of batchAccounts) {
        for (const icp of icpProfiles) {
          scoringPromises.push(
            supabase.rpc('calculate_account_score', {
              account_external_id: account.external_id,
              icp_id: icp.id,
              org_id_param: org_id
            })
            .then(({ data: scoreData, error: scoreError }) => {
              if (scoreError) {
                console.error(`Error scoring ${account.name}:`, scoreError.message);
                return { success: false, account, icp, error: scoreError };
              }
              return { success: true, account, icp, scoreData };
            })
          );
        }
      }

      const results = await Promise.all(scoringPromises);
      
      const scoresToUpsert = results
        .filter(r => r.success && r.scoreData)
        .map(r => ({
          org_id,
          account_external_id: r.account.external_id,
          overall: r.scoreData.overall,
          fit: r.scoreData.fit,
          intent: r.scoreData.intent || 50,
          reachability: r.scoreData.reachability || 70,
          reasons: r.scoreData.breakdown,
          scoring_version: 'icp_v2.0',
          computed_at: new Date().toISOString(),
        }));

      if (scoresToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('scores')
          .upsert(scoresToUpsert, {
            onConflict: 'org_id,account_external_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Failed to upsert scores:', upsertError);
          chunkErrors += scoresToUpsert.length;
        } else {
          chunkSuccessful += scoresToUpsert.length;
        }
      }

      // Log failed scores for monitoring
      const errorResults = results.filter(r => !r.success);
      chunkErrors += errorResults.length;

      if (errorResults.length > 0) {
        const failedScoresToLog = errorResults.map(r => ({
          org_id,
          job_id: currentJobId,
          account_external_id: r.account.external_id,
          account_name: r.account.name,
          icp_id: r.icp.id,
          error_message: r.error?.message || 'Unknown error',
          error_details: { 
            error: r.error?.message,
            hint: r.error?.hint,
            details: r.error?.details 
          }
        }));

        // Log failed scores (best effort, don't fail the chunk if this fails)
        await supabase
          .from('failed_scores')
          .insert(failedScoresToLog)
          .then(({ error: logError }) => {
            if (logError) {
              console.error('Failed to log error records:', logError);
            } else {
              console.log(`Logged ${failedScoresToLog.length} failed scoring attempts`);
            }
          });
      }

      const batchDuration = Date.now() - batchStartTime;
      const successRate = ((chunkSuccessful / (chunkSuccessful + chunkErrors)) * 100).toFixed(1);
      
      console.log(`[Batch ${batchIndex + 1}] Complete in ${batchDuration}ms | Success: ${chunkSuccessful} | Errors: ${chunkErrors} | Rate: ${successRate}%\n`);
    }

    // Update job progress atomically to prevent race conditions
    const processedSoFar = (currentChunkIndex + 1) * chunk_size;
    const isLastChunk = processedSoFar >= (totalAccounts || 0);
    
    // Use atomic increment function to avoid race conditions
    const { error: updateError } = await supabase.rpc('increment_bulk_scoring_job_progress', {
      job_id_param: currentJobId,
      chunk_successful: chunkSuccessful,
      chunk_failed: chunkErrors,
      processed_count: Math.min(processedSoFar, totalAccounts || 0),
      current_chunk_num: currentChunkIndex + 1,
      is_last_chunk: isLastChunk
    });

    if (updateError) {
      console.error('Failed to update job progress:', updateError);
    }

    // Log audit entry for this chunk
    await supabase.from('audit_logs').insert({
      org_id,
      actor: 'system',
      action: 'bulk_score_chunk_completed',
      meta: {
        job_id: currentJobId,
        chunk_index: currentChunkIndex,
        accounts_in_chunk: accounts.length,
        successful_scores: chunkSuccessful,
        failed_scores: chunkErrors,
      }
    });

    const endTime = Date.now();
    const chunkDuration = Math.round((endTime - startTime) / 1000);

    console.log('\n=== CHUNK COMPLETED ===');
    console.log(`Chunk Duration: ${chunkDuration}s`);
    console.log(`Accounts in Chunk: ${accounts.length}`);
    console.log(`Successful Scores: ${chunkSuccessful}`);
    console.log(`Failed Scores: ${chunkErrors}`);
    console.log(`Success Rate: ${((chunkSuccessful / (chunkErrors > 0 ? chunkSuccessful + chunkErrors : chunkSuccessful)) * 100).toFixed(1)}%`);
    console.log(`Overall Progress: ${Math.min(processedSoFar, totalAccounts || 0)} / ${totalAccounts}`);
    console.log(`Is Last Chunk: ${isLastChunk}`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: currentJobId,
        chunk_index: currentChunkIndex,
        chunk_completed: true,
        is_last_chunk: isLastChunk,
        accounts_in_chunk: accounts.length,
        successful_scores: chunkSuccessful,
        failed_scores: chunkErrors,
        total_processed: Math.min(processedSoFar, totalAccounts || 0),
        total_accounts: totalAccounts,
        duration_seconds: chunkDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== CHUNK PROCESSING ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check edge function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

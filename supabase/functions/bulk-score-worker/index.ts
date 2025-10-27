import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerTask {
  job_id: string;
  org_id: string;
  icp_id?: string;
  chunk_index: number;
  chunk_size: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const task: WorkerTask = await req.json();
    const { job_id, org_id, icp_id, chunk_index, chunk_size } = task;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Worker processing chunk ${chunk_index} for job ${job_id}`);

    // Fetch accounts for this micro-chunk
    const startIndex = chunk_index * chunk_size;
    const endIndex = startIndex + chunk_size - 1;

    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name')
      .eq('org_id', org_id)
      .range(startIndex, endIndex);

    if (accountsError || !accounts || accounts.length === 0) {
      console.warn(`No accounts found for chunk ${chunk_index}`);
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ICP profiles
    const icpQuery = supabase
      .from('icp_profiles')
      .select('id')
      .eq('org_id', org_id)
      .eq('status', 'active');

    if (icp_id) {
      icpQuery.eq('id', icp_id);
    }

    const { data: icpProfiles, error: icpError } = await icpQuery;

    if (icpError || !icpProfiles || icpProfiles.length === 0) {
      throw new Error('No active ICP profiles found');
    }

    // Score all accounts in parallel
    let successful = 0;
    let failed = 0;

    const scoringPromises = [];
    for (const account of accounts) {
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
              return { success: false };
            }
            return { success: true, account, scoreData };
          })
        );
      }
    }

    const results = await Promise.all(scoringPromises);

    // Batch upsert scores
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
        failed += scoresToUpsert.length;
      } else {
        successful += scoresToUpsert.length;
      }
    }

    failed += results.filter(r => !r.success).length;

    // Update job progress
    const processedCount = (chunk_index + 1) * chunk_size;
    const { data: jobData } = await supabase
      .from('bulk_scoring_jobs')
      .select('total_accounts, total_chunks')
      .eq('id', job_id)
      .single();

    const isLastChunk = chunk_index + 1 >= (jobData?.total_chunks || 0);

    await supabase.rpc('increment_bulk_scoring_job_progress', {
      job_id_param: job_id,
      chunk_successful: successful,
      chunk_failed: failed,
      processed_count: Math.min(processedCount, jobData?.total_accounts || 0),
      current_chunk_num: chunk_index + 1,
      is_last_chunk: isLastChunk
    });

    console.log(`Chunk ${chunk_index} complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        chunk_index,
        successful,
        failed,
        is_last_chunk: isLastChunk,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

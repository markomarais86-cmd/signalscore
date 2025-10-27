import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnqueueRequest {
  org_id: string;
  icp_id?: string;
}

const MICRO_CHUNK_SIZE = 50; // Process 50 accounts per micro-chunk

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, icp_id }: EnqueueRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Enqueuing bulk scoring job for org:', org_id);

    // Get total account count
    const { count: totalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    if (!totalAccounts) {
      throw new Error('No accounts found');
    }

    // Create job
    const totalMicroChunks = Math.ceil(totalAccounts / MICRO_CHUNK_SIZE);
    const { data: job, error: jobError } = await supabase
      .from('bulk_scoring_jobs')
      .insert({
        org_id,
        icp_id,
        total_accounts: totalAccounts,
        total_chunks: totalMicroChunks,
        chunk_size: MICRO_CHUNK_SIZE,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    console.log(`Created job ${job.id} with ${totalMicroChunks} micro-chunks`);

    // Enqueue micro-chunks to Supabase Realtime channel
    const channel = supabase.channel(`scoring-queue-${org_id}`);
    
    for (let chunkIndex = 0; chunkIndex < totalMicroChunks; chunkIndex++) {
      const message = {
        type: 'scoring_task',
        job_id: job.id,
        org_id,
        icp_id,
        chunk_index: chunkIndex,
        chunk_size: MICRO_CHUNK_SIZE,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to workers
      await channel.send({
        type: 'broadcast',
        event: 'scoring_task',
        payload: message,
      });

      // Small delay to avoid overwhelming the queue
      if (chunkIndex % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Enqueued ${totalMicroChunks} micro-chunks for processing`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        total_accounts: totalAccounts,
        total_chunks: totalMicroChunks,
        micro_chunk_size: MICRO_CHUNK_SIZE,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enqueue error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

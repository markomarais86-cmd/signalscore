import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enrichment Queue Processor
 * 
 * Runs on schedule or triggered manually to process queued enrichment jobs.
 * Handles batching, progress tracking, and cost accumulation.
 */

const BATCH_SIZE = 25; // Process 25 records at a time
const MAX_PROCESSING_TIME_MS = 50000; // 50 seconds max per invocation

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional job_id from request body
    let specificJobId: string | null = null;
    try {
      const body = await req.json();
      specificJobId = body?.job_id || null;
    } catch {
      // No body provided
    }

    // Get next pending job (highest priority first)
    const query = supabase
      .from('enrichment_queue')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (specificJobId) {
      query.eq('id', specificJobId);
    } else {
      query.eq('status', 'pending');
    }

    const { data: jobs, error: jobError } = await query;

    if (jobError || !jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending jobs' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const job = jobs[0];
    console.log(`[process-enrichment-queue] Processing job ${job.id} (${job.job_type})`);

    // Mark as processing
    await supabase
      .from('enrichment_queue')
      .update({ 
        status: 'processing', 
        started_at: job.started_at || new Date().toISOString() 
      })
      .eq('id', job.id);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let accumulatedCost = job.actual_cost || 0;

    try {
      if (job.job_type === 'lead') {
        // Process leads batch
        const leadIds = job.record_ids || [];
        const startIndex = job.processed_records || 0;
        const batch = leadIds.slice(startIndex, startIndex + BATCH_SIZE);

        if (batch.length === 0) {
          // Job complete
          await supabase
            .from('enrichment_queue')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Job completed',
            job_id: job.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Fetch leads
        const { data: leads } = await supabase
          .from('Leads')
          .select('id, email, first_name, last_name, company, phone, mobile')
          .in('id', batch);

        if (leads && leads.length > 0) {
          // Call enrich-lead
          const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('enrich-lead', {
            body: {
              leads: leads.map(l => ({
                email: l.email,
                first_name: l.first_name,
                last_name: l.last_name,
                company: l.company
              })),
              org_id: job.org_id,
              save_to_db: true
            }
          });

          if (enrichResult) {
            processedCount = leads.length;
            successCount = enrichResult.stats?.phones_found || 0;
            accumulatedCost += enrichResult.stats?.cost_estimate || 0;
          }
          
          if (enrichError) {
            console.error('[process-enrichment-queue] Lead enrichment error:', enrichError);
            failedCount = leads.length;
          }
        }

      } else if (job.job_type === 'account') {
        // Process accounts batch
        const accountIds = job.record_ids || [];
        const startIndex = job.processed_records || 0;
        const batch = accountIds.slice(startIndex, startIndex + BATCH_SIZE);

        if (batch.length === 0) {
          await supabase
            .from('enrichment_queue')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Job completed',
            job_id: job.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Fetch accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, external_id, name, domain, industry_raw, employee_count, revenue_range')
          .in('id', batch);

        if (accounts && accounts.length > 0) {
          // Call enrich-verified (now with 3-source)
          const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('enrich-verified', {
            body: {
              accounts,
              org_id: job.org_id,
              save_to_db: true
            }
          });

          if (enrichResult) {
            processedCount = accounts.length;
            successCount = enrichResult.stats?.enriched || 0;
            accumulatedCost += enrichResult.stats?.cost_estimate || 0;
          }

          if (enrichError) {
            console.error('[process-enrichment-queue] Account enrichment error:', enrichError);
            failedCount = accounts.length;
          }
        }

      } else if (job.job_type === 'discover') {
        // Process discovery jobs (sparse data)
        const inputData = job.input_data as { company: string; target_titles: string[] }[] || [];
        const startIndex = job.processed_records || 0;
        const batch = inputData.slice(startIndex, startIndex + BATCH_SIZE);

        if (batch.length === 0) {
          await supabase
            .from('enrichment_queue')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Discovery job completed',
            job_id: job.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        for (const item of batch) {
          // Check time limit
          if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
            console.log('[process-enrichment-queue] Time limit reached, pausing');
            break;
          }

          try {
            const { data: discoverResult, error: discoverError } = await supabase.functions.invoke('enrich-discover', {
              body: {
                company: item.company,
                target_titles: item.target_titles,
                org_id: job.org_id,
                max_results: 5
              }
            });

            if (discoverResult?.discovered_contacts?.length > 0) {
              successCount++;
              accumulatedCost += discoverResult.cost_estimate || 0;
            }
            processedCount++;
          } catch (e) {
            console.error('[process-enrichment-queue] Discovery error:', e);
            failedCount++;
            processedCount++;
          }
        }
      }

      // Update job progress
      const newProcessedCount = (job.processed_records || 0) + processedCount;
      const isComplete = newProcessedCount >= job.total_records;

      await supabase
        .from('enrichment_queue')
        .update({
          processed_records: newProcessedCount,
          successful_records: (job.successful_records || 0) + successCount,
          failed_records: (job.failed_records || 0) + failedCount,
          actual_cost: accumulatedCost,
          last_processed_at: new Date().toISOString(),
          status: isComplete ? 'completed' : 'pending', // Go back to pending for next batch
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', job.id);

      console.log(`[process-enrichment-queue] Processed ${processedCount} records. Total: ${newProcessedCount}/${job.total_records}`);

      return new Response(JSON.stringify({
        success: true,
        job_id: job.id,
        processed_this_batch: processedCount,
        total_processed: newProcessedCount,
        total_records: job.total_records,
        is_complete: isComplete,
        cost_so_far: accumulatedCost
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (processingError: any) {
      // Mark job as failed
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'failed',
          error_message: processingError.message,
          error_details: { stack: processingError.stack }
        })
        .eq('id', job.id);

      throw processingError;
    }

  } catch (error: any) {
    console.error('[process-enrichment-queue] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

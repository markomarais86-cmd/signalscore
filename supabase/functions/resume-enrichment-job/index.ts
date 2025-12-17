import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateHeartbeat, logRecoveryEvent } from '../_shared/job-heartbeat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONCURRENCY_LIMIT = 4;
const MAX_RETRIES = 3;
const CHUNK_SIZE = 25;
const MAX_PROCESSING_TIME_MS = 300000; // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { job_id } = await req.json();
    
    if (!job_id) {
      throw new Error('Missing required field: job_id');
    }

    console.log(`[Resume] Resuming enrichment job ${job_id}`);

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${job_id}`);
    }

    if (job.status === 'completed') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Job already completed',
        job_id,
        status: 'completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update job status to processing with heartbeat
    await supabase
      .from('enrichment_jobs')
      .update({ 
        status: 'processing', 
        paused_at: null,
        last_progress_update: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', job_id);

    // Log manual resume event
    await logRecoveryEvent(supabase, {
      jobId: job_id,
      orgId: job.org_id,
      recoveryType: 'manual_resume',
      previousStatus: job.status,
      newStatus: 'processing',
      reason: 'Job manually resumed'
    });

    // Reset any "processing" rows back to pending (they were interrupted)
    await supabase
      .from('enrichment_rows')
      .update({ status: 'pending', current_agent: null })
      .eq('job_id', job_id)
      .eq('status', 'processing');

    const agentConfig = job.agent_config || { search: true, validation: true, icp: true };
    const concurrency = Math.min(job.concurrency || 2, CONCURRENCY_LIMIT);

    // Process remaining rows
    const { processed, completed, failed, timedOut } = await processRowsWithTimeLimit(
      supabase,
      job_id,
      job.org_id,
      concurrency,
      agentConfig,
      job.config_icp_id,
      startTime,
      MAX_PROCESSING_TIME_MS
    );

    // Update final job status
    const { data: finalCounts } = await supabase
      .from('enrichment_rows')
      .select('status')
      .eq('job_id', job_id);

    const completedCount = finalCounts?.filter(r => r.status === 'completed').length || 0;
    const failedCount = finalCounts?.filter(r => r.status === 'failed').length || 0;
    const pendingCount = finalCounts?.filter(r => r.status === 'pending' || r.status === 'processing').length || 0;

    const finalStatus = pendingCount > 0 ? 'paused' : 'completed';

    await supabase
      .from('enrichment_jobs')
      .update({
        status: finalStatus,
        completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
        paused_at: finalStatus === 'paused' ? new Date().toISOString() : null,
        rows_completed: completedCount,
        rows_failed: failedCount,
        rows_pending: pendingCount,
        enriched_records: completedCount,
        last_heartbeat: new Date().toISOString(),
        error_message: timedOut ? 'Job paused due to timeout. Will auto-resume.' : null
      })
      .eq('id', job_id);

    // Log timeout pause event if applicable
    if (timedOut && pendingCount > 0) {
      await logRecoveryEvent(supabase, {
        jobId: job_id,
        orgId: job.org_id,
        recoveryType: 'timeout_pause',
        previousStatus: 'processing',
        newStatus: 'paused',
        reason: `Job paused after timeout. ${pendingCount} rows pending.`
      });
    }

    console.log(`[Resume] Job ${job_id} ${finalStatus}: ${completedCount} success, ${failedCount} failed, ${pendingCount} pending`);

    return new Response(JSON.stringify({
      success: true,
      job_id,
      processed_this_run: processed,
      completed: completedCount,
      failed: failedCount,
      pending: pendingCount,
      status: finalStatus,
      timed_out: timedOut
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Resume] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processRowsWithTimeLimit(
  supabase: any,
  jobId: string,
  orgId: string,
  concurrency: number,
  agentConfig: { search: boolean; validation: boolean; icp: boolean },
  icpConfigId: string | undefined,
  startTime: number,
  maxTimeMs: number
): Promise<{ processed: number; completed: number; failed: number; timedOut: boolean }> {
  let processed = 0;
  let completed = 0;
  let failed = 0;
  let timedOut = false;
  
  while (true) {
    if (Date.now() - startTime > maxTimeMs) {
      console.log(`[Resume] Time limit reached (${maxTimeMs}ms), pausing job`);
      timedOut = true;
      break;
    }

    const { data: pendingRows, error } = await supabase
      .from('enrichment_rows')
      .select('*')
      .eq('job_id', jobId)
      .in('status', ['pending'])
      .order('created_at')
      .limit(CHUNK_SIZE);

    if (error || !pendingRows || pendingRows.length === 0) {
      if (error) console.error('[Resume] Failed to fetch pending rows:', error);
      break;
    }

    console.log(`[Resume] Processing chunk of ${pendingRows.length} rows`);

    for (let i = 0; i < pendingRows.length; i += concurrency) {
      if (Date.now() - startTime > maxTimeMs) {
        timedOut = true;
        break;
      }

      const batch = pendingRows.slice(i, i + concurrency);
      
      const batchPromises = batch.map(row => 
        processRow(supabase, row, agentConfig, icpConfigId)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        processed++;
        if (result.status === 'fulfilled' && result.value) {
          completed++;
        } else {
          failed++;
        }
      }

      // Update progress with heartbeat
      await updateHeartbeat(supabase, jobId, {
        completed,
        failed,
        current_step: `Processing batch`
      });
      
      await supabase
        .from('enrichment_jobs')
        .update({
          rows_completed: completed,
          rows_failed: failed
        })
        .eq('id', jobId);
    }

    if (timedOut) break;
  }

  return { processed, completed, failed, timedOut };
}

async function processRow(
  supabase: any,
  row: any,
  agentConfig: { search: boolean; validation: boolean; icp: boolean },
  icpConfigId?: string
): Promise<boolean> {
  try {
    await supabase
      .from('enrichment_rows')
      .update({ status: 'processing', current_agent: 'search' })
      .eq('id', row.id);

    let enrichedData = row.raw_input;
    let fieldScores = {};
    let overallScore = 0;
    let confidence = 'low';
    let validationSummary = '';
    let icpPass = null;
    let icpFailReasons: string[] = [];

    // Step 1: Search Agent
    if (agentConfig.search && !row.search_agent_completed_at) {
      const searchResult = await callAgent('agent-search-enrichment', {
        search_payload: row.search_payload,
        record_type: row.record_type,
        org_id: row.org_id
      });

      if (searchResult.success) {
        enrichedData = { ...enrichedData, ...searchResult.enriched_data };
        
        await supabase
          .from('enrichment_rows')
          .update({ 
            enriched_raw: searchResult.enriched_data,
            search_agent_completed_at: new Date().toISOString(),
            current_agent: 'validation'
          })
          .eq('id', row.id);
      }
    } else if (row.enriched_raw) {
      enrichedData = { ...enrichedData, ...row.enriched_raw };
    }

    // Step 2: Validation Agent
    if (agentConfig.validation && !row.validation_agent_completed_at) {
      const validationResult = await callAgent('agent-validation-scoring', {
        raw_input: row.raw_input,
        enriched_data: enrichedData,
        record_type: row.record_type
      });

      if (validationResult.success) {
        fieldScores = validationResult.field_scores || {};
        overallScore = validationResult.overall_score || 0;
        confidence = validationResult.confidence || 'low';
        validationSummary = validationResult.validation_summary || '';
        
        const validatedData = validationResult.validated_data;
        if (validatedData && Object.keys(validatedData).length > 0) {
          enrichedData = { ...enrichedData, ...validatedData };
        }

        await supabase
          .from('enrichment_rows')
          .update({ 
            validated_data: enrichedData,
            field_scores: fieldScores,
            overall_score: overallScore,
            confidence,
            validation_summary: validationSummary,
            validation_agent_completed_at: new Date().toISOString(),
            current_agent: 'icp'
          })
          .eq('id', row.id);
      }
    } else if (row.validated_data) {
      enrichedData = row.validated_data;
      fieldScores = row.field_scores || {};
      overallScore = row.overall_score || 0;
      confidence = row.confidence || 'low';
    }

    // Step 3: ICP Agent
    if (agentConfig.icp && icpConfigId && !row.icp_agent_completed_at) {
      const icpResult = await callAgent('agent-icp-persona', {
        validated_data: enrichedData,
        icp_config_id: icpConfigId,
        org_id: row.org_id
      });

      if (icpResult.success) {
        icpPass = icpResult.icp_pass;
        icpFailReasons = icpResult.icp_fail_reasons || [];

        await supabase
          .from('enrichment_rows')
          .update({ 
            icp_pass: icpPass,
            icp_fail_reasons: icpFailReasons,
            icp_agent_completed_at: new Date().toISOString()
          })
          .eq('id', row.id);
      }
    } else {
      icpPass = row.icp_pass;
      icpFailReasons = row.icp_fail_reasons || [];
    }

    // Update source record
    await updateSourceRecord(supabase, row, enrichedData, fieldScores, overallScore, icpPass, icpFailReasons);

    await supabase
      .from('enrichment_rows')
      .update({ 
        status: 'completed',
        current_agent: null,
        validated_data: enrichedData
      })
      .eq('id', row.id);

    return true;

  } catch (error) {
    console.error(`[Resume] Row ${row.id} failed:`, error);
    
    const retryCount = (row.retry_count || 0) + 1;
    const status = retryCount >= MAX_RETRIES ? 'failed' : 'pending';
    
    await supabase
      .from('enrichment_rows')
      .update({ 
        status,
        retry_count: retryCount,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        current_agent: null
      })
      .eq('id', row.id);

    return false;
  }
}

async function callAgent(agentName: string, payload: any): Promise<any> {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/${agentName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent ${agentName} failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Resume] Agent ${agentName} call failed:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function updateSourceRecord(
  supabase: any,
  row: any,
  enrichedData: any,
  fieldScores: any,
  overallScore: number,
  icpPass: boolean | null,
  icpFailReasons: string[]
): Promise<void> {
  if (row.record_type === 'account') {
    await supabase
      .from('accounts')
      .update({
        employee_count: enrichedData.employee_count || undefined,
        revenue_range: enrichedData.revenue_range || undefined,
        industry_norm: enrichedData.industry || undefined,
        country: enrichedData.country || undefined,
        linkedin_url: enrichedData.linkedin_url || undefined,
        enriched_at: new Date().toISOString(),
        enriched_from: 'multi_agent',
        enrichment_confidence: overallScore / 14,
        enrichment_field_scores: fieldScores,
        enrichment_overall_score: overallScore,
        icp_qualified: icpPass,
        icp_fail_reasons: icpFailReasons.length > 0 ? icpFailReasons : null
      })
      .eq('org_id', row.org_id)
      .eq('external_id', row.record_id);
  } else {
    await supabase
      .from('Leads')
      .update({
        email: enrichedData.email || undefined,
        phone: enrichedData.phone || undefined,
        title: enrichedData.title || undefined,
        linkedin_url: enrichedData.linkedin_url || undefined,
        direct_phone: enrichedData.direct_phone || undefined,
        cell_phone: enrichedData.cell_phone || undefined,
        verified_email: enrichedData.verified_email || undefined,
        verified_phone: enrichedData.verified_phone || undefined,
        still_at_company: enrichedData.still_at_company || undefined,
        previous_company: enrichedData.previous_company || undefined,
        previous_title: enrichedData.previous_title || undefined,
        enrichment_field_scores: fieldScores,
        enrichment_overall_score: overallScore,
        icp_qualified: icpPass,
        icp_fail_reasons: icpFailReasons.length > 0 ? icpFailReasons : null,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', row.org_id)
      .eq('id', parseInt(row.record_id));
  }
}

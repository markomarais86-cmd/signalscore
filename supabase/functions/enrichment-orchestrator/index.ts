import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  org_id: string;
  source_type: 'crm' | 'csv' | 'google_sheet' | 'database' | 'manual';
  source_reference?: string;
  record_type: 'account' | 'lead';
  record_ids: string[];
  config_icp_id?: string;
  concurrency?: number;
  agent_config?: {
    search: boolean;
    validation: boolean;
    icp: boolean;
  };
}

const CONCURRENCY_LIMIT = 4;
const MAX_RETRIES = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: EnrichmentRequest = await req.json();
    
    // Validate required fields
    if (!request.org_id) {
      throw new Error('Missing required field: org_id');
    }
    if (!request.record_type) {
      throw new Error('Missing required field: record_type');
    }
    if (!request.record_ids || !Array.isArray(request.record_ids) || request.record_ids.length === 0) {
      throw new Error('Missing or empty required field: record_ids');
    }
    if (!request.source_type) {
      throw new Error('Missing required field: source_type');
    }

    const { 
      org_id, 
      source_type, 
      source_reference,
      record_type, 
      record_ids, 
      config_icp_id,
      concurrency = 1,
      agent_config = { search: true, validation: true, icp: true }
    } = request;

    console.log(`[Orchestrator] Starting enrichment job for ${record_ids.length} ${record_type}s`);

    // Create enrichment job
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .insert({
        org_id,
        job_type: 'multi_agent_enrichment',
        provider: 'unified',
        source_type,
        source_reference,
        config_icp_id,
        concurrency: Math.min(concurrency, CONCURRENCY_LIMIT),
        agent_config,
        total_records: record_ids.length,
        rows_pending: record_ids.length,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('[Orchestrator] Failed to create job:', jobError);
      throw new Error(`Failed to create enrichment job: ${jobError.message}`);
    }

    console.log(`[Orchestrator] Created job ${job.id}`);

    // Fetch records based on type
    let records: any[] = [];
    if (record_type === 'account') {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', org_id)
        .in('external_id', record_ids);
      
      if (error) throw error;
      records = data || [];
    } else {
      const { data, error } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', org_id)
        .in('id', record_ids.map(id => parseInt(id)));
      
      if (error) throw error;
      records = data || [];
    }

    console.log(`[Orchestrator] Found ${records.length} records to enrich`);

    // Create enrichment_rows for each record
    const enrichmentRows = records.map(record => ({
      job_id: job.id,
      org_id,
      record_type,
      record_id: record_type === 'account' ? record.external_id : record.id.toString(),
      external_id: record_type === 'account' ? record.external_id : record.external_id,
      source_type,
      status: 'pending',
      raw_input: record,
      search_payload: buildSearchPayload(record, record_type)
    }));

    const { error: rowsError } = await supabase
      .from('enrichment_rows')
      .insert(enrichmentRows);

    if (rowsError) {
      console.error('[Orchestrator] Failed to create enrichment rows:', rowsError);
      throw new Error(`Failed to create enrichment rows: ${rowsError.message}`);
    }

    // Update job status to running
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id);

    // Process rows with concurrency control
    const effectiveConcurrency = Math.min(concurrency, CONCURRENCY_LIMIT);
    const results = await processRowsWithConcurrency(
      supabase, 
      job.id, 
      org_id, 
      effectiveConcurrency,
      agent_config,
      config_icp_id
    );

    // Update job completion status
    const { data: finalCounts } = await supabase
      .from('enrichment_rows')
      .select('status')
      .eq('job_id', job.id);

    const completed = finalCounts?.filter(r => r.status === 'completed').length || 0;
    const failed = finalCounts?.filter(r => r.status === 'failed').length || 0;

    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        rows_completed: completed,
        rows_failed: failed,
        rows_pending: 0,
        enriched_records: completed
      })
      .eq('id', job.id);

    console.log(`[Orchestrator] Job ${job.id} completed: ${completed} success, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      total_records: record_ids.length,
      completed,
      failed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildSearchPayload(record: any, recordType: string): any {
  if (recordType === 'account') {
    return {
      company: record.name,
      domain: record.domain,
      industry: record.industry_norm || record.industry_raw,
      country: record.country,
      employee_count: record.employee_count,
      revenue_range: record.revenue_range
    };
  } else {
    return {
      first_name: record.first_name,
      last_name: record.last_name,
      name: record.name,
      email: record.email,
      title: record.title,
      company: record.company,
      domain: record.domain,
      phone: record.phone
    };
  }
}

async function processRowsWithConcurrency(
  supabase: any,
  jobId: string,
  orgId: string,
  concurrency: number,
  agentConfig: { search: boolean; validation: boolean; icp: boolean },
  icpConfigId?: string
): Promise<any[]> {
  const results: any[] = [];
  
  // Get pending rows
  const { data: pendingRows, error } = await supabase
    .from('enrichment_rows')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('created_at');

  if (error || !pendingRows) {
    console.error('[Orchestrator] Failed to fetch pending rows:', error);
    return results;
  }

  // Process in batches based on concurrency
  for (let i = 0; i < pendingRows.length; i += concurrency) {
    const batch = pendingRows.slice(i, i + concurrency);
    
    const batchPromises = batch.map(row => 
      processRow(supabase, row, agentConfig, icpConfigId)
    );

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);

    // Update job progress
    const processed = Math.min(i + concurrency, pendingRows.length);
    await supabase
      .from('enrichment_jobs')
      .update({
        processed_records: processed,
        progress_percentage: Math.round((processed / pendingRows.length) * 100),
        last_progress_update: new Date().toISOString()
      })
      .eq('id', jobId);
  }

  return results;
}

async function processRow(
  supabase: any,
  row: any,
  agentConfig: { search: boolean; validation: boolean; icp: boolean },
  icpConfigId?: string
): Promise<void> {
  try {
    // Mark as processing
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

    // Step 1: Search & Enrichment Agent
    if (agentConfig.search) {
      const searchResult = await callAgent(supabase, 'agent-search-enrichment', {
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
    }

    // Step 2: Validation & Scoring Agent
    if (agentConfig.validation) {
      const validationResult = await callAgent(supabase, 'agent-validation-scoring', {
        raw_input: row.raw_input,
        enriched_data: enrichedData,
        record_type: row.record_type
      });

      if (validationResult.success) {
        fieldScores = validationResult.field_scores || {};
        overallScore = validationResult.overall_score || 0;
        confidence = validationResult.confidence || 'low';
        validationSummary = validationResult.validation_summary || '';
        enrichedData = validationResult.validated_data || enrichedData;

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
    }

    // Step 3: ICP & Persona Agent
    if (agentConfig.icp && icpConfigId) {
      const icpResult = await callAgent(supabase, 'agent-icp-persona', {
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
    }

    // Update source record with enriched data
    await updateSourceRecord(supabase, row, enrichedData, fieldScores, overallScore, icpPass, icpFailReasons);

    // Mark row as completed
    await supabase
      .from('enrichment_rows')
      .update({ 
        status: 'completed',
        current_agent: null,
        validated_data: enrichedData
      })
      .eq('id', row.id);

  } catch (error) {
    console.error(`[Orchestrator] Row ${row.id} failed:`, error);
    
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
  }
}

async function callAgent(supabase: any, agentName: string, payload: any): Promise<any> {
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
    console.error(`[Orchestrator] Agent ${agentName} call failed:`, error);
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
        enrichment_confidence: overallScore / 14, // Normalize to 0-1
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyIdempotency, recordIdempotencyKey, checkExistingJob, IDEMPOTENCY_TTL } from '../_shared/idempotency.ts';
import { updateHeartbeat, createHeartbeatInterval, logRecoveryEvent } from '../_shared/job-heartbeat.ts';

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
    discover_contacts: boolean;
  };
  discovery_config?: {
    target_titles: string[];
    max_contacts_per_account: number;
  };
}

const CONCURRENCY_LIMIT = 4;
const MAX_RETRIES = 3;
const CHUNK_SIZE = 25;
const MAX_PROCESSING_TIME_MS = 300000;

const DEFAULT_TARGET_TITLES = [
  'CEO', 'Chief Executive Officer',
  'CTO', 'Chief Technology Officer',
  'CFO', 'Chief Financial Officer',
  'COO', 'Chief Operating Officer',
  'VP', 'Vice President',
  'Director',
  'Head of Sales',
  'Head of Marketing',
  'Head of Engineering'
];

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

    const request: EnrichmentRequest = await req.json();
    
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
      concurrency = 2,
      agent_config = { search: true, validation: true, icp: true, discover_contacts: false },
      discovery_config = { target_titles: DEFAULT_TARGET_TITLES, max_contacts_per_account: 5 }
    } = request;

    // Check for duplicate request using idempotency
    const { response: cachedResponse, key: idempotencyKey } = await applyIdempotency(
      supabase,
      org_id,
      'enrichment-orchestrator',
      { org_id, record_type, record_ids: record_ids.slice(0, 10), source_type }, // Use subset for key
      corsHeaders
    );
    
    if (cachedResponse) {
      console.log(`[Orchestrator] Returning cached response for duplicate request`);
      return cachedResponse;
    }

    // Check for existing in-progress job for this org
    const { exists: hasExistingJob, existingJob } = await checkExistingJob(
      supabase,
      org_id,
      'enrichment_jobs',
      'status',
      ['pending', 'processing'],
      30 // 30 minutes
    );

    if (hasExistingJob && existingJob) {
      console.log(`[Orchestrator] Found existing job ${existingJob.id}, returning it`);
      return new Response(JSON.stringify({
        success: true,
        job_id: existingJob.id,
        message: 'Existing job in progress',
        status: existingJob.status,
        _existing_job: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Orchestrator] Starting enrichment job for ${record_ids.length} ${record_type}s`);
    console.log(`[Orchestrator] Agent config:`, agent_config);
    if (agent_config.discover_contacts) {
      console.log(`[Orchestrator] Contact discovery enabled with titles: ${discovery_config.target_titles.join(', ')}`);
    }

    // Create enrichment job
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .insert({
        org_id,
        job_type: record_type === 'account' ? 'accounts' : 'contacts',
        provider: 'unified',
        source_type,
        source_reference,
        config_icp_id,
        concurrency: Math.min(concurrency, CONCURRENCY_LIMIT),
        agent_config,
        target_titles: discovery_config.target_titles,
        enable_contact_discovery: agent_config.discover_contacts,
        total_records: record_ids.length,
        rows_pending: record_ids.length,
        rows_completed: 0,
        rows_failed: 0,
        contacts_discovered: 0,
        status: 'pending',
        can_pause: true
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

    // Update job status to processing with initial heartbeat
    await supabase
      .from('enrichment_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', job.id);

    // Process rows with chunked approach and time limit
    const effectiveConcurrency = Math.min(concurrency, CONCURRENCY_LIMIT);
    const { processed, completed, failed, timedOut, contactsDiscovered } = await processRowsWithTimeLimit(
      supabase, 
      job.id, 
      org_id, 
      effectiveConcurrency,
      agent_config,
      config_icp_id,
      discovery_config,
      startTime,
      MAX_PROCESSING_TIME_MS
    );

    // Update job status based on whether we completed or timed out
    const { data: finalCounts } = await supabase
      .from('enrichment_rows')
      .select('status')
      .eq('job_id', job.id);

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
        contacts_discovered: contactsDiscovered,
        last_heartbeat: new Date().toISOString(),
        error_message: timedOut ? 'Job paused due to timeout. Will auto-resume.' : null
      })
      .eq('id', job.id);

    // Log recovery event if job was paused due to timeout
    if (timedOut && pendingCount > 0) {
      await logRecoveryEvent(supabase, {
        jobId: job.id,
        orgId: org_id,
        recoveryType: 'timeout_pause',
        previousStatus: 'processing',
        newStatus: 'paused',
        rowsRecovered: 0,
        reason: `Job paused after ${Math.round((Date.now() - startTime) / 1000)}s. ${pendingCount} rows pending.`
      });
    }

    console.log(`[Orchestrator] Job ${job.id} ${finalStatus}: ${completedCount} success, ${failedCount} failed, ${pendingCount} pending, ${contactsDiscovered} contacts discovered`);

    const responseBody = {
      success: true,
      job_id: job.id,
      total_records: record_ids.length,
      completed: completedCount,
      failed: failedCount,
      pending: pendingCount,
      contacts_discovered: contactsDiscovered,
      status: finalStatus,
      timed_out: timedOut
    };

    // Record idempotency key with response
    await recordIdempotencyKey(
      supabase,
      idempotencyKey,
      'enrichment-orchestrator',
      org_id,
      responseBody,
      IDEMPOTENCY_TTL['enrichment-orchestrator']
    );

    return new Response(JSON.stringify(responseBody), {
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

async function processRowsWithTimeLimit(
  supabase: any,
  jobId: string,
  orgId: string,
  concurrency: number,
  agentConfig: { search: boolean; validation: boolean; icp: boolean; discover_contacts: boolean },
  icpConfigId: string | undefined,
  discoveryConfig: { target_titles: string[]; max_contacts_per_account: number },
  startTime: number,
  maxTimeMs: number
): Promise<{ processed: number; completed: number; failed: number; timedOut: boolean; contactsDiscovered: number }> {
  let processed = 0;
  let completed = 0;
  let failed = 0;
  let timedOut = false;
  let contactsDiscovered = 0;
  
  while (true) {
    if (Date.now() - startTime > maxTimeMs) {
      console.log(`[Orchestrator] Time limit reached (${maxTimeMs}ms), pausing job`);
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
      if (error) console.error('[Orchestrator] Failed to fetch pending rows:', error);
      break;
    }

    console.log(`[Orchestrator] Processing chunk of ${pendingRows.length} rows`);

    for (let i = 0; i < pendingRows.length; i += concurrency) {
      if (Date.now() - startTime > maxTimeMs) {
        console.log(`[Orchestrator] Time limit reached during batch processing`);
        timedOut = true;
        break;
      }

      const batch = pendingRows.slice(i, i + concurrency);
      
      const batchPromises = batch.map(row => 
        processRow(supabase, row, agentConfig, icpConfigId, discoveryConfig, orgId)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        processed++;
        if (result.status === 'fulfilled' && result.value) {
          completed++;
          contactsDiscovered += result.value.contactsDiscovered || 0;
        } else {
          failed++;
        }
      }

      // Update progress with heartbeat
      await updateHeartbeat(supabase, jobId, {
        processed,
        completed,
        failed,
        current_step: `Processing batch ${Math.ceil(processed / concurrency)}`
      });
      
      await supabase
        .from('enrichment_jobs')
        .update({
          processed_records: processed,
          rows_completed: completed,
          rows_failed: failed,
          contacts_discovered: contactsDiscovered
        })
        .eq('id', jobId);
    }

    if (timedOut) break;
  }

  return { processed, completed, failed, timedOut, contactsDiscovered };
}

async function processRow(
  supabase: any,
  row: any,
  agentConfig: { search: boolean; validation: boolean; icp: boolean; discover_contacts: boolean },
  icpConfigId: string | undefined,
  discoveryConfig: { target_titles: string[]; max_contacts_per_account: number },
  orgId: string
): Promise<{ success: boolean; contactsDiscovered: number }> {
  let contactsDiscovered = 0;
  
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
            icp_agent_completed_at: new Date().toISOString(),
            current_agent: agentConfig.discover_contacts ? 'discover' : null
          })
          .eq('id', row.id);
      }
    }

    // Step 4: Contact Discovery Agent (for accounts only)
    if (agentConfig.discover_contacts && row.record_type === 'account') {
      const companyName = enrichedData.name || row.raw_input?.name;
      const companyDomain = enrichedData.domain || row.raw_input?.domain;
      const linkedinUrl = enrichedData.linkedin_url || row.raw_input?.linkedin_url;
      
      // Get existing emails to exclude duplicates
      const { data: existingLeads } = await supabase
        .from('Leads')
        .select('email')
        .eq('org_id', orgId)
        .eq('account_external_id', row.record_id)
        .not('email', 'is', null);
      
      const excludeEmails = existingLeads?.map(l => l.email).filter(Boolean) || [];

      if (companyName) {
        console.log(`[Orchestrator] Discovering contacts at ${companyName}`);
        
        const discoveryResult = await callAgent(supabase, 'agent-discover-contacts', {
          company_name: companyName,
          company_domain: companyDomain,
          company_linkedin_url: linkedinUrl,
          target_titles: discoveryConfig.target_titles,
          org_id: orgId,
          max_contacts: discoveryConfig.max_contacts_per_account,
          exclude_emails: excludeEmails
        });

        if (discoveryResult.success && discoveryResult.contacts?.length > 0) {
          console.log(`[Orchestrator] Found ${discoveryResult.contacts.length} new contacts`);
          
          // Insert discovered contacts as Leads
          const leadsToInsert = discoveryResult.contacts.map((contact: any) => ({
            org_id: orgId,
            external_id: `discovered_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            account_external_id: row.record_id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            name: `${contact.first_name} ${contact.last_name}`.trim(),
            email: contact.email,
            phone: contact.phone_number || contact.direct_phone,
            cell_phone: contact.cell_phone,
            direct_phone: contact.direct_phone,
            title: contact.current_title,
            linkedin_url: contact.linkedin_url,
            city: contact.city,
            state_province: contact.state_province,
            country: contact.country,
            company: companyName,
            domain: companyDomain,
            enrichment_source: 'ai_discovered',
            discovered_from_account: row.record_id,
            enrichment_confidence: contact.confidence === 'high' ? 0.9 : contact.confidence === 'medium' ? 0.7 : 0.5,
            enrichment_citations: contact.sources || [],
            status: 'new',
            data_source: 'enrichment'
          }));

          const { data: insertedLeads, error: insertError } = await supabase
            .from('Leads')
            .insert(leadsToInsert)
            .select('id');

          if (insertError) {
            console.error('[Orchestrator] Failed to insert discovered contacts:', insertError);
          } else {
            contactsDiscovered = insertedLeads?.length || 0;
            console.log(`[Orchestrator] Inserted ${contactsDiscovered} discovered contacts`);
          }

          await supabase
            .from('enrichment_rows')
            .update({ 
              extra_contacts_found: contactsDiscovered
            })
            .eq('id', row.id);
        }
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
        validated_data: enrichedData,
        extra_contacts_found: contactsDiscovered
      })
      .eq('id', row.id);

    return { success: true, contactsDiscovered };

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

    return { success: false, contactsDiscovered: 0 };
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

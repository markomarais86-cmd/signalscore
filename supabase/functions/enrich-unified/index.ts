/**
 * Unified Enrichment API
 * 
 * Single entry point for ALL enrichment operations - accounts, leads, and contacts.
 * Uses the provider-waterfall module for consistent, cost-efficient enrichment.
 * 
 * This function consolidates: smart-enrich, process-enrichment, enrich-accounts,
 * enrich-fast, bulk-enrich-all-accounts, and enrich-free-orchestrator.
 * 
 * Usage:
 * POST /enrich-unified
 * {
 *   "org_id": "uuid",
 *   "record_type": "account" | "lead" | "contact",
 *   "records": [{ ...record data }],
 *   "config": {
 *     "skipPaidProviders": false,
 *     "maxCost": 0.50,
 *     "verifyEmail": true,
 *     "includeWebScrape": true
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  runEnrichmentWaterfall, 
  type EnrichmentInput, 
  type EnrichmentResult,
  type WaterfallConfig 
} from '../_shared/provider-waterfall.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UnifiedEnrichmentRequest {
  org_id: string;
  record_type: 'account' | 'lead' | 'contact';
  records: Record<string, any>[];
  job_id?: string;
  config?: WaterfallConfig;
  concurrency?: number;
}

const MAX_RECORDS_PER_REQUEST = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_EXECUTION_TIME_MS = 55000; // Leave buffer for edge function timeout

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      version: '1.0.0',
      timestamp: new Date().toISOString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: UnifiedEnrichmentRequest = await req.json();
    
    // Validation
    if (!request.org_id) {
      throw new Error('Missing required field: org_id');
    }
    if (!request.record_type) {
      throw new Error('Missing required field: record_type');
    }
    if (!request.records || !Array.isArray(request.records)) {
      throw new Error('Missing or invalid field: records (must be an array)');
    }
    if (request.records.length > MAX_RECORDS_PER_REQUEST) {
      throw new Error(`Too many records. Maximum ${MAX_RECORDS_PER_REQUEST} per request.`);
    }

    const { 
      org_id, 
      record_type, 
      records, 
      job_id,
      config = {},
      concurrency = DEFAULT_CONCURRENCY 
    } = request;

    console.log(`[enrich-unified] Starting ${record_type} enrichment for ${records.length} records`);

    // Create or update job
    let jobId = job_id;
    if (!jobId) {
      const { data: newJob, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id,
          job_type: record_type === 'account' ? 'accounts' : 'contacts',
          provider: 'unified',
          status: 'processing',
          total_records: records.length,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) {
        console.error('[enrich-unified] Failed to create job:', jobError);
        throw new Error(`Failed to create job: ${jobError.message}`);
      }
      jobId = newJob.id;
    } else {
      await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'processing', 
          started_at: new Date().toISOString() 
        })
        .eq('id', jobId);
    }

    // Transform records to EnrichmentInput
    const inputs: EnrichmentInput[] = records.map(record => {
      if (record_type === 'account') {
        return {
          company_name: record.name,
          domain: record.domain,
          industry: record.industry_norm || record.industry_raw,
          employee_count: record.employee_count,
          revenue_range: record.revenue_range,
          country: record.country,
          state: record.state_province,
          city: record.city,
        };
      } else {
        return {
          first_name: record.first_name,
          last_name: record.last_name,
          name: record.name,
          email: record.email,
          phone: record.phone,
          mobile: record.mobile,
          title: record.title,
          linkedin_url: record.linkedin_url,
          company: record.company,
          domain: record.domain || record.website,
        };
      }
    });

    // Process records with concurrency control
    let processed = 0;
    let enriched = 0;
    let failed = 0;
    let totalCost = 0;
    const results: EnrichmentResult[] = [];
    const sourceBreakdown: Record<string, { attempted: number; enriched: number; cost: number }> = {};

    // Process in batches with concurrency
    for (let i = 0; i < inputs.length; i += concurrency) {
      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`[enrich-unified] Timeout reached at ${processed}/${inputs.length}`);
        break;
      }

      const batch = inputs.slice(i, i + concurrency);
      const batchRecords = records.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (input, batchIndex) => {
        try {
          const result = await runEnrichmentWaterfall(input, config);
          return { success: true, result, record: batchRecords[batchIndex] };
        } catch (error) {
          console.error(`[enrich-unified] Error enriching record:`, error);
          return { success: false, error, record: batchRecords[batchIndex] };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { success, result, record, error } of batchResults) {
        processed++;

        if (success && result) {
          results.push(result);
          totalCost += result.cost.total;

          // Track source breakdown
          for (const source of result.sources) {
            if (!sourceBreakdown[source.provider]) {
              sourceBreakdown[source.provider] = { attempted: 0, enriched: 0, cost: 0 };
            }
            sourceBreakdown[source.provider].attempted++;
            sourceBreakdown[source.provider].enriched += source.fieldsEnriched.length;
            sourceBreakdown[source.provider].cost += source.cost;
          }

          if (result.success) {
            enriched++;

            // Update the record in the database
            if (record_type === 'account') {
              const updateData: Record<string, any> = {
                enriched_at: new Date().toISOString(),
                enriched_from: result.sources.map(s => s.provider).join(','),
                enrichment_confidence: result.confidence,
              };

              // Map enriched data to account fields
              if (result.data.employee_count) updateData.employee_count = result.data.employee_count;
              if (result.data.revenue_range) updateData.revenue_range = result.data.revenue_range;
              if (result.data.industry) updateData.industry_norm = result.data.industry;
              if (result.data.country) updateData.country = result.data.country;
              if (result.data.state) updateData.state_province = result.data.state;
              if (result.data.city) updateData.city = result.data.city;
              if (result.data.founded_year) updateData.founded_year = result.data.founded_year;
              if (result.data.linkedin_company_url) updateData.linkedin_url = result.data.linkedin_company_url;
              if (result.data.phone) updateData.company_main_phone = result.data.phone;

              await supabase
                .from('accounts')
                .update(updateData)
                .eq('external_id', record.external_id)
                .eq('org_id', org_id);
            } else {
              const updateData: Record<string, any> = {
                enriched_at: new Date().toISOString(),
                enrichment_source: result.sources.map(s => s.provider).join(','),
                enrichment_confidence: Math.round(result.confidence * 100),
              };

              // Map enriched data to lead fields
              if (result.data.first_name) updateData.first_name = result.data.first_name;
              if (result.data.last_name) updateData.last_name = result.data.last_name;
              if (result.data.phone) updateData.phone = result.data.phone;
              if (result.data.mobile) updateData.mobile = result.data.mobile;
              if (result.data.title) updateData.title = result.data.title;
              if (result.data.linkedin_url) updateData.linkedin_url = result.data.linkedin_url;
              if (result.data.email_verified) updateData.email_verified = result.data.email_verified;

              await supabase
                .from('Leads')
                .update(updateData)
                .eq('id', record.id)
                .eq('org_id', org_id);
            }
          }
        } else {
          failed++;
        }
      }

      // Update job progress
      if (jobId) {
        await supabase
          .from('enrichment_jobs')
          .update({
            processed_records: processed,
            enriched_records: enriched,
            failed_records: failed,
            source_breakdown: sourceBreakdown,
            last_heartbeat: new Date().toISOString(),
          })
          .eq('id', jobId);
      }

      console.log(`[enrich-unified] Progress: ${processed}/${inputs.length} (${enriched} enriched, ${failed} failed)`);
    }

    // Determine final status
    const isComplete = processed >= inputs.length;
    const finalStatus = isComplete ? 'completed' : 'paused';

    // Update job final status
    if (jobId) {
      await supabase
        .from('enrichment_jobs')
        .update({
          status: finalStatus,
          completed_at: isComplete ? new Date().toISOString() : null,
          paused_at: !isComplete ? new Date().toISOString() : null,
          processed_records: processed,
          enriched_records: enriched,
          failed_records: failed,
          source_breakdown: sourceBreakdown,
        })
        .eq('id', jobId);
    }

    const response = {
      success: true,
      job_id: jobId,
      status: finalStatus,
      summary: {
        total: records.length,
        processed,
        enriched,
        failed,
        remaining: records.length - processed,
        totalCost: Math.round(totalCost * 10000) / 10000,
        avgConfidence: enriched > 0 
          ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / enriched * 100) / 100 
          : 0,
      },
      source_breakdown: sourceBreakdown,
    };

    console.log(`[enrich-unified] Complete:`, response.summary);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[enrich-unified] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

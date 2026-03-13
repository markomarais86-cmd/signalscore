import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse, handleCorsOptions } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  export_type: 'accounts' | 'leads';
  filter: string;
  org_id: string;
  user_id: string;
}

async function processExport(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  params: ExportRequest
) {
  const { export_type, filter, org_id } = params;
  const BATCH_SIZE = 1000;
  let processedRecords = 0;
  let allRecords: any[] = [];

  try {
    console.log(`[export-csv] Starting background export for job ${jobId}`);

    // Get total count first
    const countQuery = export_type === 'accounts'
      ? supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('org_id', org_id)
      : supabase.from('Leads').select('id', { count: 'exact', head: true }).eq('org_id', org_id);

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) throw countError;

    const total = totalCount || 0;
    console.log(`[export-csv] Total records to export: ${total}`);

    // Update job with total count
    await supabase
      .from('export_jobs')
      .update({ total_records: total, status: 'processing' })
      .eq('id', jobId);

    // Fetch data in batches
    let offset = 0;
    while (offset < total) {
      let query;
      
      if (export_type === 'accounts') {
        query = supabase
          .from('accounts')
          .select('*')
          .eq('org_id', org_id)
          .order('name')
          .range(offset, offset + BATCH_SIZE - 1);

        // Apply filters
        if (filter === 'enriched') {
          query = query.not('enriched_at', 'is', null);
        } else if (filter === 'high_score') {
          query = query.gte('propensity_score', 70);
        }
      } else {
        query = supabase
          .from('Leads')
          .select('*')
          .eq('org_id', org_id)
          .order('company')
          .range(offset, offset + BATCH_SIZE - 1);

        // Apply filters
        if (filter === 'with_email') {
          query = query.not('email', 'is', null);
        } else if (filter === 'discovered') {
          query = query.eq('enrichment_source', 'ai_discovered');
        }
      }

      const { data: batchData, error: batchError } = await query;
      
      if (batchError) throw batchError;

      if (batchData) {
        allRecords = [...allRecords, ...batchData];
        processedRecords += batchData.length;
      }

      // Update progress
      await supabase
        .from('export_jobs')
        .update({ processed_records: processedRecords })
        .eq('id', jobId);

      offset += BATCH_SIZE;
      console.log(`[export-csv] Processed ${processedRecords}/${total} records`);
    }

    // Generate CSV content
    console.log(`[export-csv] Generating CSV for ${allRecords.length} records`);
    const csvContent = generateCSV(allRecords, export_type);

    // Upload to storage
    const filename = `${org_id}/${export_type}_export_${filter}_${new Date().toISOString().split('T')[0]}_${jobId.slice(0, 8)}.csv`;
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filename, csvContent, {
        contentType: 'text/csv',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL (signed for 7 days)
    const { data: urlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(filename, 7 * 24 * 60 * 60); // 7 days

    const downloadUrl = urlData?.signedUrl || '';

    // Update job as completed
    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        filename,
        download_url: downloadUrl,
        processed_records: allRecords.length,
      })
      .eq('id', jobId);

    console.log(`[export-csv] Export complete: ${filename}`);
  } catch (error: any) {
    console.error(`[export-csv] Export failed:`, error);
    
    await supabase
      .from('export_jobs')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

function generateCSV(records: any[], exportType: 'accounts' | 'leads'): string {
  if (records.length === 0) return '';

  // Get all unique keys from all records
  const allKeys = new Set<string>();
  records.forEach(record => {
    Object.keys(record).forEach(key => allKeys.add(key));
  });

  // Sort keys for consistent column order, with important fields first
  const priorityFields = exportType === 'accounts'
    ? ['external_id', 'name', 'domain', 'industry_norm', 'employee_count', 'revenue_range', 'country', 'propensity_score', 'icp_qualified']
    : ['external_id', 'name', 'email', 'title', 'company', 'phone', 'country', 'icp_qualified'];

  const sortedKeys = [
    ...priorityFields.filter(k => allKeys.has(k)),
    ...[...allKeys].filter(k => !priorityFields.includes(k)).sort()
  ];

  // Generate header row
  const headers = sortedKeys.map(key => formatHeader(key));
  const csvRows = [headers.join(',')];

  // Generate data rows
  for (const record of records) {
    const row = sortedKeys.map(key => {
      const value = record[key];
      return escapeCsvValue(value);
    });
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

function formatHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  } else {
    value = String(value);
  }

  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      console.error('[export-csv] Auth failed:', authResult.error);
      return unauthorizedResponse(req, authResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { export_type, filter, org_id, user_id } = await req.json() as ExportRequest;

    if (!export_type || !org_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[export-csv] Creating export job for ${export_type} with filter ${filter}`);

    // Create export job record
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        org_id,
        user_id,
        export_type,
        filter_params: { filter },
        status: 'pending',
        total_records: 0,
        processed_records: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log(`[export-csv] Created job ${job.id}, starting background processing`);

    // Start background processing
    EdgeRuntime.waitUntil(processExport(supabase, job.id, { export_type, filter, org_id, user_id }));

    // Return immediately with job ID
    return new Response(
      JSON.stringify({ success: true, jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[export-csv] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

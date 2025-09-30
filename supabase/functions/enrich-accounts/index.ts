// Phase 5: Enrichment Workflow
// Edge function to enrich accounts from external providers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { job_id, account_ids, provider } = await req.json();

    if (!job_id || !account_ids || !provider) {
      return new Response(
        JSON.stringify({ error: 'job_id, account_ids, and provider are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update job status to processing
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing' })
      .eq('id', job_id);

    let enriched = 0;
    let failed = 0;

    // Process each account
    for (const accountId of account_ids) {
      try {
        // TODO: Call external provider API to enrich account
        // For now, simulate enrichment
        const enrichedData = {
          enriched_from: provider,
          enriched_at: new Date().toISOString(),
          data_source: 'both', // Now exists in both CRM and database
        };

        const { error } = await supabase
          .from('accounts')
          .update(enrichedData)
          .eq('id', accountId);

        if (error) {
          failed++;
          console.error(`Failed to enrich account ${accountId}:`, error);
        } else {
          enriched++;
        }
      } catch (error) {
        failed++;
        console.error(`Error enriching account ${accountId}:`, error);
      }

      // Update job progress
      await supabase
        .from('enrichment_jobs')
        .update({
          processed_records: enriched + failed,
          enriched_records: enriched,
          failed_records: failed,
        })
        .eq('id', job_id);
    }

    // Mark job as completed
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job_id);

    return new Response(
      JSON.stringify({
        success: true,
        enriched,
        failed,
        total: account_ids.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error enriching accounts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

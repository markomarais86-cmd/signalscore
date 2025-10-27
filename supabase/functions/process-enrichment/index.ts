import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  org_id: string;
  job_id: string;
  account_ids: string[];
  provider: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, job_id, account_ids, provider }: EnrichmentRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Starting enrichment: ${account_ids.length} accounts from ${provider}`);

    // Update job to processing
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing' })
      .eq('id', job_id);

    let enriched = 0;
    let failed = 0;

    // Process each account
    for (const accountId of account_ids) {
      try {
        // Get account
        const { data: account } = await supabase
          .from('accounts')
          .select('domain, name')
          .eq('external_id', accountId)
          .eq('org_id', org_id)
          .single();

        if (!account) {
          console.warn(`Account ${accountId} not found`);
          failed++;
          continue;
        }

        // Call provider-specific enrichment
        let enrichmentData = null;
        
        if (provider === 'clearbit') {
          // Call Clearbit API (requires CLEARBIT_API_KEY)
          const clearbitKey = Deno.env.get('CLEARBIT_API_KEY');
          if (clearbitKey && account.domain) {
            const response = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${account.domain}`, {
              headers: { 'Authorization': `Bearer ${clearbitKey}` }
            });
            if (response.ok) {
              enrichmentData = await response.json();
            }
          }
        } else if (provider === 'pdl') {
          // Call People Data Labs API (requires PDL_API_KEY)
          const pdlKey = Deno.env.get('PDL_API_KEY');
          if (pdlKey && account.domain) {
            const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${account.domain}`, {
              headers: { 'X-Api-Key': pdlKey }
            });
            if (response.ok) {
              enrichmentData = await response.json();
            }
          }
        }

        if (enrichmentData) {
          // Update account with enriched data
          await supabase
            .from('accounts')
            .update({
              industry_norm: enrichmentData.category?.industry || null,
              employee_count: enrichmentData.metrics?.employees || null,
              revenue_range: enrichmentData.metrics?.annualRevenue ? `$${enrichmentData.metrics.annualRevenue}` : null,
              country: enrichmentData.geo?.country || null,
              enriched_at: new Date().toISOString(),
              enrichment_source: provider,
            })
            .eq('external_id', accountId)
            .eq('org_id', org_id);

          enriched++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error enriching account ${accountId}:`, error);
        failed++;
      }
    }

    // Update job status
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        processed_records: account_ids.length,
        enriched_records: enriched,
        failed_records: failed,
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
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

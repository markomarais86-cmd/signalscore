import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    const { job_id } = await req.json();

    if (!job_id) {
      throw new Error('job_id is required');
    }

    console.log('Starting Clearbit Free enrichment for job:', job_id);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError) throw jobError;

    // Update job to processing
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing' })
      .eq('id', job_id);

    // Get accounts needing enrichment (missing employee_count or revenue_range, and have domain)
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, employee_count, revenue_range, industry_norm, country')
      .eq('org_id', job.org_id)
      .not('domain', 'is', null)
      .or('employee_count.is.null,revenue_range.is.null');

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_records: 0,
          processed_records: 0,
        })
        .eq('id', job_id);

      return new Response(
        JSON.stringify({ success: true, message: 'No accounts need enrichment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${accounts.length} accounts to enrich`);

    // Update job with total
    await supabase
      .from('enrichment_jobs')
      .update({ total_records: accounts.length })
      .eq('id', job_id);

    let enriched = 0;
    let failed = 0;

    // Process accounts in batches of 10
    const batchSize = 10;
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (account) => {
        try {
          // Clearbit Free Logo API endpoint (no auth required)
          const domain = account.domain.toLowerCase().trim();
          const clearbitUrl = `https://company.clearbit.com/v1/domains/find?name=${encodeURIComponent(domain)}`;
          
          console.log(`Enriching ${account.name} (${domain})`);
          
          const response = await fetch(clearbitUrl, {
            headers: {
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            const updates: any = {
              enriched_at: new Date().toISOString(),
              enriched_from: 'clearbit_free',
            };

            // Map Clearbit data to our schema using ZoomInfo taxonomy
            if (!account.employee_count && data.metrics?.employees) {
              updates.employee_count = data.metrics.employees;
            }

            // Map industry to ZoomInfo taxonomy
            if (!account.industry_norm && data.category?.industry) {
              const { data: mappingData, error: mappingError } = await supabase.functions.invoke('map-industry-to-zoominfo', {
                body: { rawIndustry: data.category.industry, useAI: false }
              });

              if (!mappingError && mappingData?.primary_industry) {
                updates.industry_norm = mappingData.primary_industry;
                if (mappingData.sub_industry) {
                  updates.industry_raw = mappingData.sub_industry;
                }
              }
            }

            if (!account.revenue_range && data.metrics?.estimatedAnnualRevenue) {
              const revenue = data.metrics.estimatedAnnualRevenue;
              if (revenue) {
                const revenueMillions = revenue / 1000000;
                if (revenueMillions < 1) updates.revenue_range = '$0-$1M';
                else if (revenueMillions < 5) updates.revenue_range = '$1M-$5M';
                else if (revenueMillions < 10) updates.revenue_range = '$5M-$10M';
                else if (revenueMillions < 25) updates.revenue_range = '$10M-$25M';
                else if (revenueMillions < 50) updates.revenue_range = '$25M-$50M';
                else if (revenueMillions < 100) updates.revenue_range = '$50M-$100M';
                else if (revenueMillions < 500) updates.revenue_range = '$100M-$500M';
                else updates.revenue_range = '$500M+';
              }
            }

            if (!account.country && data.geo?.country) {
              updates.country = data.geo.country;
            }

            // Only update if we enriched something
            if (Object.keys(updates).length > 2) {
              const { error: updateError } = await supabase
                .from('accounts')
                .update(updates)
                .eq('external_id', account.external_id)
                .eq('org_id', job.org_id);

              if (updateError) throw updateError;
              
              // Auto-rescore the account
              await supabase.rpc('auto_score_account', {
                p_account_external_id: account.external_id,
                p_org_id: job.org_id
              });

              enriched++;
              console.log(`Successfully enriched ${account.name}`);
            } else {
              console.log(`No new data found for ${account.name}`);
            }
          } else {
            console.log(`Clearbit returned ${response.status} for ${account.name}`);
          }
        } catch (error) {
          console.error(`Failed to enrich ${account.name}:`, error);
          failed++;
        }
      }));

      // Update progress
      const processed = Math.min(i + batchSize, accounts.length);
      await supabase
        .from('enrichment_jobs')
        .update({
          processed_records: processed,
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
        processed_records: accounts.length,
        enriched_records: enriched,
        failed_records: failed,
      })
      .eq('id', job_id);

    console.log(`Enrichment complete: ${enriched} enriched, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched,
        failed,
        total: accounts.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in enrich-clearbit-free:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    
    console.log('[enrich-pdl] Function invoked');
    console.log('[enrich-pdl] PDL API Key configured:', !!pdlApiKey);
    
    if (!pdlApiKey) {
      console.error('[enrich-pdl] PDL_API_KEY not configured in secrets');
      throw new Error('PDL_API_KEY not configured. Please add it in Supabase Edge Functions secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });
    const { job_id } = await req.json();

    if (!job_id) {
      throw new Error('job_id is required');
    }

    console.log('Starting PDL enrichment for job:', job_id);

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

    // Get top 100 high-scoring accounts needing enrichment
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, employee_count, revenue_range, industry_norm, country')
      .eq('org_id', job.org_id)
      .not('domain', 'is', null)
      .or('employee_count.is.null,revenue_range.is.null')
      .limit(100); // PDL free tier: 1,000/month, so limit to 100 per job

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

    console.log(`Found ${accounts.length} accounts to enrich with PDL`);

    // Update job with total
    await supabase
      .from('enrichment_jobs')
      .update({ total_records: accounts.length })
      .eq('id', job_id);

    let enriched = 0;
    let failed = 0;

    // Process accounts one by one (PDL rate limits)
    for (const account of accounts) {
      try {
        // PDL Company Enrichment API
        const pdlUrl = `https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(account.domain)}`;
        
        console.log(`[enrich-pdl] Enriching ${account.name} (${account.domain})`);
        console.log(`[enrich-pdl] Request URL: ${pdlUrl}`);
        
        const response = await fetch(pdlUrl, {
          headers: {
            'X-Api-Key': pdlApiKey,
            'Accept': 'application/json',
          },
        });

        console.log(`[enrich-pdl] PDL API Response Status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          
          const updates: any = {
            enriched_at: new Date().toISOString(),
            enriched_from: 'pdl',
          };

          // Map PDL data to our schema
          if (!account.employee_count && data.employee_count) {
            updates.employee_count = data.employee_count;
          }

          if (!account.revenue_range && data.estimated_annual_revenue) {
            const revenue = data.estimated_annual_revenue;
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

          if (!account.industry_norm && data.industry) {
            updates.industry_norm = data.industry;
          }

          if (!account.country && data.location?.country) {
            updates.country = data.location.country;
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
        } else if (response.status === 404) {
          console.log(`[enrich-pdl] Company not found in PDL: ${account.name}`);
          failed++;
        } else if (response.status === 429) {
          const responseText = await response.text();
          console.error(`[enrich-pdl] Rate limit hit for PDL`);
          console.error(`[enrich-pdl] Rate limit response:`, responseText);
          failed++;
          break; // Stop processing if rate limited
        } else if (response.status === 401 || response.status === 403) {
          const responseText = await response.text();
          console.error(`[enrich-pdl] Authentication error (${response.status}):`, responseText);
          console.error(`[enrich-pdl] Please verify PDL_API_KEY is correct`);
          failed++;
          break; // Stop if auth fails
        } else {
          const responseText = await response.text();
          console.error(`[enrich-pdl] PDL returned ${response.status} for ${account.name}`);
          console.error(`[enrich-pdl] Response body:`, responseText);
          failed++;
        }

        // Update progress
        await supabase
          .from('enrichment_jobs')
          .update({
            processed_records: enriched + failed,
            enriched_records: enriched,
            failed_records: failed,
          })
          .eq('id', job_id);

        // Small delay to respect rate limits (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[enrich-pdl] Failed to enrich ${account.name}:`, error);
        console.error(`[enrich-pdl] Error details:`, error instanceof Error ? error.message : String(error));
        failed++;
      }
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
    console.error('Error in enrich-pdl:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

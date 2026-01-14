import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withHttpRetry, DEFAULT_RETRY_CONFIG, isRetryableError } from '../_shared/retry-helper.ts';

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

    console.log(`🔍 Starting enrichment: ${account_ids.length} accounts from ${provider}`);

    // Update job to processing
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job_id);

    let enriched = 0;
    let failed = 0;
    let processed = 0;

    // Process each account
    for (const accountId of account_ids) {
      // Check if job has been paused
      const { data: jobStatus } = await supabase
        .from('enrichment_jobs')
        .select('status, paused_at')
        .eq('id', job_id)
        .single();
      
      if (jobStatus?.status === 'paused') {
        console.log('⏸️  Job paused, waiting for resume...');
        // Wait and check again
        while (jobStatus?.status === 'paused') {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
          const { data: updatedStatus } = await supabase
            .from('enrichment_jobs')
            .select('status')
            .eq('id', job_id)
            .single();
          if (updatedStatus?.status !== 'paused') break;
        }
        console.log('▶️  Job resumed');
      }
      const startTime = Date.now();
      
      try {
        // Get account with current data
        const { data: account } = await supabase
          .from('accounts')
          .select('*')
          .eq('external_id', accountId)
          .eq('org_id', org_id)
          .single();

        if (!account) {
          console.warn(`❌ Account ${accountId} not found`);
          failed++;
          continue;
        }

        // Store before state
        const dataBefore = {
          industry_norm: account.industry_norm,
          employee_count: account.employee_count,
          revenue_range: account.revenue_range,
          country: account.country,
          state_province: account.state_province,
          city: account.city,
        };

        // Call provider-specific enrichment
        let enrichmentData = null;
        let apiEndpoint = '';
        let creditsUsed = 1;
        let apiSuccess = false;
        
        if (provider === 'clearbit') {
          const clearbitKey = Deno.env.get('CLEARBIT_API_KEY');
          apiEndpoint = `https://company.clearbit.com/v2/companies/find?domain=${account.domain}`;
          
          if (clearbitKey && account.domain) {
            try {
              const response = await withHttpRetry(
                () => fetch(apiEndpoint, {
                  headers: { 'Authorization': `Bearer ${clearbitKey}` }
                }),
                DEFAULT_RETRY_CONFIG
              );
              
              if (response.ok) {
                enrichmentData = await response.json();
                apiSuccess = true;
              } else if (response.status === 404) {
                console.log(`ℹ️  No data found for ${account.domain}`);
              } else {
                throw new Error(`Clearbit API error: ${response.status}`);
              }
            } catch (error) {
              console.error(`❌ Clearbit error for ${account.domain} after retries:`, error);
              await supabase.rpc('update_provider_health', {
                p_provider: 'clearbit',
                p_status: 'degraded',
                p_success: false,
                p_error_message: `${error.message} (retries exhausted)`
              });
            }
          }
        } else if (provider === 'pdl') {
          const pdlKey = Deno.env.get('PDL_API_KEY');
          apiEndpoint = `https://api.peopledatalabs.com/v5/company/enrich?website=${account.domain}`;
          
          if (pdlKey && account.domain) {
            try {
              const response = await withHttpRetry(
                () => fetch(apiEndpoint, {
                  headers: { 'X-Api-Key': pdlKey }
                }),
                DEFAULT_RETRY_CONFIG
              );
              
              if (response.ok) {
                enrichmentData = await response.json();
                apiSuccess = true;
              } else {
                throw new Error(`PDL API error: ${response.status}`);
              }
            } catch (error) {
              console.error(`❌ PDL error for ${account.domain}:`, error);
              await supabase.rpc('update_provider_health', {
                p_provider: 'pdl',
                p_status: 'degraded',
                p_success: false,
                p_error_message: error.message
              });
            }
          }
        }

        const responseTime = Date.now() - startTime;

        if (enrichmentData) {
          // Extract enriched fields based on provider
          const updates: any = {
            enriched_at: new Date().toISOString(),
            enrichment_source: provider,
          };

          const fieldsEnriched: string[] = [];

          if (provider === 'clearbit') {
            if (enrichmentData.category?.industry) {
              updates.industry_norm = enrichmentData.category.industry;
              fieldsEnriched.push('industry_norm');
            }
            if (enrichmentData.metrics?.employees) {
              updates.employee_count = enrichmentData.metrics.employees;
              fieldsEnriched.push('employee_count');
            }
            if (enrichmentData.metrics?.annualRevenue) {
              updates.revenue_range = `$${enrichmentData.metrics.annualRevenue}`;
              fieldsEnriched.push('revenue_range');
            }
            if (enrichmentData.geo?.country) {
              updates.country = enrichmentData.geo.country;
              fieldsEnriched.push('country');
            }
            if (enrichmentData.geo?.state) {
              updates.state_province = enrichmentData.geo.state;
              fieldsEnriched.push('state_province');
            }
            if (enrichmentData.geo?.city) {
              updates.city = enrichmentData.geo.city;
              fieldsEnriched.push('city');
            }
          } else if (provider === 'pdl') {
            if (enrichmentData.industry) {
              updates.industry_norm = enrichmentData.industry;
              fieldsEnriched.push('industry_norm');
            }
            if (enrichmentData.size) {
              updates.employee_count = enrichmentData.size;
              fieldsEnriched.push('employee_count');
            }
            if (enrichmentData.location?.country) {
              updates.country = enrichmentData.location.country;
              fieldsEnriched.push('country');
            }
          }

          // Update account
          await supabase
            .from('accounts')
            .update(updates)
            .eq('external_id', accountId)
            .eq('org_id', org_id);

          // Log enrichment history
          await supabase
            .from('enrichment_history')
            .insert({
              org_id,
              job_id,
              account_external_id: accountId,
              enrichment_type: 'firmographic',
              provider,
              status: fieldsEnriched.length > 0 ? 'success' : 'partial',
              data_before: dataBefore,
              data_after: updates,
              fields_enriched: fieldsEnriched,
              credits_used: creditsUsed,
              response_time_ms: responseTime,
              api_endpoint: apiEndpoint,
            });

          // Update provider health
          await supabase.rpc('update_provider_health', {
            p_provider: provider,
            p_status: 'healthy',
            p_response_time_ms: responseTime,
            p_success: true,
            p_credits_used: creditsUsed
          });

          enriched++;
          console.log(`✅ Enriched ${account.domain} with ${fieldsEnriched.length} fields`);
        } else {
          // Log failed attempt
          await supabase
            .from('enrichment_history')
            .insert({
              org_id,
              job_id,
              account_external_id: accountId,
              enrichment_type: 'firmographic',
              provider,
              status: 'failed',
              data_before: dataBefore,
              error_message: 'No data returned from provider',
              response_time_ms: responseTime,
            });

          failed++;
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${accountId}:`, error);
        
        // Log failed enrichment
        await supabase
          .from('enrichment_history')
          .insert({
            org_id,
            job_id,
            account_external_id: accountId,
            enrichment_type: 'firmographic',
            provider,
            status: 'failed',
            error_message: error.message,
            error_code: error.code,
          });
        
        failed++;
      } finally {
        processed++;
        
        // Update progress every 5 records or at the end
        if (processed % 5 === 0 || processed === account_ids.length) {
          await supabase.rpc('update_enrichment_job_progress', {
            p_job_id: job_id,
            p_processed_records: processed,
            p_enriched_records: enriched,
            p_failed_records: failed,
          });
          console.log(`📊 Progress: ${processed}/${account_ids.length} (${enriched} enriched, ${failed} failed)`);
        }
      }
    }

    // Update job completion with both new and legacy columns for compatibility
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_records: account_ids.length,
        accounts_enriched: enriched,
        enriched_records: enriched, // Legacy column for backward compatibility
        failed_records: failed,
      })
      .eq('id', job_id);

    console.log(`✅ Enrichment complete: ${enriched} enriched, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        enriched,
        failed,
        total: account_ids.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Enrichment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

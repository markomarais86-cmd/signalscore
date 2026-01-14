// AI Firmographic Enrichment - Batch estimates for missing employee/revenue data
// Migrated to use centralized AI config with OpenAI as primary

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

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

    const providers = getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No AI provider configured. Please set OPENAI_API_KEY, ABACUS_API_KEY, or LOVABLE_API_KEY.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    const { job_id } = await req.json();

    if (!job_id) {
      throw new Error('job_id is required');
    }

    console.log('[AI Firmographics] Starting enrichment for job:', job_id);

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

    // Get accounts needing enrichment
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, employee_count, revenue_range, industry_norm, country')
      .eq('org_id', job.org_id)
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

    console.log(`[AI Firmographics] Found ${accounts.length} accounts to enrich`);

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
      
      const accountsInfo = batch.map(a => ({
        name: a.name,
        domain: a.domain,
        industry: a.industry_norm || 'Unknown',
        country: a.country || 'Unknown',
        missing_employee_count: !a.employee_count,
        missing_revenue_range: !a.revenue_range
      }));

      const prompt = `You are a B2B data analyst. Estimate missing firmographic data for these companies based on their name, domain, industry, and location.

Companies:
${accountsInfo.map((a, idx) => `${idx + 1}. ${a.name} (${a.domain}) - ${a.industry} - ${a.country}
   Missing: ${a.missing_employee_count ? 'Employee Count' : ''}${a.missing_employee_count && a.missing_revenue_range ? ' and ' : ''}${a.missing_revenue_range ? 'Revenue Range' : ''}`).join('\n')}

Provide your best estimates with confidence scores (0-100). Be realistic based on industry norms and company indicators.`;

      try {
        const response = await callAI('bulk', [
          { role: 'system', content: 'You are a B2B data analyst expert at estimating company firmographics. Respond with structured JSON.' },
          { role: 'user', content: prompt }
        ], {
          tools: [{
            type: 'function',
            function: {
              name: 'estimate_firmographics',
              description: 'Estimate missing firmographic data for companies',
              parameters: {
                type: 'object',
                properties: {
                  estimates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        company_index: { type: 'number' },
                        employee_count: { type: 'number' },
                        revenue_range: { 
                          type: 'string',
                          enum: ['$0-$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M', '$50M-$100M', '$100M-$500M', '$500M+']
                        },
                        confidence: { type: 'number' }
                      },
                      required: ['company_index', 'confidence']
                    }
                  }
                },
                required: ['estimates']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'estimate_firmographics' } }
        });

        if (!response.ok) {
          console.error(`[AI Firmographics] AI API error: ${response.status}`);
          failed += batch.length;
          continue;
        }

        const aiData = await response.json();
        const toolCall = aiData.choices[0].message.tool_calls?.[0];
        
        if (!toolCall) {
          console.error('[AI Firmographics] No tool call in AI response');
          failed += batch.length;
          continue;
        }

        const estimates = JSON.parse(toolCall.function.arguments).estimates;

        // Update accounts with AI estimates (only if confidence > 70%)
        for (const estimate of estimates) {
          const account = batch[estimate.company_index - 1];
          if (!account) continue;

          if (estimate.confidence >= 70) {
            const updates: any = {
              enriched_at: new Date().toISOString(),
              enriched_from: 'launch_pulse',
            };

            if (!account.employee_count && estimate.employee_count) {
              updates.employee_count = estimate.employee_count;
            }

            if (!account.revenue_range && estimate.revenue_range) {
              updates.revenue_range = estimate.revenue_range;
            }

            if (Object.keys(updates).length > 2) {
              const { error: updateError } = await supabase
                .from('accounts')
                .update(updates)
                .eq('external_id', account.external_id)
                .eq('org_id', job.org_id);

              if (!updateError) {
                // Auto-rescore the account
                await supabase.rpc('auto_score_account', {
                  p_account_external_id: account.external_id,
                  p_org_id: job.org_id
                });

                enriched++;
                console.log(`[AI Firmographics] Enriched ${account.name} (confidence: ${estimate.confidence}%)`);
              } else {
                failed++;
              }
            }
          } else {
            console.log(`[AI Firmographics] Skipped ${account.name} (low confidence: ${estimate.confidence}%)`);
            failed++;
          }
        }
      } catch (error) {
        console.error('[AI Firmographics] Batch error:', error);
        failed += batch.length;
      }

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

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
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

    console.log(`[AI Firmographics] Complete: ${enriched} enriched, ${failed} failed`);

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
    console.error('[AI Firmographics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

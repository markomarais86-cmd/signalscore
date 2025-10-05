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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { job_id } = await req.json();

    if (!job_id) {
      throw new Error('job_id is required');
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Update job status to processing
    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job_id);

    console.log(`🔄 Starting enrichment job ${job_id} for org: ${job.org_id}`);

    // Get accounts that need enrichment (missing employee_count OR revenue_range)
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, industry_norm, country, employee_count, revenue_range')
      .eq('org_id', job.org_id)
      .or('employee_count.is.null,revenue_range.is.null')
      .limit(5000); // Process up to 5000 accounts per job

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

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
        JSON.stringify({ success: true, message: 'No accounts to enrich' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${accounts.length} accounts to enrich`);

    const BATCH_SIZE = 25; // Process 25 accounts per AI call
    const batches = [];
    
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      batches.push(accounts.slice(i, i + BATCH_SIZE));
    }

    let totalEnriched = 0;
    let totalFailed = 0;

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} accounts)`);

      try {
        // Prepare accounts for AI enrichment
        const accountsData = batch.map(acc => ({
          external_id: acc.external_id,
          name: acc.name,
          domain: acc.domain,
          industry: acc.industry_norm,
          country: acc.country,
          needs_employee_count: !acc.employee_count,
          needs_revenue_range: !acc.revenue_range
        }));

        // Call Lovable AI with tool calling for structured output
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a B2B firmographic data expert. Estimate employee counts and revenue ranges based on company signals like domain, name, industry, and country. Be conservative and realistic.'
              },
              {
                role: 'user',
                content: `Estimate missing firmographic data for these ${batch.length} companies:\n\n${JSON.stringify(accountsData, null, 2)}`
              }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'enrich_firmographics',
                  description: 'Enrich company firmographic data with employee count and revenue range estimates',
                  parameters: {
                    type: 'object',
                    properties: {
                      enrichments: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            external_id: { type: 'string' },
                            employee_count: { type: 'integer', description: 'Estimated number of employees' },
                            revenue_range: {
                              type: 'string',
                              enum: ['<$1M', '$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M+'],
                              description: 'Estimated annual revenue range'
                            },
                            confidence: {
                              type: 'integer',
                              description: 'Confidence score 0-100',
                              minimum: 0,
                              maximum: 100
                            }
                          },
                          required: ['external_id', 'employee_count', 'revenue_range', 'confidence']
                        }
                      }
                    },
                    required: ['enrichments']
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'enrich_firmographics' } }
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error: ${aiResponse.status} - ${errorText}`);
          
          if (aiResponse.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
          if (aiResponse.status === 402) {
            throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
          }
          
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiResult = await aiResponse.json();
        
        // Extract enrichments from tool call response
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error('No tool call in AI response');
          totalFailed += batch.length;
          continue;
        }

        const enrichments = JSON.parse(toolCall.function.arguments).enrichments;
        
        console.log(`AI returned ${enrichments.length} enrichments`);

        // Update accounts with enriched data (only if confidence >= 70)
        for (const enrichment of enrichments) {
          try {
            if (enrichment.confidence >= 70) {
              const updateData: any = {
                enriched_at: new Date().toISOString(),
                enriched_from: 'ai_estimate'
              };

              // Find the original account to check what needs updating
              const originalAccount = batch.find(a => a.external_id === enrichment.external_id);
              
              if (originalAccount?.needs_employee_count && enrichment.employee_count) {
                updateData.employee_count = enrichment.employee_count;
              }
              
              if (originalAccount?.needs_revenue_range && enrichment.revenue_range) {
                updateData.revenue_range = enrichment.revenue_range;
              }

              const { error: updateError } = await supabase
                .from('accounts')
                .update(updateData)
                .eq('external_id', enrichment.external_id)
                .eq('org_id', job.org_id);

              if (updateError) {
                console.error(`Failed to update account ${enrichment.external_id}:`, updateError);
                totalFailed++;
              } else {
                totalEnriched++;
              }
            } else {
              console.log(`Skipping ${enrichment.external_id} - low confidence: ${enrichment.confidence}`);
              totalFailed++;
            }
          } catch (err) {
            console.error(`Error processing enrichment for ${enrichment.external_id}:`, err);
            totalFailed++;
          }
        }

        // Update job progress
        await supabase
          .from('enrichment_jobs')
          .update({
            processed_records: (batchIndex + 1) * BATCH_SIZE,
            enriched_records: totalEnriched,
            failed_records: totalFailed
          })
          .eq('id', job_id);

      } catch (batchError) {
        console.error(`Batch ${batchIndex + 1} failed:`, batchError);
        totalFailed += batch.length;
      }
    }

    // Mark job as completed
    await supabase
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_records: accounts.length,
        processed_records: accounts.length,
        enriched_records: totalEnriched,
        failed_records: totalFailed
      })
      .eq('id', job_id);

    console.log(`✅ Enrichment completed: ${totalEnriched} enriched, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: accounts.length,
        enriched: totalEnriched,
        failed: totalFailed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-firmographics:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

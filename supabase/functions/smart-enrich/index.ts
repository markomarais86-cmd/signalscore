import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';

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

    const { jobId, batchSize } = await req.json();
    const requestedBatchSize = batchSize || 100;
    console.log('🔄 Starting smart enrichment for job:', jobId, 'batch size:', requestedBatchSize);

    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) throw jobError;

    await supabase
      .from('enrichment_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        batch_size: requestedBatchSize
      })
      .eq('id', jobId);

    const batchLimit = requestedBatchSize;
    console.log(`📊 Fetching up to ${batchLimit} accounts for enrichment`);
    
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, employee_count, revenue_range')
      .eq('org_id', job.org_id)
      .or('employee_count.is.null,revenue_range.is.null')
      .not('domain', 'is', null)
      .limit(batchLimit);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      await supabase.from('enrichment_jobs').update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        total_records: 0 
      }).eq('id', jobId);

      return new Response(JSON.stringify({ success: true, message: 'No accounts need enrichment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${accounts.length} accounts needing enrichment`);
    await supabase.from('enrichment_jobs').update({ total_records: accounts.length }).eq('id', jobId);

    let enrichedCount = 0;
    const enrichedAccounts = new Set<string>();
    const sourceBreakdown = { apollo: 0, pdl: 0, ai: 0 };
    const CONCURRENCY_LIMIT = 10; // Reduced for API rate limits

    // Helper: Process in parallel with concurrency limit
    const processInParallel = async <T, R>(
      items: T[],
      processor: (item: T) => Promise<R>,
      concurrency: number
    ): Promise<R[]> => {
      const results: R[] = [];
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
        
        // Update progress every batch
        await supabase.from('enrichment_jobs').update({
          processed_records: Math.min(i + concurrency, items.length),
          enriched_records: enrichedCount,
          last_progress_update: new Date().toISOString()
        }).eq('id', jobId);
      }
      return results;
    };

    // Helper: Batch database updates
    const pendingUpdates: Array<{external_id: string, data: any}> = [];
    const flushUpdates = async () => {
      if (pendingUpdates.length === 0) return;
      
      const updatePromises = pendingUpdates.map(({external_id, data}) => 
        supabase.from('accounts').update(data)
          .eq('external_id', external_id).eq('org_id', job.org_id)
      );
      
      await Promise.all(updatePromises);
      console.log(`💾 Flushed ${pendingUpdates.length} updates to database`);
      pendingUpdates.length = 0;
    };

    // Helper: Map revenue to range
    const mapRevenueToRange = (revenue: number): string => {
      if (revenue < 1000000) return '$0-$1M';
      if (revenue < 5000000) return '$1M-$5M';
      if (revenue < 10000000) return '$5M-$10M';
      if (revenue < 25000000) return '$10M-$25M';
      if (revenue < 50000000) return '$25M-$50M';
      if (revenue < 100000000) return '$50M-$100M';
      if (revenue < 500000000) return '$100M-$500M';
      if (revenue < 1000000000) return '$500M-$1B';
      if (revenue < 10000000000) return '$1B-$10B';
      return '$10B+';
    };

    // ============================================
    // PHASE 1: APOLLO (Primary - Best Data Quality)
    // ============================================
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    if (APOLLO_API_KEY) {
      console.log('🚀 Phase 1: Apollo Enrichment (primary source)');
      
      const processApollo = async (account: any) => {
        if (!account.domain) return null;

        try {
          const response = await withHttpRetry(
            () => fetch('https://api.apollo.io/v1/organizations/enrich', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({
                api_key: APOLLO_API_KEY,
                domain: account.domain
              })
            }),
            { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
          );

          if (response.ok) {
            const data = await response.json();
            const org = data.organization;
            
            if (org) {
              const updateData: any = {};
              
              // Employee count from Apollo
              if (!account.employee_count && org.estimated_num_employees) {
                updateData.employee_count = org.estimated_num_employees;
              }
              
              // Revenue from Apollo
              if (!account.revenue_range && org.estimated_annual_revenue) {
                updateData.revenue_range = mapRevenueToRange(org.estimated_annual_revenue);
              }

              // Additional enrichment fields
              if (org.industry) {
                updateData.industry_raw = org.industry;
              }
              if (org.country) {
                updateData.country = org.country;
              }
              if (org.linkedin_url) {
                updateData.linkedin_url = org.linkedin_url;
              }

              if (updateData.employee_count || updateData.revenue_range) {
                updateData.enriched_at = new Date().toISOString();
                updateData.enriched_from = 'apollo';
                updateData.enrichment_confidence = 0.95; // Apollo has high accuracy
                pendingUpdates.push({ external_id: account.external_id, data: updateData });
                enrichedAccounts.add(account.external_id);
                enrichedCount++;
                sourceBreakdown.apollo++;
                
                if (pendingUpdates.length >= 10) {
                  await flushUpdates();
                }
                
                return account.external_id;
              }
            }
          } else {
            const errorText = await response.text();
            console.error(`Apollo error for ${account.domain}: ${response.status} - ${errorText}`);
          }
        } catch (e) {
          console.error(`Apollo exception for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(accounts, processApollo, CONCURRENCY_LIMIT);
      await flushUpdates();
      console.log(`✅ Apollo enriched ${sourceBreakdown.apollo} accounts`);
    } else {
      console.log('⚠️ APOLLO_API_KEY not configured, skipping Phase 1');
    }

    // ============================================
    // PHASE 2: PDL (Fallback - Good Coverage)
    // ============================================
    const remaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    
    if (remaining.length > 0 && PDL_API_KEY) {
      console.log(`🔍 Phase 2: PDL Enrichment (${remaining.length} remaining accounts)`);
      
      const processPDL = async (account: any) => {
        if (!account.domain) return null;

        try {
          const response = await withHttpRetry(
            () => fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(account.domain)}`, {
              method: 'GET',
              headers: { 'X-Api-Key': PDL_API_KEY },
            }),
            { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
          );

          if (response.ok) {
            const data = await response.json();
            const updateData: any = {};
            
            if (!account.employee_count && data.size) {
              updateData.employee_count = data.size;
            }
            if (!account.revenue_range && data.estimated_annual_revenue) {
              updateData.revenue_range = mapRevenueToRange(data.estimated_annual_revenue);
            }

            if (updateData.employee_count || updateData.revenue_range) {
              updateData.enriched_at = new Date().toISOString();
              updateData.enriched_from = 'pdl';
              updateData.enrichment_confidence = 0.85;
              pendingUpdates.push({ external_id: account.external_id, data: updateData });
              enrichedAccounts.add(account.external_id);
              enrichedCount++;
              sourceBreakdown.pdl++;
              
              if (pendingUpdates.length >= 10) {
                await flushUpdates();
              }
              
              return account.external_id;
            }
          } else {
            const status = response.status;
            if (status === 404) {
              // Company not found in PDL - expected for some domains
            } else if (status === 402) {
              console.error(`PDL credit exhausted for ${account.domain}`);
            } else {
              console.error(`PDL error for ${account.domain}: ${status}`);
            }
          }
        } catch (e) {
          console.error(`PDL exception for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(remaining, processPDL, CONCURRENCY_LIMIT);
      await flushUpdates();
      console.log(`✅ PDL enriched ${sourceBreakdown.pdl} accounts`);
    } else if (remaining.length > 0) {
      console.log('⚠️ PDL_API_KEY not configured, skipping Phase 2');
    }

    // ============================================
    // PHASE 3: AI (Last Resort - Estimates)
    // ============================================
    const stillRemaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    if (stillRemaining.length > 0) {
      console.log(`🤖 Phase 3: AI Estimation (${stillRemaining.length} remaining accounts)`);
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const AI_BATCH_SIZE = 25; // Process in smaller batches for better accuracy
        
        for (let i = 0; i < stillRemaining.length; i += AI_BATCH_SIZE) {
          const batch = stillRemaining.slice(i, i + AI_BATCH_SIZE);
          
          const prompt = `You are a B2B data analyst. Estimate firmographic data for these companies based on their domain names.
Return ONLY a JSON array with this exact format:
[{"external_id": "id", "employee_count": number, "revenue_range": "range", "confidence": 0-100}]

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Companies to estimate:
${batch.map(a => `- ${a.external_id}: ${a.name} (${a.domain})`).join('\n')}`;

          try {
            const aiResponse = await withHttpRetry(
              () => fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`, 
                  'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [
                    { role: 'system', content: 'You are a B2B data analyst specializing in company firmographics. Provide realistic estimates based on company names and domains. Only output valid JSON.' },
                    { role: 'user', content: prompt }
                  ],
                }),
              }),
              { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
            );

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || '';
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              
              if (jsonMatch) {
                try {
                  const estimates = JSON.parse(jsonMatch[0]);
                  
                  for (const est of estimates) {
                    if (est.confidence >= 50) {
                      const acc = batch.find(a => a.external_id === est.external_id);
                      if (!acc) continue;

                      const updateData: any = { 
                        enriched_at: new Date().toISOString(), 
                        enriched_from: 'ai',
                        enrichment_confidence: est.confidence / 100
                      };
                      
                      if (!acc.employee_count && est.employee_count) {
                        updateData.employee_count = est.employee_count;
                      }
                      if (!acc.revenue_range && est.revenue_range) {
                        updateData.revenue_range = est.revenue_range;
                      }

                      if (updateData.employee_count || updateData.revenue_range) {
                        pendingUpdates.push({ external_id: est.external_id, data: updateData });
                        enrichedAccounts.add(est.external_id);
                        enrichedCount++;
                        sourceBreakdown.ai++;
                      }
                    }
                  }
                } catch (parseError) {
                  console.error('AI JSON parse error:', parseError);
                }
              }
            }
            
            await flushUpdates();
            
            // Update progress after each AI batch
            await supabase.from('enrichment_jobs').update({
              processed_records: accounts.length,
              enriched_records: enrichedCount
            }).eq('id', jobId);
            
          } catch (e) {
            console.error('AI batch error:', e);
          }
        }
        console.log(`✅ AI enriched ${sourceBreakdown.ai} accounts`);
      }
    }

    // Score all enriched accounts
    if (enrichedCount > 0) {
      console.log(`📊 Scoring ${enrichedCount} enriched accounts...`);
      const enrichedList = Array.from(enrichedAccounts);
      
      // Score in batches to avoid timeout
      for (let i = 0; i < enrichedList.length; i += 20) {
        const scoreBatch = enrichedList.slice(i, i + 20);
        await Promise.all(
          scoreBatch.map(external_id => 
            supabase.rpc('auto_score_account', {
              p_account_external_id: external_id,
              p_org_id: job.org_id
            }).catch(err => console.error(`Score error for ${external_id}:`, err))
          )
        );
      }
    }

    // Mark job complete
    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: accounts.length,
      enriched_records: enrichedCount,
      failed_records: accounts.length - enrichedCount
    }).eq('id', jobId);

    const summary = {
      success: true,
      total: accounts.length,
      enriched: enrichedCount,
      failed: accounts.length - enrichedCount,
      sources: sourceBreakdown
    };

    console.log(`✨ Enrichment complete:`, summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Enrichment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

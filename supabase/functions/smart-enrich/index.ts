import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    console.log('🔄 Starting smart enrichment waterfall for job:', jobId, 'batch size:', batchSize || 100);

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
        batch_size: batchSize || 100
      })
      .eq('id', jobId);

    const batchLimit = job.batch_size || batchSize || 100;
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

    console.log(`📊 Found ${accounts.length} accounts`);
    await supabase.from('enrichment_jobs').update({ total_records: accounts.length }).eq('id', jobId);

    let enrichedCount = 0;
    const enrichedAccounts = new Set<string>();
    const CONCURRENCY_LIMIT = 15; // Parallel API calls

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
        if (i % 50 === 0) {
          await supabase.from('enrichment_jobs').update({
            processed_records: Math.min(i + concurrency, items.length),
            enriched_records: enrichedCount
          }).eq('id', jobId);
        }
      }
      return results;
    };

    // Helper: Batch database updates
    const pendingUpdates: Array<{external_id: string, data: any}> = [];
    const flushUpdates = async () => {
      if (pendingUpdates.length === 0) return;
      
      await Promise.all(pendingUpdates.map(async ({external_id, data}) => {
        await supabase.from('accounts').update(data)
          .eq('external_id', external_id).eq('org_id', job.org_id);
      }));
      
      pendingUpdates.length = 0;
    };

    // PHASE 1: PDL (People Data Labs) - Parallel processing
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    if (PDL_API_KEY) {
      console.log('🔍 Phase 1: PDL Enrichment (parallel)');
      
      const processPDL = async (account: any) => {
        if (!account.domain) return null;

        try {
          const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(account.domain)}`, {
            method: 'GET',
            headers: { 'X-Api-Key': PDL_API_KEY },
          });

          if (response.ok) {
            const data = await response.json();
            const updateData: any = {};
            
            if (!account.employee_count && data.size) {
              updateData.employee_count = data.size;
            }
            if (!account.revenue_range && data.estimated_annual_revenue) {
              const revenue = data.estimated_annual_revenue;
              if (revenue < 1000000) updateData.revenue_range = '$0-$1M';
              else if (revenue < 5000000) updateData.revenue_range = '$1M-$5M';
              else if (revenue < 10000000) updateData.revenue_range = '$5M-$10M';
              else if (revenue < 25000000) updateData.revenue_range = '$10M-$25M';
              else if (revenue < 50000000) updateData.revenue_range = '$25M-$50M';
              else if (revenue < 100000000) updateData.revenue_range = '$50M-$100M';
              else if (revenue < 500000000) updateData.revenue_range = '$100M-$500M';
              else if (revenue < 1000000000) updateData.revenue_range = '$500M-$1B';
              else if (revenue < 10000000000) updateData.revenue_range = '$1B-$10B';
              else updateData.revenue_range = '$10B+';
            }

            if (Object.keys(updateData).length > 0) {
              updateData.enriched_at = new Date().toISOString();
              updateData.enriched_from = 'pdl';
              pendingUpdates.push({ external_id: account.external_id, data: updateData });
              enrichedAccounts.add(account.external_id);
              enrichedCount++;
              
              // Flush every 10 updates
              if (pendingUpdates.length >= 10) {
                await flushUpdates();
              }
              
              return account.external_id;
            }
          }
        } catch (e) {
          console.error(`PDL error for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(accounts, processPDL, CONCURRENCY_LIMIT);
      await flushUpdates();
    }

    // PHASE 2: Clearbit Free (fallback) - Parallel processing
    const remaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    if (remaining.length > 0) {
      console.log(`🔍 Phase 2: Clearbit (${remaining.length} accounts, parallel)`);
      
      const processClearbit = async (account: any) => {
        if (!account.domain) return null;

        try {
          const response = await fetch(`https://company.clearbit.com/v1/domains/find?domain=${account.domain}`);
          if (response.ok) {
            const data = await response.json();
            const updateData: any = {};
            
            if (!account.employee_count && data.metrics?.employees) {
              updateData.employee_count = data.metrics.employees;
            }
            if (!account.revenue_range && data.metrics?.estimatedAnnualRevenue) {
              const revenue = data.metrics.estimatedAnnualRevenue;
              if (revenue < 1000000) updateData.revenue_range = '$0-$1M';
              else if (revenue < 5000000) updateData.revenue_range = '$1M-$5M';
              else if (revenue < 10000000) updateData.revenue_range = '$5M-$10M';
              else if (revenue < 25000000) updateData.revenue_range = '$10M-$25M';
              else if (revenue < 50000000) updateData.revenue_range = '$25M-$50M';
              else if (revenue < 100000000) updateData.revenue_range = '$50M-$100M';
              else if (revenue < 500000000) updateData.revenue_range = '$100M-$500M';
              else if (revenue < 1000000000) updateData.revenue_range = '$500M-$1B';
              else if (revenue < 10000000000) updateData.revenue_range = '$1B-$10B';
              else updateData.revenue_range = '$10B+';
            }

            if (Object.keys(updateData).length > 0) {
              updateData.enriched_at = new Date().toISOString();
              updateData.enriched_from = 'clearbit';
              pendingUpdates.push({ external_id: account.external_id, data: updateData });
              enrichedAccounts.add(account.external_id);
              enrichedCount++;
              
              if (pendingUpdates.length >= 10) {
                await flushUpdates();
              }
              
              return account.external_id;
            }
          }
        } catch (e) {
          console.error(`Clearbit error for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(remaining, processClearbit, CONCURRENCY_LIMIT);
      await flushUpdates();
    }

    // PHASE 3: AI for remaining - Larger batches
    const stillRemaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    if (stillRemaining.length > 0) {
      console.log(`🤖 Phase 3: AI (${stillRemaining.length} accounts, batch size 50)`);
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const AI_BATCH_SIZE = 50; // Increased from 10
        for (let i = 0; i < stillRemaining.length; i += AI_BATCH_SIZE) {
          const batch = stillRemaining.slice(i, i + AI_BATCH_SIZE);
          
          const prompt = `Estimate firmographic data. Return JSON: [{"external_id": "id", "employee_count": number, "revenue_range": "range", "confidence": 0-100}]
Revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"
Companies: ${batch.map(a => `${a.name} (${a.domain})`).join(', ')}`;

          try {
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: 'B2B data analyst. Provide realistic estimates.' },
                  { role: 'user', content: prompt }
                ],
              }),
            });

            if (aiResponse.ok) {
              console.log(`✅ AI response received for batch of ${batch.length}`);
              const aiData = await aiResponse.json();
              console.log(`📊 AI raw response:`, JSON.stringify(aiData).substring(0, 500));
              const jsonMatch = aiData.choices[0].message.content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  const estimates = JSON.parse(jsonMatch[0]);
                  console.log(`📈 AI parsed ${estimates.length} estimates`);
                  
                  for (const est of estimates) {
                    console.log(`  - ${est.external_id}: confidence ${est.confidence}%, employees: ${est.employee_count}, revenue: ${est.revenue_range}`);
                    
                    if (est.confidence >= 50) { // Lowered from 70 to 50
                      const acc = batch.find(a => a.external_id === est.external_id);
                      if (!acc) continue;

                      const updateData: any = { enriched_at: new Date().toISOString(), enriched_from: 'ai' };
                      if (!acc.employee_count && est.employee_count) updateData.employee_count = est.employee_count;
                      if (!acc.revenue_range && est.revenue_range) updateData.revenue_range = est.revenue_range;

                      if (Object.keys(updateData).length > 2) {
                        console.log(`✅ Queueing update for ${est.external_id}: ${Object.keys(updateData).join(', ')}`);
                        pendingUpdates.push({ external_id: est.external_id, data: updateData });
                        enrichedAccounts.add(est.external_id);
                        enrichedCount++;
                      } else {
                        console.log(`⏭️  Skipping ${est.external_id}: no new data to add`);
                      }
                    } else {
                      console.log(`⏭️  Skipping ${est.external_id}: confidence too low (${est.confidence}%)`);
                    }
                  }
                } catch (parseError) {
                  console.error(`❌ Failed to parse AI JSON:`, parseError);
                  console.error(`Raw content:`, jsonMatch[0].substring(0, 500));
                }
              }
            }
            
            // Flush AI batch updates
            await flushUpdates();
            console.log(`💾 Flushed ${pendingUpdates.length} AI updates to database`);
          } catch (e) {
            console.error('AI batch error:', e);
          }
        }
      }
    }

    // Batch score all enriched accounts at the end
    console.log(`📊 Scoring ${enrichedCount} enriched accounts...`);
    const enrichedAccountsList = Array.from(enrichedAccounts);
    await Promise.all(
      enrichedAccountsList.map(async external_id => {
        const { error } = await supabase.rpc('auto_score_account', {
          p_account_external_id: external_id,
          p_org_id: job.org_id
        });
        if (error) {
          console.error(`Score error for ${external_id}:`, error);
        }
      })
    );

    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: accounts.length,
      enriched_records: enrichedCount,
      failed_records: accounts.length - enrichedCount
    }).eq('id', jobId);

    // PHASE 4: Deep Research for high-value accounts (optional, rate-limited)
    const needsDeepResearch = accounts.filter(a => {
      const stillNeedsData = !enrichedAccounts.has(a.external_id);
      return stillNeedsData && a.domain; // Only accounts with domain that still need data
    }).slice(0, 50); // Max 50 per job to control costs

    if (needsDeepResearch.length > 0) {
      console.log(`🔬 Phase 4: Deep Research available (${needsDeepResearch.length} candidates)`);
      console.log('⚠️ Deep research not auto-triggered. Requires manual activation or high propensity scores.');
      
      // Store candidates for potential deep research
      await supabase.from('deep_research_candidates').insert(
        needsDeepResearch.map(a => ({
          org_id: job.org_id,
          account_external_id: a.external_id,
          company_data: { name: a.name, domain: a.domain },
          match_reasoning: 'Incomplete after Phase 1-3 enrichment',
          confidence: 0.5,
          citations: []
        }))
      ).select();
    }

    console.log(`✨ Complete: ${enrichedCount}/${accounts.length} enriched`);

    return new Response(JSON.stringify({ 
      success: true, 
      enriched: enrichedCount, 
      total: accounts.length,
      deep_research_candidates: needsDeepResearch.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

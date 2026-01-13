// Smart Enrich - Waterfall enrichment with Apollo, PDL, and AI fallback
// Migrated to use centralized AI config with OpenAI as primary

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId, batchSize } = await req.json();
    const requestedBatchSize = batchSize || 100;
    console.log('[smart-enrich] Starting for job:', jobId, 'batch size:', requestedBatchSize);

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
    console.log(`[smart-enrich] Fetching up to ${batchLimit} accounts`);
    
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

    console.log(`[smart-enrich] Found ${accounts.length} accounts`);
    await supabase.from('enrichment_jobs').update({ total_records: accounts.length }).eq('id', jobId);

    let enrichedCount = 0;
    const enrichedAccounts = new Set<string>();
    const sourceBreakdown = { apollo: 0, pdl: 0, ai: 0 };
    const CONCURRENCY_LIMIT = 20; // Increased from 10 for faster enrichment

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
        
        await supabase.from('enrichment_jobs').update({
          processed_records: Math.min(i + concurrency, items.length),
          enriched_records: enrichedCount,
          last_progress_update: new Date().toISOString()
        }).eq('id', jobId);
      }
      return results;
    };

    const pendingUpdates: Array<{external_id: string, data: any}> = [];
    const flushUpdates = async () => {
      if (pendingUpdates.length === 0) return;
      
      const updatePromises = pendingUpdates.map(({external_id, data}) => 
        supabase.from('accounts').update(data)
          .eq('external_id', external_id).eq('org_id', job.org_id)
      );
      
      await Promise.all(updatePromises);
      console.log(`[smart-enrich] Flushed ${pendingUpdates.length} updates`);
      pendingUpdates.length = 0;
    };

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

    // Phase 1: Apollo
    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    if (APOLLO_API_KEY) {
      console.log('[smart-enrich] Phase 1: Apollo');
      
      const processApollo = async (account: any) => {
        if (!account.domain) return null;

        try {
          const response = await withHttpRetry(
            () => fetch('https://api.apollo.io/v1/organizations/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
              body: JSON.stringify({ api_key: APOLLO_API_KEY, domain: account.domain })
            }),
            { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
          );

          if (response.ok) {
            const data = await response.json();
            const org = data.organization;
            
            if (org) {
              const updateData: any = {};
              if (!account.employee_count && org.estimated_num_employees) {
                updateData.employee_count = org.estimated_num_employees;
              }
              if (!account.revenue_range && org.estimated_annual_revenue) {
                updateData.revenue_range = mapRevenueToRange(org.estimated_annual_revenue);
              }
              if (org.industry) updateData.industry_raw = org.industry;
              if (org.country) updateData.country = org.country;
              if (org.linkedin_url) updateData.linkedin_url = org.linkedin_url;

              if (updateData.employee_count || updateData.revenue_range) {
                updateData.enriched_at = new Date().toISOString();
                updateData.enriched_from = 'apollo';
                updateData.enrichment_confidence = 0.95;
                pendingUpdates.push({ external_id: account.external_id, data: updateData });
                enrichedAccounts.add(account.external_id);
                enrichedCount++;
                sourceBreakdown.apollo++;
                
                if (pendingUpdates.length >= 10) await flushUpdates();
                return account.external_id;
              }
            }
          }
        } catch (e) {
          console.error(`[smart-enrich] Apollo error for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(accounts, processApollo, CONCURRENCY_LIMIT);
      await flushUpdates();
      console.log(`[smart-enrich] Apollo enriched ${sourceBreakdown.apollo}`);
    }

    // Phase 2: PDL
    const remaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
    
    if (remaining.length > 0 && PDL_API_KEY) {
      console.log(`[smart-enrich] Phase 2: PDL (${remaining.length} remaining)`);
      
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
            
            if (!account.employee_count && data.size) updateData.employee_count = data.size;
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
              
              if (pendingUpdates.length >= 10) await flushUpdates();
              return account.external_id;
            }
          }
        } catch (e) {
          console.error(`[smart-enrich] PDL error for ${account.name}:`, e);
        }
        return null;
      };

      await processInParallel(remaining, processPDL, CONCURRENCY_LIMIT);
      await flushUpdates();
      console.log(`[smart-enrich] PDL enriched ${sourceBreakdown.pdl}`);
    }

    // Phase 3: AI Estimation
    const stillRemaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    const providers = getAvailableProviders();
    
    if (stillRemaining.length > 0 && providers.length > 0) {
      console.log(`[smart-enrich] Phase 3: AI (${stillRemaining.length} remaining)`);
      const AI_BATCH_SIZE = 25;
      
      for (let i = 0; i < stillRemaining.length; i += AI_BATCH_SIZE) {
        const batch = stillRemaining.slice(i, i + AI_BATCH_SIZE);
        
        const prompt = `You are a B2B data analyst. Estimate firmographic data for these companies based on their domain names.
Return ONLY a JSON array with this exact format:
[{"external_id": "id", "employee_count": number, "revenue_range": "range", "confidence": 0-100}]

Valid revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"

Companies to estimate:
${batch.map(a => `- ${a.external_id}: ${a.name} (${a.domain})`).join('\n')}`;

        try {
          const aiResponse = await callAI('bulk', [
            { role: 'system', content: 'You are a B2B data analyst specializing in company firmographics. Provide realistic estimates. Only output valid JSON.' },
            { role: 'user', content: prompt }
          ]);

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
                    
                    if (!acc.employee_count && est.employee_count) updateData.employee_count = est.employee_count;
                    if (!acc.revenue_range && est.revenue_range) updateData.revenue_range = est.revenue_range;

                    if (updateData.employee_count || updateData.revenue_range) {
                      pendingUpdates.push({ external_id: est.external_id, data: updateData });
                      enrichedAccounts.add(est.external_id);
                      enrichedCount++;
                      sourceBreakdown.ai++;
                    }
                  }
                }
              } catch (parseError) {
                console.error('[smart-enrich] AI JSON parse error:', parseError);
              }
            }
          }
          
          await flushUpdates();
          
          await supabase.from('enrichment_jobs').update({
            processed_records: accounts.length,
            enriched_records: enrichedCount
          }).eq('id', jobId);
          
        } catch (e) {
          console.error('[smart-enrich] AI batch error:', e);
        }
      }
      console.log(`[smart-enrich] AI enriched ${sourceBreakdown.ai}`);
    }

    // Score enriched accounts
    if (enrichedCount > 0) {
      console.log(`[smart-enrich] Scoring ${enrichedCount} accounts...`);
      const enrichedList = Array.from(enrichedAccounts);
      
      for (let i = 0; i < enrichedList.length; i += 20) {
        const scoreBatch = enrichedList.slice(i, i + 20);
        const scorePromises = scoreBatch.map(async (external_id) => {
          try {
            await supabase.rpc('auto_score_account', {
              p_account_external_id: external_id,
              p_org_id: job.org_id
            });
          } catch (err) {
            console.error(`Score error for ${external_id}:`, err);
          }
        });
        await Promise.all(scorePromises);
      }
    }

    // Mark complete with source breakdown
    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: accounts.length,
      enriched_records: enrichedCount,
      failed_records: accounts.length - enrichedCount,
      source_breakdown: {
        apollo: { attempted: accounts.length, enriched: sourceBreakdown.apollo, failed: 0 },
        pdl: { attempted: remaining.length, enriched: sourceBreakdown.pdl, failed: 0 },
        ai: { attempted: stillRemaining.length, enriched: sourceBreakdown.ai, failed: 0 }
      }
    }).eq('id', jobId);

    const summary = {
      success: true,
      total: accounts.length,
      enriched: enrichedCount,
      failed: accounts.length - enrichedCount,
      sources: sourceBreakdown
    };

    console.log(`[smart-enrich] Complete:`, summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[smart-enrich] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

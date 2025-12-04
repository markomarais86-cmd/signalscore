import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 100;
const CONCURRENCY = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { org_id } = await req.json();
    
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all accounts missing employee_count with a domain
    const { data: accounts, error: fetchError } = await supabase
      .from('accounts')
      .select('id, external_id, domain, name')
      .eq('org_id', org_id)
      .is('employee_count', null)
      .not('domain', 'is', null)
      .limit(10000);

    if (fetchError) throw fetchError;

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All accounts already have employee data',
        total: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[bulk-enrich] Starting enrichment for ${accounts.length} accounts`);

    // Create enrichment job to track progress
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .insert({
        org_id,
        job_type: 'bulk_accounts',
        provider: 'smart_waterfall',
        status: 'processing',
        total_records: accounts.length,
        processed_records: 0,
        enriched_records: 0,
        failed_records: 0,
        batch_size: CHUNK_SIZE,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Start background processing
    EdgeRuntime.waitUntil(processAllAccounts(supabase, job.id, accounts, org_id));

    return new Response(JSON.stringify({ 
      success: true, 
      jobId: job.id,
      total: accounts.length,
      message: `Started enrichment for ${accounts.length} accounts`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[bulk-enrich] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processAllAccounts(supabase: any, jobId: string, accounts: any[], orgId: string) {
  const apolloKey = Deno.env.get('APOLLO_API_KEY');
  const pdlKey = Deno.env.get('PDL_API_KEY');
  
  let processed = 0;
  let enriched = 0;
  let failed = 0;
  const sourceBreakdown = { apollo: 0, pdl: 0, ai: 0 };

  // Process in chunks
  for (let i = 0; i < accounts.length; i += CHUNK_SIZE) {
    const chunk = accounts.slice(i, i + CHUNK_SIZE);
    
    // Process chunk with concurrency limit
    const results = await processChunkWithConcurrency(chunk, apolloKey, pdlKey, supabase, orgId);
    
    for (const result of results) {
      processed++;
      if (result.success) {
        enriched++;
        sourceBreakdown[result.source as keyof typeof sourceBreakdown]++;
      } else {
        failed++;
      }
    }

    // Update job progress
    await supabase
      .from('enrichment_jobs')
      .update({
        processed_records: processed,
        enriched_records: enriched,
        failed_records: failed,
        progress_percentage: Math.round((processed / accounts.length) * 100),
        last_progress_update: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`[bulk-enrich] Progress: ${processed}/${accounts.length} (${enriched} enriched, ${failed} failed)`);
  }

  // Mark job complete
  await supabase
    .from('enrichment_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: processed,
      enriched_records: enriched,
      failed_records: failed,
      progress_percentage: 100
    })
    .eq('id', jobId);

  console.log(`[bulk-enrich] Completed: ${enriched} enriched, ${failed} failed. Sources: Apollo=${sourceBreakdown.apollo}, PDL=${sourceBreakdown.pdl}, AI=${sourceBreakdown.ai}`);
}

async function processChunkWithConcurrency(chunk: any[], apolloKey: string | undefined, pdlKey: string | undefined, supabase: any, orgId: string) {
  const results: { success: boolean; source: string }[] = [];
  
  for (let i = 0; i < chunk.length; i += CONCURRENCY) {
    const batch = chunk.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(account => enrichAccount(account, apolloKey, pdlKey, supabase, orgId))
    );
    results.push(...batchResults);
  }
  
  return results;
}

async function enrichAccount(account: any, apolloKey: string | undefined, pdlKey: string | undefined, supabase: any, orgId: string): Promise<{ success: boolean; source: string }> {
  const domain = account.domain;
  if (!domain) return { success: false, source: 'none' };

  try {
    // Phase 1: Try Apollo
    if (apolloKey) {
      const apolloResult = await tryApollo(domain, apolloKey);
      if (apolloResult) {
        await updateAccount(supabase, account.id, apolloResult, 'apollo');
        return { success: true, source: 'apollo' };
      }
    }

    // Phase 2: Try PDL
    if (pdlKey) {
      const pdlResult = await tryPDL(domain, pdlKey);
      if (pdlResult) {
        await updateAccount(supabase, account.id, pdlResult, 'pdl');
        return { success: true, source: 'pdl' };
      }
    }

    // Phase 3: AI estimation
    const aiResult = await tryAIEstimation(domain, account.name);
    if (aiResult) {
      await updateAccount(supabase, account.id, aiResult, 'ai');
      return { success: true, source: 'ai' };
    }

    return { success: false, source: 'none' };
  } catch (error) {
    console.error(`[bulk-enrich] Error enriching ${domain}:`, error);
    return { success: false, source: 'none' };
  }
}

async function tryApollo(domain: string, apiKey: string): Promise<any | null> {
  try {
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ domain })
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.organization?.estimated_num_employees) {
      return {
        employee_count: data.organization.estimated_num_employees,
        industry_raw: data.organization.industry,
        revenue_range: mapRevenueToRange(data.organization.annual_revenue)
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryPDL(domain: string, apiKey: string): Promise<any | null> {
  try {
    const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
      headers: { 'X-Api-Key': apiKey }
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.employee_count) {
      return {
        employee_count: data.employee_count,
        industry_raw: data.industry,
        revenue_range: mapRevenueToRange(data.inferred_revenue)
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryAIEstimation(domain: string, companyName: string | null): Promise<any | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Estimate the employee count for ${companyName || domain} (domain: ${domain}). Return ONLY a JSON object: {"employee_count": number, "confidence": "low"|"medium"|"high"}`
        }],
        max_tokens: 100
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const match = content.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.employee_count && parsed.employee_count > 0) {
        return {
          employee_count: parsed.employee_count,
          enrichment_confidence: parsed.confidence === 'high' ? 0.9 : parsed.confidence === 'medium' ? 0.7 : 0.5
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function updateAccount(supabase: any, accountId: string, data: any, source: string) {
  const updateData: any = {
    enriched_at: new Date().toISOString(),
    enriched_from: source,
    enrichment_phase: source
  };

  if (data.employee_count) updateData.employee_count = data.employee_count;
  if (data.industry_raw) updateData.industry_raw = data.industry_raw;
  if (data.revenue_range) updateData.revenue_range = data.revenue_range;
  if (data.enrichment_confidence) updateData.enrichment_confidence = data.enrichment_confidence;

  await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', accountId);
}

function mapRevenueToRange(revenue: any): string | null {
  if (!revenue) return null;
  const num = typeof revenue === 'string' ? parseInt(revenue.replace(/[^0-9]/g, '')) : revenue;
  if (!num || isNaN(num)) return null;
  
  if (num < 1000000) return '<$1M';
  if (num < 10000000) return '$1M-$10M';
  if (num < 50000000) return '$10M-$50M';
  if (num < 100000000) return '$50M-$100M';
  if (num < 500000000) return '$100M-$500M';
  if (num < 1000000000) return '$500M-$1B';
  return '$1B+';
}

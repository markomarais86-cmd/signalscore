import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getCachedEnrichment, setCachedEnrichment, getDomainCacheKey } from '../_shared/enrichment-cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrewarmRequest {
  org_id: string;
  domains?: string[];
  account_ids?: string[];
  priority?: 'high' | 'medium' | 'low';
  max_records?: number;
}

// Rate limiting: 10 requests per second
const RATE_LIMIT_DELAY_MS = 100;
const DEFAULT_MAX_RECORDS = 500;
const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, domains, account_ids, priority = 'medium', max_records = DEFAULT_MAX_RECORDS } = await req.json() as PrewarmRequest;

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔥 Starting enrichment cache pre-warm for org: ${org_id}, priority: ${priority}`);

    let domainsToProcess: string[] = [];

    // Option 1: Explicit domains provided
    if (domains && domains.length > 0) {
      domainsToProcess = domains.filter(d => d && d.trim()).slice(0, max_records);
      console.log(`📋 Using ${domainsToProcess.length} provided domains`);
    }
    // Option 2: Account IDs provided - fetch their domains
    else if (account_ids && account_ids.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('domain')
        .eq('org_id', org_id)
        .in('external_id', account_ids)
        .not('domain', 'is', null);

      domainsToProcess = (accounts || [])
        .map(a => a.domain)
        .filter(d => d && d.trim())
        .slice(0, max_records);
      console.log(`📋 Fetched ${domainsToProcess.length} domains from ${account_ids.length} account IDs`);
    }
    // Option 3: Auto-discover high-value accounts needing enrichment
    else {
      // Priority order: CRM accounts with opportunities > CRM accounts > High-scored > Recently imported
      let query = supabase
        .from('accounts')
        .select('domain, data_source, enriched_at')
        .eq('org_id', org_id)
        .not('domain', 'is', null);

      // Focus on accounts that haven't been enriched recently
      if (priority === 'high') {
        query = query.eq('data_source', 'crm');
      } else if (priority === 'low') {
        query = query.is('enriched_at', null);
      }

      query = query
        .order('updated_at', { ascending: false })
        .limit(max_records);

      const { data: accounts, error } = await query;

      if (error) {
        console.error('Error fetching accounts:', error);
        throw new Error(`Failed to fetch accounts: ${error.message}`);
      }

      domainsToProcess = (accounts || [])
        .map(a => a.domain)
        .filter(d => d && d.trim());
      console.log(`📋 Auto-discovered ${domainsToProcess.length} accounts for pre-warming`);
    }

    // Filter out domains that are already cached
    const uncachedDomains: string[] = [];
    for (const domain of domainsToProcess) {
      const cacheKey = getDomainCacheKey(domain);
      const cached = await getCachedEnrichment(supabase, cacheKey, 'domain');
      if (!cached) {
        uncachedDomains.push(domain);
      }
    }

    console.log(`🔍 ${uncachedDomains.length} domains need enrichment (${domainsToProcess.length - uncachedDomains.length} already cached)`);

    if (uncachedDomains.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All domains already cached',
          cached_count: domainsToProcess.length,
          enriched_count: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process in batches with rate limiting
    let enrichedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < uncachedDomains.length; i += BATCH_SIZE) {
      const batch = uncachedDomains.slice(i, Math.min(i + BATCH_SIZE, uncachedDomains.length));
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} domains`);

      for (const domain of batch) {
        try {
          // Call the unified enrichment function for basic firmographic data
          const enrichResponse = await supabase.functions.invoke('enrich-unified', {
            body: {
              org_id,
              domains: [domain],
              mode: 'basic', // Only basic firmographics for cache warming
              skip_cache: false,
              background: false,
            },
          });

          if (enrichResponse.error) {
            console.warn(`⚠️ Failed to enrich ${domain}: ${enrichResponse.error.message}`);
            failedCount++;
            errors.push(`${domain}: ${enrichResponse.error.message}`);
          } else {
            enrichedCount++;
            console.log(`✅ Enriched and cached: ${domain}`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        } catch (error: any) {
          console.error(`❌ Error enriching ${domain}:`, error.message);
          failedCount++;
          errors.push(`${domain}: ${error.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🎉 Pre-warm complete in ${duration}ms: ${enrichedCount} enriched, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_domains: domainsToProcess.length,
        already_cached: domainsToProcess.length - uncachedDomains.length,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        duration_ms: duration,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error output
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Pre-warm error:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔗 Starting batched bulk match for org: ${org_id}`);
    const startTime = Date.now();

    let totalMatched = 0;
    let totalCreated = 0;
    let totalLinked = 0;
    let totalProcessed = 0;
    let batchCount = 0;
    let hasMore = true;

    // Max batches to process: 250 batches × 2000 leads = 500K leads
    const MAX_BATCHES = 250;

    // Process in batches until done
    while (hasMore && batchCount < MAX_BATCHES) {
      batchCount++;
      console.log(`📦 Processing batch ${batchCount}...`);

      const { data, error } = await supabase.rpc('bulk_match_all_leads', {
        p_org_id: org_id,
        p_batch_size: 2000
      });

      if (error) {
        console.error(`❌ Batch ${batchCount} error:`, error);
        // Return partial results if we made progress
        if (totalProcessed > 0) {
          return new Response(
            JSON.stringify({
              success: true,
              partial: true,
              processed: totalProcessed,
              matched: totalMatched,
              created: totalCreated,
              linked: totalLinked,
              batches: batchCount - 1,
              error: error.message
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: error.message, success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      totalMatched += data?.matched_to_existing || 0;
      totalCreated += data?.accounts_created || 0;
      totalLinked += data?.linked_to_new || 0;
      totalProcessed += data?.total_processed || 0;
      hasMore = data?.has_more || false;

      console.log(`✅ Batch ${batchCount} complete: processed ${data?.total_processed}, has_more: ${hasMore}`);
    }

    const duration = Date.now() - startTime;
    console.log(`🎉 All batches complete in ${duration}ms: ${totalProcessed} leads processed in ${batchCount} batches`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        matched: totalMatched,
        created: totalCreated,
        linked: totalLinked,
        batches: batchCount,
        duration_ms: duration,
        has_more: hasMore
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

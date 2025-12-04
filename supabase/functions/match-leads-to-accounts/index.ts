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

    console.log(`🔗 Starting high-performance bulk match for org: ${org_id}`);
    const startTime = Date.now();

    // Single call to the database function - processes ALL leads at once
    const { data, error } = await supabase.rpc('bulk_match_all_leads', {
      p_org_id: org_id
    });

    if (error) {
      console.error(`❌ Bulk match error:`, error);
      return new Response(
        JSON.stringify({ error: error.message, success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Bulk match completed in ${duration}ms:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        processed: (data?.matched_to_existing || 0) + (data?.linked_to_new || 0),
        matched: data?.matched_to_existing || 0,
        created: data?.accounts_created || 0,
        linked: data?.linked_to_new || 0,
        total_processed: data?.total_processed || 0,
        duration_ms: duration,
        has_more: false // All done in one call
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

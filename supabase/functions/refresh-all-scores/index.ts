import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshRequest {
  org_id: string;
  batch_size?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { org_id, batch_size = 500 } = await req.json() as RefreshRequest;

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting score refresh for org ${org_id}`);

    // Get total count of scores to refresh
    const { count: totalScores } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    if (!totalScores) {
      return new Response(
        JSON.stringify({ message: 'No scores found to refresh', total: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${totalScores} scores to refresh`);

    // Process in batches
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (let offset = 0; offset < totalScores; offset += batch_size) {
      console.log(`Processing batch ${offset} to ${offset + batch_size}`);

      // Fetch batch of scores with account data
      const { data: scores, error: fetchError } = await supabase
        .from('scores')
        .select(`
          account_external_id,
          icp_id,
          fit,
          overall,
          reasons
        `)
        .eq('org_id', org_id)
        .range(offset, offset + batch_size - 1);

      if (fetchError) {
        console.error('Error fetching scores batch:', fetchError);
        errorCount += batch_size;
        continue;
      }

      // Process each score
      for (const score of scores || []) {
        try {
          // Get account data for dynamic scoring
          const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('org_id', org_id)
            .eq('external_id', score.account_external_id)
            .single();

          if (!account) {
            errorCount++;
            continue;
          }

          // Calculate intent score
          const { data: intentData } = await supabase.rpc('calculate_intent_score', {
            p_account_id: account.id,
            p_org_id: org_id
          });

          // Calculate reachability score
          const { data: reachabilityData } = await supabase.rpc('calculate_reachability_score', {
            p_account_external_id: score.account_external_id,
            p_org_id: org_id
          });

          const intent = intentData || 50;
          const reachability = reachabilityData || 50;
          const fit = score.fit || 50;

          // Calculate new overall score (weighted average)
          const overall = Math.round((fit * 0.5) + (intent * 0.3) + (reachability * 0.2));

          // Update score
          const { error: updateError } = await supabase
            .from('scores')
            .update({
              intent,
              reachability,
              overall,
              scoring_version: 'dynamic_v3.0',
              computed_at: new Date().toISOString()
            })
            .eq('org_id', org_id)
            .eq('account_external_id', score.account_external_id);

          if (updateError) {
            console.error(`Error updating score for ${score.account_external_id}:`, updateError);
            errorCount++;
            errors.push({
              account: score.account_external_id,
              error: updateError.message
            });
          } else {
            updatedCount++;
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing score:`, error);
          errorCount++;
          errors.push({
            account: score.account_external_id,
            error: error.message
          });
        }
      }

      console.log(`Batch complete. Processed: ${processedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
    }

    // Log the refresh in audit logs
    await supabase
      .from('audit_logs')
      .insert({
        org_id,
        actor: 'system',
        action: 'bulk_score_refresh',
        meta: {
          total_scores: totalScores,
          processed: processedCount,
          updated: updatedCount,
          errors: errorCount,
          error_details: errors.slice(0, 10) // Only log first 10 errors
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        total: totalScores,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        error_details: errors.slice(0, 10)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in refresh-all-scores:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

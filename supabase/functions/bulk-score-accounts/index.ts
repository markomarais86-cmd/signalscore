import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BulkScoreRequest {
  org_id: string;
  icp_id?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, icp_id, limit, batch_size = 250 }: BulkScoreRequest & { batch_size?: number } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: org_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== BULK SCORING STARTED ===');
    console.log('Org ID:', org_id);
    console.log('Batch Size:', batch_size);
    console.log('Timestamp:', new Date().toISOString());

    // Get all accounts for the organization
    const accountsQuery = supabase
      .from('accounts')
      .select('external_id, name')
      .eq('org_id', org_id);
    
    if (limit) {
      accountsQuery.limit(limit);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError || !accounts) {
      console.error('Failed to fetch accounts:', accountsError);
      throw new Error(`Failed to fetch accounts: ${accountsError?.message}`);
    }

    console.log(`✓ Found ${accounts.length} accounts to score`);

    // Get ICP profiles
    const icpQuery = supabase
      .from('icp_profiles')
      .select('id, name')
      .eq('org_id', org_id)
      .eq('status', 'active');
    
    if (icp_id) {
      icpQuery.eq('id', icp_id);
    }

    const { data: icpProfiles, error: icpError } = await icpQuery;

    if (icpError || !icpProfiles || icpProfiles.length === 0) {
      console.error('No active ICP profiles found:', icpError);
      throw new Error('No active ICP profiles found');
    }

    console.log(`✓ Found ${icpProfiles.length} active ICP profile(s)`);
    icpProfiles.forEach(icp => console.log(`  - ${icp.name} (${icp.id})`));

    // Calculate total operations
    const totalOperations = accounts.length * icpProfiles.length;
    console.log(`Total scoring operations needed: ${totalOperations}`);

    // Process in batches
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const batchCount = Math.ceil(accounts.length / batch_size);

    console.log(`\n=== BATCH PROCESSING (${batchCount} batches) ===`);

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batchStart = batchIndex * batch_size;
      const batchEnd = Math.min(batchStart + batch_size, accounts.length);
      const batchAccounts = accounts.slice(batchStart, batchEnd);
      
      console.log(`\n[Batch ${batchIndex + 1}/${batchCount}] Processing accounts ${batchStart + 1}-${batchEnd}`);
      const batchStartTime = Date.now();

      for (const account of batchAccounts) {
        for (const icp of icpProfiles) {
          try {
            // Calculate score using RPC
            const { data: scoreData, error: scoreError } = await supabase.rpc('calculate_account_score', {
              account_external_id: account.external_id,
              icp_id: icp.id,
              org_id_param: org_id
            });

            if (scoreError) {
              console.error(`✗ Error scoring ${account.name || account.external_id} against ${icp.name}:`, scoreError.message);
              errorCount++;
              errors.push(`${account.name || account.external_id}: ${scoreError.message}`);
              continue;
            }

            // Store the score
            const { error: upsertError } = await supabase
              .from('scores')
              .upsert({
                org_id,
                account_external_id: account.external_id,
                overall: scoreData.overall,
                fit: scoreData.fit,
                intent: scoreData.intent,
                reachability: scoreData.reachability,
                reasons: scoreData.breakdown,
                scoring_version: 'icp_v2.0'
              }, {
                onConflict: 'org_id,account_external_id'
              });

            if (upsertError) {
              console.error(`✗ Error storing score for ${account.name || account.external_id}:`, upsertError.message);
              errorCount++;
              errors.push(`${account.name || account.external_id}: ${upsertError.message}`);
            } else {
              successCount++;
            }
          } catch (error) {
            console.error(`✗ Exception scoring ${account.name || account.external_id}:`, error.message);
            errorCount++;
            errors.push(`${account.name || account.external_id}: ${error.message}`);
          }
        }
      }

      const batchDuration = Date.now() - batchStartTime;
      const batchSuccessRate = ((successCount / (successCount + errorCount)) * 100).toFixed(1);
      console.log(`[Batch ${batchIndex + 1}] Complete in ${batchDuration}ms | Success: ${successCount} | Errors: ${errorCount} | Rate: ${batchSuccessRate}%`);
    }

    const overallSuccessRate = totalOperations > 0 ? ((successCount / totalOperations) * 100).toFixed(1) : 0;
    
    console.log('\n=== BULK SCORING COMPLETE ===');
    console.log(`Total Success: ${successCount}/${totalOperations} (${overallSuccessRate}%)`);
    console.log(`Total Errors: ${errorCount}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    if (errors.length > 0) {
      console.log('\nSample Errors (first 5):');
      errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    }

    // Log audit entry
    await supabase
      .from('audit_logs')
      .insert({
        org_id,
        actor: 'bulk_scoring_engine',
        action: 'bulk_scoring_complete',
        meta: {
          accounts_processed: accounts.length,
          icp_profiles: icpProfiles.length,
          total_operations: totalOperations,
          success_count: successCount,
          error_count: errorCount,
          success_rate: overallSuccessRate,
          batch_size,
          batch_count: batchCount,
          sample_errors: errors.slice(0, 10)
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        accounts_processed: accounts.length,
        icp_profiles: icpProfiles.length,
        total_operations: totalOperations,
        scores_calculated: successCount,
        errors: errorCount,
        success_rate: parseFloat(overallSuccessRate),
        batch_count: batchCount,
        sample_errors: errors.slice(0, 5)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== BULK SCORING FATAL ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check edge function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

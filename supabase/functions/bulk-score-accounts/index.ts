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
    const { org_id, icp_id, limit }: BulkScoreRequest = await req.json();

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

    console.log('Starting bulk scoring for org:', org_id);

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
      throw new Error(`Failed to fetch accounts: ${accountsError?.message}`);
    }

    console.log(`Found ${accounts.length} accounts to score`);

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
      throw new Error('No active ICP profiles found');
    }

    console.log(`Found ${icpProfiles.length} ICP profiles`);

    // Score all accounts against all ICPs
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      for (const icp of icpProfiles) {
        try {
          // Call the scoring function for this account
          const { data: scoreResult, error: scoreError } = await supabase.functions.invoke('score-account', {
            body: {
              org_id,
              account_external_id: account.external_id,
              icp_id: icp.id,
              version_hint: 'icp_v2.0'
            }
          });

          if (scoreError) {
            console.error(`Error scoring ${account.name || account.external_id}:`, scoreError);
            errorCount++;
            errors.push(`${account.name || account.external_id}: ${scoreError.message}`);
          } else {
            successCount++;
            if (successCount % 100 === 0) {
              console.log(`Progress: ${successCount}/${accounts.length * icpProfiles.length} scores calculated`);
            }
          }
        } catch (error) {
          console.error(`Exception scoring ${account.name || account.external_id}:`, error);
          errorCount++;
          errors.push(`${account.name || account.external_id}: ${error.message}`);
        }
      }
    }

    console.log(`Bulk scoring complete: ${successCount} successful, ${errorCount} errors`);

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
          total_scores: accounts.length * icpProfiles.length,
          success_count: successCount,
          error_count: errorCount,
          sample_errors: errors.slice(0, 10)
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        accounts_processed: accounts.length,
        icp_profiles: icpProfiles.length,
        scores_calculated: successCount,
        errors: errorCount,
        sample_errors: errors.slice(0, 5)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Bulk scoring error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

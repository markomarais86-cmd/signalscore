import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = "https://dhyfbaptcprxxixgnpby.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE_ACCOUNTS = 100; // Reduced for large datasets
const BATCH_SIZE_LEADS = 200; // Reduced for large datasets
const MAX_EXECUTION_MS = 25000; // 25 seconds to leave more buffer

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { org_id, job_id, phase, offset } = await req.json();
    
    if (!org_id) {
      throw new Error("org_id is required");
    }

    const startTime = Date.now();
    let currentPhase = phase || 'to_accounts';
    let currentOffset = offset || 0;
    let totalUpdated = 0;
    let jobRecord: any = null;

    // Create or fetch job record
    if (job_id) {
      const { data } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', job_id)
        .single();
      jobRecord = data;
    } else {
      // Get total record counts
      const { count: accountCount } = await supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org_id);
      
      const { count: leadCount } = await supabase
        .from('Leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .not('account_external_id', 'is', null);

      const { data: newJob, error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          org_id,
          job_type: 'bidirectional_sync',
          status: 'processing',
          direction: 'to_accounts',
          total_records: (accountCount || 0) + (leadCount || 0),
          processed_records: 0,
          updated_records: 0,
          current_offset: 0,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (jobError) throw jobError;
      jobRecord = newJob;
    }

    // Process batches within time limit
    while (Date.now() - startTime < MAX_EXECUTION_MS) {
      if (currentPhase === 'to_accounts') {
        const { data, error } = await supabase.rpc('sync_firmographics_to_accounts_batch', {
          p_org_id: org_id,
          p_batch_size: BATCH_SIZE_ACCOUNTS,
          p_offset: currentOffset
        });

        if (error) throw error;

        totalUpdated += data.updated || 0;
        currentOffset += BATCH_SIZE_ACCOUNTS;

        // Update job progress
        await supabase
          .from('sync_jobs')
          .update({
            processed_records: currentOffset,
            updated_records: totalUpdated,
            current_offset: currentOffset,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobRecord.id);

        if (!data.has_more) {
          // Move to next phase
          currentPhase = 'to_leads';
          currentOffset = 0;
          
          await supabase
            .from('sync_jobs')
            .update({
              direction: 'to_leads',
              current_offset: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobRecord.id);
        }
      } else if (currentPhase === 'to_leads') {
        const { data, error } = await supabase.rpc('sync_firmographics_to_leads_batch', {
          p_org_id: org_id,
          p_batch_size: BATCH_SIZE_LEADS,
          p_offset: currentOffset
        });

        if (error) throw error;

        totalUpdated += data.updated || 0;
        currentOffset += BATCH_SIZE_LEADS;

        // Update job progress
        await supabase
          .from('sync_jobs')
          .update({
            processed_records: (jobRecord.total_records || 0) - (data.has_more ? 1000 : 0),
            updated_records: totalUpdated,
            current_offset: currentOffset,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobRecord.id);

        if (!data.has_more) {
          // All done!
          await supabase
            .from('sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', jobRecord.id);

          return new Response(JSON.stringify({
            success: true,
            status: 'completed',
            job_id: jobRecord.id,
            updated: totalUpdated,
            message: `Sync complete: updated ${totalUpdated} records`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Time limit reached - auto-continue
    console.log(`Time limit reached, continuing job ${jobRecord.id} at phase=${currentPhase}, offset=${currentOffset}`);
    
    // Self-invoke to continue
    fetch(`${SUPABASE_URL}/functions/v1/bidirectional-sync-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        org_id,
        job_id: jobRecord.id,
        phase: currentPhase,
        offset: currentOffset
      })
    }).catch(err => console.error('Auto-continue error:', err));

    return new Response(JSON.stringify({
      success: true,
      status: 'continuing',
      job_id: jobRecord.id,
      phase: currentPhase,
      offset: currentOffset,
      updated_so_far: totalUpdated,
      message: 'Sync in progress, auto-continuing...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync orchestrator error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

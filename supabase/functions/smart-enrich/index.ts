import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmartEnrichRequest {
  jobId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { jobId }: SmartEnrichRequest = await req.json()
    console.log(`🧠 Starting Smart Enrich sequence for job: ${jobId}`)

    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job not found')
    }

    const orgId = job.org_id
    let totalEnriched = 0
    let totalFailed = 0

    // Update job status
    await supabaseClient
      .from('enrichment_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString() 
      })
      .eq('id', jobId)

    // TIER 1: Clearbit Free (unlimited, free)
    console.log('🔹 Tier 1: Running Clearbit Free enrichment...')
    
    const clearbitJobId = crypto.randomUUID()
    await supabaseClient
      .from('enrichment_jobs')
      .insert({
        id: clearbitJobId,
        org_id: orgId,
        provider: 'clearbit_free',
        job_type: 'firmographic',
        status: 'pending'
      })

    const clearbitResponse = await supabaseClient.functions.invoke('enrich-clearbit-free', {
      body: { job_id: clearbitJobId }
    })

    if (clearbitResponse.data) {
      totalEnriched += clearbitResponse.data.enriched || 0
      totalFailed += clearbitResponse.data.failed || 0
      console.log(`✅ Clearbit: ${clearbitResponse.data.enriched} enriched`)
    }

    // TIER 2: AI Enrichment (Gemini 2.5 Flash for remaining gaps)
    console.log('🔹 Tier 2: Running AI enrichment for remaining accounts...')
    
    const aiJobId = crypto.randomUUID()
    await supabaseClient
      .from('enrichment_jobs')
      .insert({
        id: aiJobId,
        org_id: orgId,
        provider: 'lovable_ai',
        job_type: 'firmographic',
        status: 'pending'
      })

    const aiResponse = await supabaseClient.functions.invoke('enrich-firmographics', {
      body: { job_id: aiJobId }
    })

    if (aiResponse.data) {
      totalEnriched += aiResponse.data.enriched || 0
      totalFailed += aiResponse.data.failed || 0
      console.log(`✅ AI: ${aiResponse.data.enriched} enriched`)
    }

    // TIER 3: PDL for top 100 high-scoring accounts
    console.log('🔹 Tier 3: Running PDL enrichment for top 100 accounts...')
    
    // Get top 100 scored accounts
    const { data: topAccounts } = await supabaseClient
      .from('scores')
      .select('account_external_id, overall')
      .eq('org_id', orgId)
      .order('overall', { ascending: false })
      .limit(100)

    if (topAccounts && topAccounts.length > 0) {
      const pdlJobId = crypto.randomUUID()
      await supabaseClient
        .from('enrichment_jobs')
        .insert({
          id: pdlJobId,
          org_id: orgId,
          provider: 'pdl',
          job_type: 'firmographic',
          status: 'pending',
          filter_criteria: {
            account_ids: topAccounts.map(a => a.account_external_id)
          }
        })

      const pdlResponse = await supabaseClient.functions.invoke('enrich-pdl', {
        body: { job_id: pdlJobId }
      })

      if (pdlResponse.data) {
        totalEnriched += pdlResponse.data.enriched || 0
        totalFailed += pdlResponse.data.failed || 0
        console.log(`✅ PDL: ${pdlResponse.data.enriched} enriched`)
      }
    } else {
      console.log('⚠️ No accounts eligible for PDL enrichment')
    }

    // Update master job with final results
    await supabaseClient
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        enriched_records: totalEnriched,
        failed_records: totalFailed,
        processed_records: totalEnriched + totalFailed
      })
      .eq('id', jobId)

    console.log(`✅ Smart Enrich complete: ${totalEnriched} enriched, ${totalFailed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        enriched: totalEnriched,
        failed: totalFailed,
        tiers: {
          clearbit: clearbitResponse.data?.enriched || 0,
          ai: aiResponse.data?.enriched || 0,
          pdl: topAccounts?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Smart enrich error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

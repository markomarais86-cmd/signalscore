import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrichRequest {
  orgId: string
  accountExternalIds?: string[]
  batchSize?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { orgId, accountExternalIds, batchSize = 100 }: EnrichRequest = await req.json()
    console.log(`🔄 Starting bulk contact enrichment for org: ${orgId}`)

    // Get high-fit accounts with no contacts
    let query = supabaseClient
      .from('accounts')
      .select('external_id, name, domain, industry_norm')
      .eq('org_id', orgId)

    if (accountExternalIds && accountExternalIds.length > 0) {
      query = query.in('external_id', accountExternalIds)
    } else {
      // Find high-fit accounts with no contacts
      const { data: accountsWithContacts } = await supabaseClient
        .from('contacts')
        .select('account_external_id')
        .eq('org_id', orgId)

      const accountIdsWithContacts = new Set(
        (accountsWithContacts || []).map(c => c.account_external_id)
      )

      const { data: highFitAccounts } = await supabaseClient
        .from('scores')
        .select('account_external_id')
        .eq('org_id', orgId)
        .gte('overall', 70)

      const highFitWithoutContacts = (highFitAccounts || [])
        .map(s => s.account_external_id)
        .filter(id => !accountIdsWithContacts.has(id))

      if (highFitWithoutContacts.length === 0) {
        console.log('✅ No high-fit accounts need contact enrichment')
        return new Response(
          JSON.stringify({
            success: true,
            enriched: 0,
            message: 'No accounts need contact enrichment'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      query = query.in('external_id', highFitWithoutContacts.slice(0, batchSize))
    }

    const { data: accounts, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching accounts:', fetchError)
      throw fetchError
    }

    if (!accounts || accounts.length === 0) {
      console.log('No accounts found to enrich')
      return new Response(
        JSON.stringify({
          success: true,
          enriched: 0,
          message: 'No accounts found to enrich'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${accounts.length} accounts to enrich with contacts`)

    // For now, create placeholder contacts for accounts with email domains
    // In production, this would call external APIs like Clearbit, PDL, etc.
    let enrichedCount = 0
    const errors: string[] = []

    for (const account of accounts) {
      try {
        if (!account.domain) {
          console.log(`Skipping ${account.name} - no domain`)
          continue
        }

        // Create a generic contact as placeholder
        // In production, replace with actual API call to find contacts
        const { error: insertError } = await supabaseClient
          .from('contacts')
          .insert({
            org_id: orgId,
            external_id: `${account.external_id}-contact-1`,
            account_external_id: account.external_id,
            email: `contact@${account.domain}`,
            first_name: 'Contact',
            last_name: 'Person',
            title_raw: 'Decision Maker',
            persona: 'Business Decision Maker',
            data_source: 'enrichment',
            enriched_from: 'bulk_enrichment',
            enriched_at: new Date().toISOString()
          })

        if (insertError && insertError.code !== '23505') { // Ignore duplicate errors
          console.error(`Error creating contact for ${account.name}:`, insertError)
          errors.push(`${account.name}: ${insertError.message}`)
        } else if (!insertError) {
          enrichedCount++
          console.log(`✅ Created contact for ${account.name}`)
        }
      } catch (error) {
        console.error(`Exception enriching ${account.name}:`, error)
        errors.push(`${account.name}: ${error.message}`)
      }
    }

    console.log(`✅ Created ${enrichedCount} contacts for ${accounts.length} accounts`)

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        total: accounts.length,
        errors: errors.length > 0 ? errors : undefined,
        note: 'Using placeholder contacts. Configure external enrichment providers for real data.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Bulk contact enrichment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

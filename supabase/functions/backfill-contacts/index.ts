import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackfillRequest {
  orgId: string
  batchSize?: number
}

// Persona mapping function (same logic as bulk-upload)
function mapTitleToPersona(title: string | null | undefined): string {
  if (!title) return 'Unknown'

  const lowerTitle = title.toLowerCase()

  // C-Level Technical
  if (/(?:cto|chief technology|chief technical|vp engineering|cio|chief information|chief digital)/i.test(title)) {
    return 'Technical Decision Maker'
  }

  // C-Level Business
  if (/(?:ceo|chief executive|president|founder|owner|cfo|chief financial|coo|chief operating|cmo|chief marketing)/i.test(title)) {
    return 'Business Decision Maker'
  }

  // VP/Director Technical
  if (/(?:director of engineering|director of technology|head of engineering|head of technology|engineering manager|director of software|head of software|director of it|head of it|it director)/i.test(title)) {
    return 'Technical Decision Maker'
  }

  // VP/Director IT
  if (/(?:director of information|it manager|systems manager|infrastructure manager|operations manager|director of operations|head of operations)/i.test(title)) {
    return 'IT Decision Maker'
  }

  // VP/Director Business
  if (/(?:vp|vice president|director of product|head of product|product director|director of strategy|head of strategy|director of sales|head of sales)/i.test(title)) {
    return 'Business Decision Maker'
  }

  // Senior Technical
  if (/(?:senior engineer|lead engineer|principal engineer|staff engineer|senior developer|lead developer|architect|solutions architect)/i.test(title)) {
    return 'Technical Influencer'
  }

  // Senior Business
  if (/(?:senior product|lead product|principal product|senior program|senior project|senior analyst|lead analyst)/i.test(title)) {
    return 'Business Influencer'
  }

  // Mid-Level Technical
  if (/(?:engineer|developer|programmer|devops|sre|site reliability|security engineer|qa engineer)/i.test(title)) {
    return 'Technical Influencer'
  }

  // Mid-Level Business
  if (/(?:product manager|program manager|project manager|business analyst|product owner|scrum master)/i.test(title)) {
    return 'Business Influencer'
  }

  // IT Staff
  if (/(?:it specialist|it support|help desk|desktop support|system administrator|sysadmin|network administrator|database administrator|dba)/i.test(title)) {
    return 'IT Decision Maker'
  }

  // End Users
  if (/(?:coordinator|assistant|associate|specialist|intern|trainee|junior)/i.test(title)) {
    return 'End User'
  }

  return 'Unknown'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orgId, batchSize = 1000 }: BackfillRequest = await req.json()

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Starting backfill for org: ${orgId}`)

    // Step 1: Get all existing contacts to avoid duplicates
    console.log('📋 Fetching existing contacts...')
    const { data: existingContacts, error: existingError } = await supabaseClient
      .from('contacts')
      .select('account_external_id, email')
      .eq('org_id', orgId)

    if (existingError) {
      throw new Error(`Failed to fetch existing contacts: ${existingError.message}`)
    }

    // Create a Set of existing contact keys (account_id + email)
    const existingContactKeys = new Set(
      existingContacts?.map(c => 
        `${c.account_external_id}_${c.email?.toLowerCase()}`
      ).filter(Boolean) || []
    )
    console.log(`✅ Found ${existingContactKeys.size} existing contacts`)

    // Step 2: Fetch all linked leads with emails
    console.log('📋 Fetching linked leads...')
    const { data: linkedLeads, error: leadsError } = await supabaseClient
      .from('Leads')
      .select('account_external_id, first_name, last_name, email, title, phone, mobile, country, state_province')
      .eq('org_id', orgId)
      .not('account_external_id', 'is', null)
      .not('email', 'is', null)

    if (leadsError) {
      throw new Error(`Failed to fetch linked leads: ${leadsError.message}`)
    }

    console.log(`✅ Found ${linkedLeads?.length || 0} linked leads with emails`)

    if (!linkedLeads || linkedLeads.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No linked leads found to backfill',
          created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Filter out leads that already have contacts and deduplicate
    console.log('🔍 Filtering and deduplicating leads...')
    const contactsMap = new Map<string, any>()
    let skipped = 0

    linkedLeads.forEach(lead => {
      if (!lead.email || !lead.account_external_id) return

      const contactKey = `${lead.account_external_id}_${lead.email.toLowerCase()}`
      
      // Skip if contact already exists
      if (existingContactKeys.has(contactKey)) {
        skipped++
        return
      }

      // Skip if we've already processed this lead (deduplicate)
      if (contactsMap.has(contactKey)) {
        return
      }

      contactsMap.set(contactKey, {
        org_id: orgId,
        external_id: `contact_${lead.email.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        account_external_id: lead.account_external_id,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        email: lead.email,
        title_raw: lead.title || null,
        persona: mapTitleToPersona(lead.title),
        phone: lead.phone || null,
        mobile: lead.mobile || null,
        country: lead.country || null,
        state_province: lead.state_province || null,
        data_source: 'database',
        enriched_from: 'backfill'
      })
    })

    const newContacts = Array.from(contactsMap.values())
    console.log(`📊 Skipped ${skipped} existing contacts, creating ${newContacts.length} new contacts`)

    if (newContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All leads already have contacts',
          created: 0,
          skipped
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Batch insert contacts
    let totalCreated = 0
    const errors: string[] = []

    for (let i = 0; i < newContacts.length; i += batchSize) {
      const batch = newContacts.slice(i, i + batchSize)
      console.log(`📦 Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} contacts)...`)

      const { data: inserted, error: insertError } = await supabaseClient
        .from('contacts')
        .insert(batch)
        .select('id')

      if (insertError) {
        console.error(`❌ Batch insert error:`, insertError)
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`)
      } else {
        totalCreated += inserted?.length || 0
        console.log(`✅ Inserted ${inserted?.length || 0} contacts`)
      }
    }

    console.log(`🎉 Backfill complete! Created ${totalCreated} contacts`)

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        skipped,
        total_leads: linkedLeads.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Backfill error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

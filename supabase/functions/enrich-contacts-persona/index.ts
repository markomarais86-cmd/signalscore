import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrichRequest {
  orgId: string
  batchSize?: number
}

// Persona mapping function
function mapTitleToPersona(title: string | null): string {
  if (!title) return 'Unknown';
  const t = title.toLowerCase().trim();
  
  // C-Level Technical
  if (/(cto|chief technology|chief technical|vp engineering|cio|chief information|chief digital)/i.test(t)) return 'Technical Decision Maker';
  // C-Level Business
  if (/(ceo|chief executive|president|founder|owner|cfo|chief financial|coo|chief operating|cmo|chief marketing)/i.test(t)) return 'Business Decision Maker';
  // VP/Director Technical
  if (/(director of engineering|director of technology|head of engineering|head of technology|engineering manager|director of software|head of software|director of it|head of it|it director)/i.test(t)) return 'Technical Decision Maker';
  // VP/Director IT
  if (/(director of information|it manager|systems manager|infrastructure manager|operations manager|director of operations|head of operations)/i.test(t)) return 'IT Decision Maker';
  // VP/Director Business
  if (/(vp|vice president|director of product|head of product|product director|director of strategy|head of strategy|director of sales|head of sales)/i.test(t)) return 'Business Decision Maker';
  // Senior Technical
  if (/(senior engineer|lead engineer|principal engineer|staff engineer|senior developer|lead developer|architect|solutions architect)/i.test(t)) return 'Technical Influencer';
  // Senior Business
  if (/(senior product|lead product|principal product|senior program|senior project|senior analyst|lead analyst)/i.test(t)) return 'Business Influencer';
  // Mid-Level Technical
  if (/(engineer|developer|programmer|devops|sre|site reliability|security engineer|qa engineer)/i.test(t)) return 'Technical Influencer';
  // Mid-Level Business
  if (/(product manager|program manager|project manager|business analyst|product owner|scrum master)/i.test(t)) return 'Business Influencer';
  // IT Staff
  if (/(it specialist|it support|help desk|desktop support|system administrator|sysadmin|network administrator|database administrator|dba)/i.test(t)) return 'IT Decision Maker';
  // End Users
  if (/(coordinator|assistant|associate|specialist|intern|trainee|junior)/i.test(t)) return 'End User';
  
  return 'Unknown';
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

    const { orgId, batchSize = 1000 }: EnrichRequest = await req.json()
    console.log(`🔄 Starting contact persona enrichment for org: ${orgId}`)

    // Get all contacts that need persona enrichment
    const { data: contacts, error: fetchError } = await supabaseClient
      .from('contacts')
      .select('id, title_raw, persona')
      .eq('org_id', orgId)
      .or('persona.is.null,persona.eq.Unknown')
      .not('title_raw', 'is', null)
      .limit(batchSize)

    if (fetchError) {
      console.error('Error fetching contacts:', fetchError)
      throw fetchError
    }

    if (!contacts || contacts.length === 0) {
      console.log('No contacts need enrichment')
      return new Response(
        JSON.stringify({
          success: true,
          enriched: 0,
          message: 'No contacts need enrichment'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${contacts.length} contacts to enrich`)

    // Enrich personas in batch
    const enrichedContacts = contacts.map(contact => ({
      id: contact.id,
      persona: mapTitleToPersona(contact.title_raw)
    }))

    // Update contacts with persona
    let enrichedCount = 0
    const errors: string[] = []

    for (const contact of enrichedContacts) {
      const { error: updateError } = await supabaseClient
        .from('contacts')
        .update({ persona: contact.persona })
        .eq('id', contact.id)

      if (updateError) {
        console.error(`Error updating contact ${contact.id}:`, updateError)
        errors.push(`Contact ${contact.id}: ${updateError.message}`)
      } else {
        enrichedCount++
      }
    }

    console.log(`✅ Enriched ${enrichedCount} contacts with persona data`)

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        total: contacts.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Contact enrichment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

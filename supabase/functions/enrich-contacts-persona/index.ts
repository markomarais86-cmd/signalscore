import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface EnrichRequest {
  orgId: string
  batchSize?: number
}

// Use database function for persona mapping
async function mapTitleToPersona(supabaseClient: any, title: string | null): Promise<string> {
  if (!title) return 'Unknown';
  
  try {
    const { data, error } = await supabaseClient.rpc('map_title_to_persona', { title_input: title });
    if (error) {
      console.error('Error calling map_title_to_persona:', error);
      return 'Unknown';
    }
    return data || 'Unknown';
  } catch (error) {
    console.error('Exception in mapTitleToPersona:', error);
    return 'Unknown';
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

    // Get all leads that need persona enrichment
    const { data: contacts, error: fetchError } = await supabaseClient
      .from('Leads')
      .select('id, title_raw, persona, title')
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

    // Enrich personas in batch using database function
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => ({
        id: contact.id,
        persona: await mapTitleToPersona(supabaseClient, contact.title_raw || contact.title)
      }))
    )

    // Update leads with persona
    let enrichedCount = 0
    const errors: string[] = []

    for (const contact of enrichedContacts) {
      const { error: updateError } = await supabaseClient
        .from('Leads')
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

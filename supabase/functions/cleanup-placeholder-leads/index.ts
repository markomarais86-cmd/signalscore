import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting cleanup of fake placeholder leads...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delete fake placeholder leads
    const { data, error } = await supabase
      .from('Leads')
      .delete()
      .eq('data_source', 'database')
      .eq('enriched_from', 'ai_placeholder')
      .select('id')

    if (error) {
      console.error('Error deleting leads:', error)
      throw error
    }

    const deletedCount = data?.length || 0
    console.log(`Successfully deleted ${deletedCount} fake placeholder leads`)

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} fake placeholder leads`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cleanup function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  data: any[]
  mapping: Record<string, string>
  orgId: string
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

    const { data, mapping, orgId }: UploadRequest = await req.json()
    console.log(`🚀 Starting bulk upload: ${data.length} leads`)

    let insertedLeads = 0
    const errors: string[] = []
    const BATCH_SIZE = 1000

    // Create reverse mapping
    const reverseMapping: Record<string, string> = {}
    Object.entries(mapping).forEach(([csvCol, dbField]) => {
      if (dbField) reverseMapping[dbField] = csvCol
    })

    // Helper function to normalize domain
    const normalizeDomain = (domain: string | null | undefined): string => {
      if (!domain) return '';
      let normalized = domain.trim().toLowerCase();
      normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
      normalized = normalized.replace(/^www\./i, '');
      normalized = normalized.replace(/\/.*$/, '');
      normalized = normalized.replace(/\.$/, '');
      return normalized;
    };

    // Helper function to extract domain from email
    const extractDomainFromEmail = (email: string | null): string => {
      if (!email || !email.includes('@')) return '';
      const domain = email.split('@')[1];
      return normalizeDomain(domain);
    };

    // Helper function to normalize revenue to standard ranges
    const normalizeRevenue = (revenue: string | null): string | null => {
      if (!revenue) return null;
      const rev = revenue.toLowerCase().trim();
      
      // Extract numeric value
      const match = rev.match(/\d+/);
      if (!match) return null;
      
      const value = parseInt(match[0]);
      
      // Map to standard ranges
      if (rev.includes('b') || value >= 1000000000) {
        if (value >= 10) return '$10B+';
        if (value >= 1) return '$1B-$10B';
        return '$500M-$1B';
      }
      if (rev.includes('m') || value >= 1000000) {
        if (value >= 500) return '$500M-$1B';
        if (value >= 100) return '$100M-$500M';
        if (value >= 50) return '$50M-$100M';
        if (value >= 25) return '$25M-$50M';
        if (value >= 10) return '$10M-$25M';
        if (value >= 5) return '$5M-$10M';
        if (value >= 1) return '$1M-$5M';
        return '$0-$1M';
      }
      return null;
    };

    // Helper function to normalize employee count
    const normalizeEmployeeCount = (employees: string | null): number | null => {
      if (!employees) return null;
      const emp = employees.toString().toLowerCase().trim();
      
      // Extract first number if it's a range or string
      const match = emp.match(/\d+/);
      if (!match) return null;
      
      return parseInt(match[0]);
    };

    // Process leads in batches
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
      console.log(`Processing batch: rows ${i + 1} to ${i + batch.length}`)

      // Deduplicate leads by external_id within this batch
      const leadsMap = new Map<string, any>()
      batch.forEach((row, idx) => {
        const firstName = reverseMapping.first_name && row[reverseMapping.first_name]
        const lastName = reverseMapping.last_name && row[reverseMapping.last_name]
        const company = reverseMapping.company && row[reverseMapping.company]
        const leadName = firstName && lastName ? `${firstName} ${lastName}` : company || 'Unknown Lead'
        
        const externalId = (reverseMapping.external_id && row[reverseMapping.external_id]) || `lead_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`
        
        // Get raw revenue and employee values
        const rawRevenue = reverseMapping.revenue_range && row[reverseMapping.revenue_range];
        const rawEmployees = reverseMapping.employee_count && row[reverseMapping.employee_count];
        
        // Only keep the first occurrence of each external_id
        if (!leadsMap.has(externalId)) {
          leadsMap.set(externalId, {
            org_id: orgId,
            external_id: externalId,
            name: leadName,
            status: (reverseMapping.status && row[reverseMapping.status]) || 'open',
            company: company || null,
            email: (reverseMapping.email && row[reverseMapping.email]) || null,
            phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
            mobile: (reverseMapping.mobile && row[reverseMapping.mobile]) || null,
            website: (reverseMapping.website && row[reverseMapping.website]) || null,
            industry: (reverseMapping.industry && row[reverseMapping.industry]) || null,
            revenue_range: normalizeRevenue(rawRevenue),
            employee_count: normalizeEmployeeCount(rawEmployees),
            country: (reverseMapping.country && row[reverseMapping.country]) || null,
            state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
            title: (reverseMapping.title && row[reverseMapping.title]) || null,
            first_name: firstName || null,
            last_name: lastName || null
          })
        }
      })
      
      const leadsData = Array.from(leadsMap.values())

      // Insert leads
      const { data: result, error } = await supabaseClient
        .from('Leads')
        .upsert(leadsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false })
        .select('id')

      if (error) {
        console.error('❌ Leads error:', error)
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      } else {
        insertedLeads += result?.length || 0
        console.log(`✅ Batch complete: ${result?.length || 0} leads`)
      }
    }

    console.log(`✅ Upload complete: ${insertedLeads} leads`)

    return new Response(
      JSON.stringify({
        success: true,
        insertedLeads,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Bulk upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  data: any[]
  mapping: Record<string, string>
  type: 'accounts' | 'contacts' | 'leads'
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

    const { data, mapping, type, orgId }: UploadRequest = await req.json()
    console.log(`🚀 Starting bulk upload: ${data.length} records, type: ${type}`)

    let insertedLeads = 0
    let insertedAccounts = 0
    let insertedContacts = 0
    const errors: string[] = []
    const BATCH_SIZE = 1000 // Reduced to avoid CPU timeout

    if (type === 'leads') {
      // Create reverse mapping
      const reverseMapping: Record<string, string> = {}
      Object.entries(mapping).forEach(([csvCol, dbField]) => {
        if (dbField) reverseMapping[dbField] = csvCol
      })

      // Pre-process unique companies for deduplication
      const uniqueCompanies = new Map<string, any>()
      data.forEach((row, idx) => {
        const company = (reverseMapping.company && row[reverseMapping.company]) || 'Unknown Company'
        const domain = (reverseMapping.website && row[reverseMapping.website]) || null
        const key = domain || company.toLowerCase()
        
        if (!uniqueCompanies.has(key)) {
          uniqueCompanies.set(key, {
            org_id: orgId,
            external_id: `acc_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
            name: company,
            domain: domain,
            industry_raw: (reverseMapping.industry && row[reverseMapping.industry]) || null,
            industry_norm: (reverseMapping.industry && row[reverseMapping.industry]) || null,
            employee_count: (reverseMapping.employee_count && row[reverseMapping.employee_count]) ? parseInt(row[reverseMapping.employee_count]) : null,
            revenue_range: (reverseMapping.revenue_range && row[reverseMapping.revenue_range]) || null,
            country: (reverseMapping.country && row[reverseMapping.country]) || null,
            state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
            phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
            data_source: 'crm',
            updated_at: new Date().toISOString()
          })
        }
      })

      // Process in large batches with parallel operations
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
        console.log(`Processing batch: rows ${i + 1} to ${i + batch.length}`)

        // Prepare all data for this batch
        const accountsData = batch.map((row, idx) => {
          const company = (reverseMapping.company && row[reverseMapping.company]) || 'Unknown Company'
          const domain = (reverseMapping.website && row[reverseMapping.website]) || null
          const key = domain || company.toLowerCase()
          const uniqueAccount = uniqueCompanies.get(key)!
          
          return {
            ...uniqueAccount,
            external_id: `acc_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`
          }
        })

        const contactsData = batch
          .filter((row) => 
            (reverseMapping.first_name && row[reverseMapping.first_name]) || 
            (reverseMapping.last_name && row[reverseMapping.last_name]) || 
            (reverseMapping.email && row[reverseMapping.email])
          )
          .map((row, idx) => ({
            org_id: orgId,
            external_id: `cont_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`,
            account_external_id: accountsData[idx].external_id,
            first_name: (reverseMapping.first_name && row[reverseMapping.first_name]) || null,
            last_name: (reverseMapping.last_name && row[reverseMapping.last_name]) || null,
            email: (reverseMapping.email && row[reverseMapping.email]) || null,
            title_raw: (reverseMapping.title && row[reverseMapping.title]) || null,
            mobile: (reverseMapping.mobile && row[reverseMapping.mobile]) || null,
            phone: (reverseMapping.phone && row[reverseMapping.phone]) || null,
            country: (reverseMapping.country && row[reverseMapping.country]) || null,
            state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
            data_source: 'crm',
            updated_at: new Date().toISOString()
          }))

        // Deduplicate leads by external_id within this batch
        const leadsMap = new Map<string, any>()
        batch.forEach((row, idx) => {
          const firstName = reverseMapping.first_name && row[reverseMapping.first_name]
          const lastName = reverseMapping.last_name && row[reverseMapping.last_name]
          const company = reverseMapping.company && row[reverseMapping.company]
          const leadName = firstName && lastName ? `${firstName} ${lastName}` : company || 'Unknown Lead'
          
          const externalId = (reverseMapping.external_id && row[reverseMapping.external_id]) || `lead_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`
          
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
              revenue_range: (reverseMapping.revenue_range && row[reverseMapping.revenue_range]) || null,
              employee_count: (reverseMapping.employee_count && row[reverseMapping.employee_count]) ? parseInt(row[reverseMapping.employee_count]) : null,
              country: (reverseMapping.country && row[reverseMapping.country]) || null,
              state_province: (reverseMapping.state_province && row[reverseMapping.state_province]) || null,
              title: (reverseMapping.title && row[reverseMapping.title]) || null,
              first_name: firstName || null,
              last_name: lastName || null,
              account_external_id: accountsData[idx].external_id,
              contact_external_id: contactsData[idx]?.external_id || null
            })
          }
        })
        
        const leadsData = Array.from(leadsMap.values())

        // PARALLEL EXECUTION - All three operations at once
        const [accountsResult, contactsResult, leadsResult] = await Promise.all([
          supabaseClient.from('accounts').upsert(accountsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false }).select('id, external_id'),
          contactsData.length > 0 
            ? supabaseClient.from('contacts').upsert(contactsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false }).select('id, external_id')
            : Promise.resolve({ data: [], error: null }),
          leadsData.length > 0
            ? supabaseClient.from('Leads').upsert(leadsData, { onConflict: 'org_id,external_id', ignoreDuplicates: false }).select('id')
            : Promise.resolve({ data: [], error: null })
        ])

        if (accountsResult.error) {
          console.error('❌ Accounts error:', accountsResult.error)
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} accounts: ${accountsResult.error.message}`)
        } else {
          insertedAccounts += accountsResult.data?.length || 0
        }

        if (contactsResult.error) {
          console.error('❌ Contacts error:', contactsResult.error)
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} contacts: ${contactsResult.error.message}`)
        } else {
          insertedContacts += contactsResult.data?.length || 0
        }

        if (leadsResult.error) {
          console.error('❌ Leads error:', leadsResult.error)
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} leads: ${leadsResult.error.message}`)
        } else {
          insertedLeads += leadsResult.data?.length || 0
        }

        console.log(`✅ Batch complete: ${accountsResult.data?.length || 0} accounts, ${contactsResult.data?.length || 0} contacts, ${leadsResult.data?.length || 0} leads`)
      }

    } else {
      // Single table upload for accounts/contacts with large batches
      const tableName = type === 'accounts' ? 'accounts' : 'contacts'
      
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
        
        const transformedData = batch.map((row, idx) => {
          const transformed: any = { 
            org_id: orgId,
            data_source: 'crm',
            updated_at: new Date().toISOString()
          }
          
          Object.entries(mapping).forEach(([csvField, dbField]) => {
            if (dbField && row[csvField] !== undefined && row[csvField] !== '') {
              transformed[dbField] = row[csvField]
            }
          })

          if (!transformed.external_id) {
            transformed.external_id = `${tableName.substring(0, 3)}_${Date.now()}_${i + idx}_${Math.random().toString(36).substr(2, 9)}`
          }
          
          return transformed
        })

        const { data: result, error } = await supabaseClient
          .from(tableName)
          .upsert(transformedData, { onConflict: 'org_id,external_id' })
          .select()

        if (error) {
          console.error(`❌ ${tableName} error:`, error)
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
        } else {
          if (type === 'accounts') insertedAccounts += result?.length || 0
          else insertedContacts += result?.length || 0
        }
      }
    }

    console.log(`✅ Upload complete: ${insertedLeads} leads, ${insertedAccounts} accounts, ${insertedContacts} contacts`)

    return new Response(
      JSON.stringify({
        success: true,
        insertedLeads,
        insertedAccounts,
        insertedContacts,
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

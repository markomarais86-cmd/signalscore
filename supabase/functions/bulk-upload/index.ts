import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to map industry strings to ZoomInfo taxonomy
const fuzzyMatchIndustry = (input: string): { primary: string; sub: string | null } | null => {
  if (!input) return null;
  
  const normalized = input.toLowerCase().trim();
  
  const industryMap: Record<string, { primary: string; sub?: string }> = {
    'technology': { primary: 'Software' },
    'software': { primary: 'Software' },
    'saas': { primary: 'Software', sub: 'Customer Relationship Management (CRM) Software' },
    'healthcare': { primary: 'Healthcare Services' },
    'medical': { primary: 'Hospitals & Physicians Clinics' },
    'finance': { primary: 'Finance' },
    'financial': { primary: 'Finance' },
    'banking': { primary: 'Finance', sub: 'Banking' },
    'retail': { primary: 'Retail' },
    'ecommerce': { primary: 'Retail' },
    'e-commerce': { primary: 'Retail' },
    'manufacturing': { primary: 'Manufacturing' },
    'education': { primary: 'Education' },
    'construction': { primary: 'Construction' },
    'real estate': { primary: 'Real Estate' },
    'insurance': { primary: 'Insurance' },
    'telecommunications': { primary: 'Telecommunications' },
    'media': { primary: 'Media & Internet' },
    'hospitality': { primary: 'Hospitality' },
    'transportation': { primary: 'Transportation' },
    'logistics': { primary: 'Transportation', sub: 'Freight & Logistics Services' },
    'energy': { primary: 'Energy, Utilities & Waste' },
    'government': { primary: 'Government' },
  };
  
  if (industryMap[normalized]) {
    return { 
      primary: industryMap[normalized].primary, 
      sub: industryMap[normalized].sub || null 
    };
  }
  
  for (const [key, value] of Object.entries(industryMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { primary: value.primary, sub: value.sub || null };
    }
  }
  
  return null;
}

interface UploadRequest {
  data: any[]
  mapping: Record<string, string>
  orgId: string
  isExternalDatabase?: boolean
}

// Helper function to normalize revenue to standard ranges
const normalizeRevenue = (revenue: string | null): string | null => {
  if (!revenue) return null;
  const rev = revenue.toLowerCase().trim();
  
  const match = rev.match(/\d+/);
  if (!match) return null;
  
  const value = parseInt(match[0]);
  
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
  const match = emp.match(/\d+/);
  if (!match) return null;
  return parseInt(match[0]);
};

// Helper function to enrich contact with persona
const mapTitleToPersona = (title: string | null): string => {
  if (!title) return 'Unknown';
  const t = title.toLowerCase();
  
  if (/(cto|chief technology|chief technical|vp engineering|cio|chief information|chief digital)/i.test(t)) return 'Technical Decision Maker';
  if (/(ceo|chief executive|president|founder|owner|cfo|chief financial|coo|chief operating|cmo|chief marketing)/i.test(t)) return 'Business Decision Maker';
  if (/(director of engineering|director of technology|head of engineering|head of technology|engineering manager|director of software|head of software|director of it|head of it|it director)/i.test(t)) return 'Technical Decision Maker';
  if (/(director of information|it manager|systems manager|infrastructure manager|operations manager|director of operations|head of operations)/i.test(t)) return 'IT Decision Maker';
  if (/(vp|vice president|director of product|head of product|product director|director of strategy|head of strategy|director of sales|head of sales)/i.test(t)) return 'Business Decision Maker';
  if (/(senior engineer|lead engineer|principal engineer|staff engineer|senior developer|lead developer|architect|solutions architect)/i.test(t)) return 'Technical Influencer';
  if (/(senior product|lead product|principal product|senior program|senior project|senior analyst|lead analyst)/i.test(t)) return 'Business Influencer';
  if (/(engineer|developer|programmer|devops|sre|site reliability|security engineer|qa engineer)/i.test(t)) return 'Technical Influencer';
  if (/(product manager|program manager|project manager|business analyst|product owner|scrum master)/i.test(t)) return 'Business Influencer';
  if (/(it specialist|it support|help desk|desktop support|system administrator|sysadmin|network administrator|database administrator|dba)/i.test(t)) return 'IT Decision Maker';
  if (/(coordinator|assistant|associate|specialist|intern|trainee|junior)/i.test(t)) return 'End User';
  
  return 'Unknown';
};

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

    const { data, mapping, orgId, isExternalDatabase = false }: UploadRequest = await req.json()
    console.log(`🚀 Starting bulk upload: ${data.length} leads for org ${orgId}`)

    let insertedLeads = 0
    const errors: string[] = []
    const BATCH_SIZE = 1000

    // Create reverse mapping
    const reverseMapping: Record<string, string> = {}
    Object.entries(mapping).forEach(([csvCol, dbField]) => {
      if (dbField) reverseMapping[dbField] = csvCol
    })

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
        
        const rawRevenue = reverseMapping.revenue_range && row[reverseMapping.revenue_range];
        const rawEmployees = reverseMapping.employee_count && row[reverseMapping.employee_count];
        
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

    // ALWAYS auto-match leads using the high-performance database function
    let matchResult = null;
    let createdAccountIds: string[] = [];
    
    if (insertedLeads > 0) {
      console.log('🔗 Running high-performance bulk matching...')
      const matchStart = Date.now();
      
      const { data: matchData, error: matchError } = await supabaseClient.rpc('bulk_match_all_leads', {
        p_org_id: orgId
      });

      if (matchError) {
        console.error('⚠️ Bulk match error:', matchError.message)
        errors.push(`Matching: ${matchError.message}`)
      } else {
        matchResult = matchData;
        const matchDuration = Date.now() - matchStart;
        console.log(`✅ Bulk matching completed in ${matchDuration}ms:`, matchResult)
      }
    }

    // Score new accounts if ICP exists and accounts were created
    if (matchResult?.accounts_created > 0) {
      const { data: icpData } = await supabaseClient
        .from('icp_profiles')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .limit(1)
        .single()

      // Get the newly created account IDs (those with AUTO_ prefix from recent)
      const { data: newAccounts } = await supabaseClient
        .from('accounts')
        .select('id, external_id')
        .eq('org_id', orgId)
        .like('external_id', 'AUTO_%')
        .order('updated_at', { ascending: false })
        .limit(matchResult.accounts_created)

      if (newAccounts && newAccounts.length > 0) {
        // Store the created account IDs to return
        createdAccountIds = newAccounts.map(a => a.id)
        const accountExternalIds = newAccounts.map(a => a.external_id)
        console.log(`📦 Created ${createdAccountIds.length} account IDs for enrichment`)

        if (icpData?.id) {
          console.log(`🎯 Triggering scoring for ${matchResult.accounts_created} new accounts...`)
          
          const { error: scoreError } = await supabaseClient
            .rpc('bulk_score_accounts_batch', {
              p_org_id: orgId,
              p_account_ids: accountExternalIds,
              p_icp_id: icpData.id
            })

          if (scoreError) {
            console.error('⚠️ Scoring error:', scoreError.message)
          } else {
            console.log(`✅ Scored ${accountExternalIds.length} accounts`)
          }
        }
      }
    }

    // Create contacts from linked leads if external database
    if (isExternalDatabase && insertedLeads > 0) {
      console.log('👤 Creating contacts from linked leads...')
      const { data: linkedLeads } = await supabaseClient
        .from('Leads')
        .select('account_external_id, first_name, last_name, email, title, phone, mobile, country, state_province')
        .eq('org_id', orgId)
        .not('account_external_id', 'is', null)
        .not('email', 'is', null)
      
      if (linkedLeads && linkedLeads.length > 0) {
        const contactsMap = new Map<string, any>()
        linkedLeads.forEach(lead => {
          if (!lead.email || !lead.account_external_id) return
          
          const contactKey = `${lead.account_external_id}_${lead.email.toLowerCase()}`
          if (!contactsMap.has(contactKey)) {
            contactsMap.set(contactKey, {
              org_id: orgId,
              external_id: `contact_${lead.email}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
              enriched_from: 'lead_upload'
            })
          }
        })
        
        const contactsData = Array.from(contactsMap.values())
        console.log(`Creating ${contactsData.length} unique contacts`)
        
        const { error: contactsError } = await supabaseClient
          .from('contacts')
          .upsert(contactsData, { onConflict: 'org_id,external_id', ignoreDuplicates: true })
        
        if (contactsError) {
          console.error('⚠️ Contact creation failed:', contactsError.message)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedLeads,
        insertedLeads: insertedLeads, // Alias for frontend compat
        matchedAccounts: matchResult?.accounts_created || 0, // Alias for frontend compat
        created_account_ids: createdAccountIds, // NEW: Return created account IDs for enrichment
        matching: matchResult ? {
          matched_to_existing: matchResult.matched_to_existing || 0,
          accounts_created: matchResult.accounts_created || 0,
          linked_to_new: matchResult.linked_to_new || 0,
          total_processed: matchResult.total_processed || 0,
          duration_ms: matchResult.duration_ms || 0
        } : null,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

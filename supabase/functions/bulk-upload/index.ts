import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  data: any[]
  mapping: Record<string, string>
  orgId: string
  isExternalDatabase?: boolean
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

    const { data, mapping, orgId, isExternalDatabase = false }: UploadRequest = await req.json()
    console.log(`🚀 Starting bulk upload: ${data.length} leads (External DB: ${isExternalDatabase})`)

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

    // Helper function to enrich contact with persona
    const mapTitleToPersona = (title: string | null): string => {
      if (!title) return 'Unknown';
      const t = title.toLowerCase();
      
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

      // Create accounts for external database leads
      if (isExternalDatabase) {
        const accountsToCreate = new Map<string, any>()
        
        leadsData.forEach(lead => {
          const domain = normalizeDomain(lead.website) || extractDomainFromEmail(lead.email)
          if (domain && !accountsToCreate.has(domain)) {
            accountsToCreate.set(domain, {
              org_id: orgId,
              external_id: `ext_${domain}_${Date.now()}`,
              name: lead.company || domain,
              domain: domain,
              industry_norm: lead.industry,
              employee_count: lead.employee_count,
              revenue_range: lead.revenue_range,
              country: lead.country,
              state_province: lead.state_province,
              phone: lead.phone,
              mobile: lead.mobile,
              data_source: 'database',
              external_database_match: true
            })
          }
        })

        if (accountsToCreate.size > 0) {
          console.log(`Creating ${accountsToCreate.size} database accounts`)
          const { error: accountError } = await supabaseClient
            .from('accounts')
            .upsert(Array.from(accountsToCreate.values()), { onConflict: 'org_id,domain', ignoreDuplicates: true })

          if (accountError) {
            console.error('Account creation error:', accountError)
          }
        }
      }

      // Insert leads (keeping the rest of the original code)
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

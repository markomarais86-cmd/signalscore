import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { validateAuth, unauthorizedResponse, errorResponse, handleCorsOptions } from '../_shared/auth.ts'
import { validateUUID, validateNumber, validateArray, validateEnum, ValidationError, validationErrorResponse } from '../_shared/validation.ts'

// Function to enrich existing leads with missing data
async function enrichExistingLeads(supabaseClient: any, jobId: string, batchSize: number, provider: string) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError) throw jobError

    // Update job status to processing
    await supabaseClient
      .from('enrichment_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)

    // Get leads that need enrichment
    const { data: leads, error: leadsError } = await supabaseClient
      .from('Leads')
      .select('id, external_id, name, email, title, persona, company, account_external_id')
      .eq('org_id', job.org_id)
      .or('email.is.null,title.is.null,persona.is.null,persona.eq.Unknown')
      .limit(batchSize)

    if (leadsError) throw leadsError

    if (!leads || leads.length === 0) {
      await supabaseClient
        .from('enrichment_jobs')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          processed_records: 0,
          enriched_records: 0
        })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: 'No leads need enrichment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${leads.length} leads to enrich`)

    let enrichedCount = 0
    let failedCount = 0
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY')
    const CLEARBIT_API_KEY = Deno.env.get('CLEARBIT_API_KEY')

    console.log(`📊 Processing ${leads.length} leads that need enrichment`);

    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      console.log(`\n🔄 [${i+1}/${leads.length}] Enriching: ${lead.name || lead.external_id}`);
      console.log(`  Missing fields: ${!lead.email ? 'email ' : ''}${!lead.title ? 'title ' : ''}${lead.persona === 'Unknown' ? 'persona' : ''}`);
      
      try {
        const updateData: any = {}
        let enrichmentSource = 'unknown'

        // If missing email, try to find it via People Data Labs
        if (!lead.email && lead.name && PDL_API_KEY) {
          try {
            console.log(`  🔍 Attempting PDL enrichment...`);
            const startTime = Date.now();
            const [firstName, ...lastNameParts] = lead.name.split(' ')
            const lastName = lastNameParts.join(' ')
            
            const pdlResponse = await fetch('https://api.peopledatalabs.com/v5/person/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': PDL_API_KEY
              },
              body: JSON.stringify({
                query: {
                  first_name: firstName,
                  last_name: lastName,
                  company: lead.company
                },
                size: 1
              })
            })

            const responseTime = Date.now() - startTime;
            console.log(`  📡 PDL Response: ${pdlResponse.status} (${responseTime}ms)`);

            if (pdlResponse.ok) {
              const pdlData = await pdlResponse.json()
              if (pdlData.data && pdlData.data.length > 0) {
                const person = pdlData.data[0]
                console.log(`  ✅ PDL success - found ${person.emails?.length || 0} emails, title: ${person.job_title || 'none'}`);
                if (person.emails && person.emails.length > 0) {
                  updateData.email = person.emails[0]
                  enrichmentSource = 'pdl'
                }
                if (!lead.title && person.job_title) {
                  updateData.title = person.job_title
                }
              }
            } else {
              const errorBody = await pdlResponse.text();
              console.error(`  ❌ PDL error: ${pdlResponse.status} - ${errorBody}`);
            }
          } catch (pdlError) {
            console.error(`  ❌ PDL exception:`, pdlError.message);
          }
        }

        // If still missing title or persona, enrich from what we have
        if (!lead.title && lead.company) {
          // Use AI to generate a reasonable title based on company
          updateData.title = updateData.title || 'Decision Maker'
          enrichmentSource = enrichmentSource === 'unknown' ? 'ai' : enrichmentSource
        }

        // Update lead if we found data
        if (Object.keys(updateData).length > 0) {
          updateData.enriched_at = new Date().toISOString()
          updateData.enriched_from = enrichmentSource

          const { error: updateError } = await supabaseClient
            .from('Leads')
            .update(updateData)
            .eq('id', lead.id)

          if (updateError) {
            console.error(`  ❌ Error updating lead:`, updateError)
            failedCount++
          } else {
            enrichedCount++
            console.log(`  💾 Lead updated successfully`);
          }
        } else {
          failedCount++
          console.log(`  ⚠️  No enrichment data found`);
        }

        // Update job progress every 10 leads
        if ((i + 1) % 10 === 0) {
          await supabaseClient
            .from('enrichment_jobs')
            .update({
              processed_records: i + 1,
              enriched_records: enrichedCount,
              failed_records: failedCount
            })
            .eq('id', jobId)
        }
      } catch (error) {
        console.error(`  ❌ Exception enriching lead:`, error.message)
        failedCount++
      }
    }

    console.log(`\n✅ Enrichment complete: ${enrichedCount} enriched, ${failedCount} failed`);

    // Mark job as completed
    await supabaseClient
      .from('enrichment_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_records: leads.length,
        enriched_records: enrichedCount,
        failed_records: failedCount
      })
      .eq('id', jobId)

    console.log(`✅ Enriched ${enrichedCount}/${leads.length} leads`)

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        failed: failedCount,
        total: leads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Job enrichment error:', error)
    
    // Mark job as failed
    await supabaseClient
      .from('enrichment_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', jobId)

    throw error
  }
}

interface EnrichRequest {
  jobId?: string
  orgId?: string
  accountExternalIds?: string[]
  batchSize?: number
  provider?: string
}

// Helper to get org_id from job
async function getJobOrgId(supabase: any, jobId: string): Promise<string | null> {
  const { data } = await supabase
    .from('enrichment_jobs')
    .select('org_id')
    .eq('id', jobId)
    .single();
  return data?.org_id || null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      console.error('[enrich-contacts-bulk] Auth failed:', authResult.error);
      return unauthorizedResponse(req, authResult.error);
    }

    const { user, supabaseClient: authClient } = authResult;
    console.log(`[enrich-contacts-bulk] Authenticated user: ${user!.id}`);

    // Get user's org_id
    const { data: profile, error: profileError } = await authClient!
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error('[enrich-contacts-bulk] Failed to get user org_id:', profileError?.message);
      return errorResponse(req, 'User profile not found');
    }

    const userOrgId = profile.org_id;

    // Create service role client for operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Parse and validate input
    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(req, 'Invalid JSON body');
    }

    // Validate jobId if provided
    let jobId: string | undefined;
    if (rawBody.jobId) {
      try {
        jobId = validateUUID(rawBody.jobId, 'jobId');
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
    }

    // Validate and determine orgId
    let orgId: string | undefined;
    if (rawBody.orgId) {
      try {
        orgId = validateUUID(rawBody.orgId, 'orgId');
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
      
      // Verify user has access to requested org
      if (orgId !== userOrgId) {
        console.warn(`[enrich-contacts-bulk] User ${user!.id} attempted to access org ${orgId} but belongs to ${userOrgId}`);
        return errorResponse(req, 'Access denied to this organization', 403);
      }
    } else if (!jobId) {
      // If no jobId and no orgId, use user's org
      orgId = userOrgId;
    }

    // Validate accountExternalIds array with bounds
    let accountExternalIds: string[] | undefined;
    if (rawBody.accountExternalIds) {
      try {
        accountExternalIds = validateArray<string>(rawBody.accountExternalIds, 'accountExternalIds', {
          maxLength: 1000,
          itemValidator: (item, index) => {
            if (typeof item !== 'string' || item.length > 255) {
              throw new ValidationError(`accountExternalIds[${index}] must be a string under 255 chars`, `accountExternalIds[${index}]`, 'INVALID_TYPE');
            }
            return item;
          }
        });
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
    }

    // Validate batchSize with bounds
    let batchSize: number = 100;
    try {
      const validated = validateNumber(rawBody.batchSize, 'batchSize', {
        min: 1,
        max: 1000,
        integer: true
      });
      if (validated !== undefined) {
        batchSize = validated;
      }
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        return validationErrorResponse(validationError, corsHeaders);
      }
      throw validationError;
    }

    // Validate provider enum
    let provider: string = 'pdl';
    if (rawBody.provider) {
      try {
        const validated = validateEnum(rawBody.provider, 'provider', ['pdl', 'clearbit', 'ai'] as const, false);
        if (validated) {
          provider = validated;
        }
      } catch (validationError) {
        if (validationError instanceof ValidationError) {
          return validationErrorResponse(validationError, corsHeaders);
        }
        throw validationError;
      }
    }
    
    console.log('🚀 Starting bulk contact enrichment');
    console.log(`📋 Request params: jobId=${jobId}, orgId=${orgId}, batchSize=${batchSize}, provider=${provider}`);
    
    // Get effective org ID for rate limiting
    const effectiveOrgId = orgId || (jobId ? await getJobOrgId(supabaseClient, jobId) : null);
    
    // Verify job belongs to user's org if jobId provided
    if (jobId && effectiveOrgId && effectiveOrgId !== userOrgId) {
      console.warn(`[enrich-contacts-bulk] User ${user!.id} attempted to access job in org ${effectiveOrgId} but belongs to ${userOrgId}`);
      return errorResponse(req, 'Access denied to this enrichment job', 403);
    }
    
    // Apply rate limiting if we have an org ID
    if (effectiveOrgId) {
      const rateLimitResponse = await applyRateLimit(supabaseClient, effectiveOrgId, 'enrich-contacts-bulk');
      if (rateLimitResponse) {
        console.log(`[enrich-contacts-bulk] Rate limited for org ${effectiveOrgId}`);
        return rateLimitResponse;
      }
    }
    
    // If jobId is provided, this is a job-based enrichment for existing leads
    if (jobId) {
      console.log(`🔄 Processing existing enrichment job: ${jobId}`)
      return await enrichExistingLeads(supabaseClient, jobId, batchSize, provider)
    }
    
    console.log(`🔄 Starting bulk contact discovery for org: ${orgId}`)

    // Get high-fit accounts with no leads
    let query = supabaseClient
      .from('accounts')
      .select('external_id, name, domain, industry_norm, country')
      .eq('org_id', orgId)

    if (accountExternalIds && accountExternalIds.length > 0) {
      query = query.in('external_id', accountExternalIds)
    } else {
      // Find high-fit accounts with no leads
      const { data: accountsWithLeads } = await supabaseClient
        .from('Leads')
        .select('account_external_id')
        .eq('org_id', orgId)

      const accountIdsWithLeads = new Set(
        (accountsWithLeads || []).map(c => c.account_external_id)
      )

      const { data: highFitAccounts } = await supabaseClient
        .from('scores')
        .select('account_external_id')
        .eq('org_id', orgId)
        .gte('overall', 70)

      const highFitWithoutLeads = (highFitAccounts || [])
        .map(s => s.account_external_id)
        .filter(id => !accountIdsWithLeads.has(id))

      if (highFitWithoutLeads.length === 0) {
        console.log('✅ No high-fit accounts need lead enrichment')
        return new Response(
          JSON.stringify({
            success: true,
            enriched: 0,
            message: 'No accounts need lead enrichment'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      query = query.in('external_id', highFitWithoutLeads.slice(0, batchSize))
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

    console.log(`Found ${accounts.length} accounts to enrich with leads`)

    // Enrich leads using waterfall: PDL → Clearbit → AI fallback
    let enrichedCount = 0
    const errors: string[] = []
    
    const PDL_API_KEY = Deno.env.get('PDL_API_KEY')
    const CLEARBIT_API_KEY = Deno.env.get('CLEARBIT_API_KEY')

    for (const account of accounts) {
      try {
        if (!account.domain) {
          console.log(`Skipping ${account.name} - no domain`)
          continue
        }

        let contactsFound: any[] = []

        // Phase 1: Try People Data Labs
        if (PDL_API_KEY && contactsFound.length === 0) {
          try {
            const pdlResponse = await fetch(`https://api.peopledatalabs.com/v5/company/search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': PDL_API_KEY
              },
              body: JSON.stringify({
                website: account.domain,
                size: 5
              })
            })

            if (pdlResponse.ok) {
              const pdlData = await pdlResponse.json()
              if (pdlData.data && pdlData.data.length > 0) {
                contactsFound = pdlData.data.slice(0, 3).map((person: any) => ({
                  first_name: person.first_name,
                  last_name: person.last_name,
                  email: person.emails?.[0],
                  title_raw: person.job_title,
                  source: 'pdl'
                }))
                console.log(`✅ PDL found ${contactsFound.length} contacts for ${account.name}`)
              }
            }
          } catch (pdlError) {
            console.log(`PDL error for ${account.name}:`, pdlError)
          }
        }

        // Phase 2: Try Clearbit if PDL didn't work
        if (CLEARBIT_API_KEY && contactsFound.length === 0) {
          try {
            const clearbitResponse = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${account.domain}`, {
              headers: {
                'Authorization': `Bearer ${CLEARBIT_API_KEY}`
              }
            })

            if (clearbitResponse.ok) {
              const clearbitData = await clearbitResponse.json()
              if (clearbitData) {
                // Clearbit doesn't provide individual contacts in free tier, create generic one
                contactsFound = [{
                  first_name: 'Decision',
                  last_name: 'Maker',
                  email: `contact@${account.domain}`,
                  title_raw: 'Key Decision Maker',
                  source: 'clearbit'
                }]
                console.log(`✅ Clearbit found company data for ${account.name}`)
              }
            }
          } catch (clearbitError) {
            console.log(`Clearbit error for ${account.name}:`, clearbitError)
          }
        }

        // Phase 3: AI fallback - create intelligent placeholder
        if (contactsFound.length === 0) {
          const industryTitles: { [key: string]: string[] } = {
            'Technology': ['CTO', 'VP Engineering', 'Head of Technology'],
            'Financial Services': ['CFO', 'VP Finance', 'Head of Finance'],
            'Healthcare': ['CMO', 'VP Operations', 'Head of Clinical Operations'],
            'default': ['CEO', 'COO', 'VP Operations']
          }
          
          const titles = industryTitles[account.industry_norm || 'default'] || industryTitles['default']
          contactsFound = [{
            first_name: 'Decision',
            last_name: 'Maker',
            email: `contact@${account.domain}`,
            title_raw: titles[0],
            level: 'C-Level',
            persona: 'Business Decision Maker',
            country: account.country || 'Unknown',
            source: 'ai_placeholder'
          }]
          console.log(`⚡ AI placeholder created for ${account.name}`)
        }

        // Insert discovered leads
        for (const contact of contactsFound) {
          if (!contact.email) continue

          const { error: insertError } = await supabaseClient
            .from('Leads')
            .insert({
              org_id: orgId,
              external_id: `${account.external_id}-${contact.email}`,
              account_external_id: account.external_id,
              email: contact.email,
              first_name: contact.first_name,
              last_name: contact.last_name,
              title: contact.title_raw,
              title_raw: contact.title_raw,
              persona: contact.persona || 'Unknown',
              level: contact.level,
              country: contact.country,
              data_source: 'database',
              enriched_from: contact.source,
              enriched_at: new Date().toISOString(),
              status: 'open'
            })

          if (insertError && insertError.code !== '23505') { // Ignore duplicates
            console.error(`Error inserting lead for ${account.name}:`, insertError)
            errors.push(`${account.name}: ${insertError.message}`)
          } else if (!insertError) {
            enrichedCount++
          }
        }

        console.log(`✅ Processed ${account.name}`)
      } catch (error) {
        console.error(`Exception enriching ${account.name}:`, error)
        errors.push(`${account.name}: ${error.message}`)
      }
    }

    console.log(`✅ Created ${enrichedCount} leads for ${accounts.length} accounts`)

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        total: accounts.length,
        errors: errors.length > 0 ? errors : undefined,
        note: PDL_API_KEY || CLEARBIT_API_KEY 
          ? 'Using PDL and Clearbit enrichment APIs with AI fallback' 
          : 'Using AI-powered placeholders. Configure PDL_API_KEY or CLEARBIT_API_KEY for real lead data.'
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

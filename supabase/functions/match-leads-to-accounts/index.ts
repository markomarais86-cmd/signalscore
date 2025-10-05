import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Domain normalization function
function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  
  let normalized = domain.trim().toLowerCase();
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/\/.*$/, '');
  normalized = normalized.replace(/\.$/, '');
  
  return normalized;
}

// Extract domain from email
function extractDomainFromEmail(email: string | null): string {
  if (!email) return '';
  const match = email.match(/@(.+)$/);
  return match ? match[1] : '';
}

// Extract base domain for fuzzy matching
function getBaseDomain(domain: string | null): string {
  if (!domain) return '';
  const normalized = normalizeDomain(domain);
  if (!normalized) return '';
  
  // Remove TLD and get base name
  // "siriusxm.ca" → "siriusxm"
  // "siemens-healthineers.com" → "siemens"
  const withoutTld = normalized.replace(/\.[^.]+$/, '');
  const base = withoutTld.split('-')[0]; // Take first part before dash
  
  return base.toLowerCase();
}

// Normalize company name for fuzzy matching
function normalizeCompanyName(name: string | null): string {
  if (!name) return '';
  
  let normalized = name.trim().toLowerCase();
  
  // Remove common company suffixes
  normalized = normalized.replace(/\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$/i, '');
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, is_external_db = false } = await req.json();

    if (!org_id) {
      console.error('❌ Missing org_id in request body');
      return new Response(
        JSON.stringify({ 
          error: 'org_id is required',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔗 Starting lead-to-account matching for org: ${org_id}`);
    console.log(`📝 Request at: ${new Date().toISOString()}`);

    // Step 1: Match to existing accounts (DB function)
    const { data: matchResult, error: matchError } = await supabase
      .rpc('match_leads_to_accounts_fast', {
        p_org_id: org_id,
        p_is_external_db: is_external_db
      });

    if (matchError) {
      throw new Error(`Match failed: ${matchError.message}`);
    }

    console.log(`✅ Step 1: Matched ${matchResult?.matched_to_existing || 0} leads to existing accounts`);

    // Step 2: Get unique domains that need accounts created
    const { data: leadsNeedingAccounts, error: leadsError } = await supabase
      .from('Leads')
      .select('id, company, website, email, industry, employee_count, revenue_range, country, state_province, phone, mobile')
      .eq('org_id', org_id)
      .is('account_external_id', null);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    console.log(`📋 Found ${leadsNeedingAccounts?.length || 0} leads needing accounts`);

    // Get unique domains
    const domainMap = new Map();
    for (const lead of leadsNeedingAccounts || []) {
      const domain = normalizeDomain(lead.website) || extractDomainFromEmail(lead.email);
      if (domain && !domainMap.has(domain)) {
        domainMap.set(domain, lead);
      }
    }

    console.log(`🌐 Processing ${domainMap.size} unique domains`);

    // Step 3: Create accounts one at a time
    let created = 0;
    let skipped = 0;
    const newAccountIds: string[] = [];
    const data_source = is_external_db ? 'database' : 'crm';

    for (const [domain, lead] of domainMap.entries()) {
      const external_id = crypto.randomUUID();
      
      const { data: accountId, error: insertError } = await supabase
        .rpc('insert_single_account', {
          p_org_id: org_id,
          p_external_id: external_id,
          p_name: lead.company,
          p_domain: domain,
          p_industry_norm: lead.industry,
          p_employee_count: lead.employee_count,
          p_revenue_range: lead.revenue_range,
          p_country: lead.country,
          p_state_province: lead.state_province,
          p_phone: lead.phone,
          p_mobile: lead.mobile,
          p_data_source: data_source
        });

      if (insertError) {
        console.error(`⚠️ Insert error for ${domain}:`, insertError.message);
        skipped++;
      } else if (accountId) {
        newAccountIds.push(accountId);
        created++;
        if (created % 10 === 0) {
          console.log(`✨ Created ${created}/${domainMap.size} accounts...`);
        }
      } else {
        skipped++;
      }
    }

    console.log(`✅ Step 2: Created ${created} accounts, skipped ${skipped} duplicates`);

    // Step 3: Link remaining leads (exact match DB function)
    const { data: linkResult, error: linkError } = await supabase
      .rpc('match_leads_to_accounts_fast', {
        p_org_id: org_id,
        p_is_external_db: is_external_db
      });

    if (linkError) {
      console.error('⚠️ Link error:', linkError.message);
    }

    console.log(`✅ Step 3: Linked ${linkResult?.linked_after_creation || 0} remaining leads`);

    // Step 4: Fuzzy matching for remaining unlinked leads
    const { data: unlinkedLeads, error: unlinkedError } = await supabase
      .from('Leads')
      .select('id, company, website, email, country')
      .eq('org_id', org_id)
      .is('account_external_id', null)
      .limit(1000); // Process in batches

    if (unlinkedError) {
      console.error('⚠️ Fuzzy match fetch error:', unlinkedError.message);
    }

    let fuzzyMatched = 0;
    if (unlinkedLeads && unlinkedLeads.length > 0) {
      console.log(`🔍 Running fuzzy matching on ${unlinkedLeads.length} unlinked leads...`);
      
      for (const lead of unlinkedLeads) {
        const baseDomain = getBaseDomain(lead.website || extractDomainFromEmail(lead.email));
        const companyName = normalizeCompanyName(lead.company);
        
        if (!baseDomain && !companyName) continue;

        // Call fuzzy matching function
        const { data: matches, error: fuzzyError } = await supabase
          .rpc('match_leads_fuzzy', {
            p_org_id: org_id,
            p_base_domain: baseDomain,
            p_company_name: companyName,
            p_country: lead.country
          });

        if (fuzzyError) {
          console.error(`⚠️ Fuzzy match error for lead ${lead.id}:`, fuzzyError.message);
          continue;
        }

        // Auto-link high-confidence matches (>= 0.80)
        if (matches && matches.length > 0 && matches[0].confidence >= 0.80) {
          const { error: updateError } = await supabase
            .from('Leads')
            .update({
              account_external_id: matches[0].account_external_id,
              match_confidence: matches[0].confidence
            })
            .eq('id', lead.id);

          if (!updateError) {
            fuzzyMatched++;
          }
        }
      }
      
      console.log(`✅ Step 4: Fuzzy matched ${fuzzyMatched} additional leads`);
    }

    // Step 5: Auto-score new accounts
    let scored = 0;
    const { data: icpData } = await supabase
      .from('icp_profiles')
      .select('id')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (icpData?.id && newAccountIds.length > 0) {
      console.log(`🎯 Scoring ${newAccountIds.length} new accounts...`);
      for (const accountId of newAccountIds) {
        const { error: scoreError } = await supabase
          .rpc('auto_score_account', {
            p_account_external_id: accountId,
            p_org_id: org_id
          });
        
        if (!scoreError) scored++;
      }
      console.log(`✅ Scored ${scored} accounts`);
    }

    const totalLinked = (matchResult?.matched_to_existing || 0) + (linkResult?.linked_after_creation || 0) + fuzzyMatched;

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: matchResult?.total_leads || 0,
        matched_to_existing: matchResult?.matched_to_existing || 0,
        new_accounts_created: created,
        accounts_scored: scored,
        failed: skipped,
        fuzzy_matched: fuzzyMatched,
        total_linked: totalLinked,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

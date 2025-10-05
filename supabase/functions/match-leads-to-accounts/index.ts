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

// Calculate Levenshtein distance similarity (0-1, where 1 = identical)
function levenshteinSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen); // Convert to similarity (0-1)
}

// Calculate Jaccard similarity based on word tokens
function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size; // Jaccard coefficient
}

// Combine multiple matching strategies for best accuracy
function calculateNameMatchScore(leadName: string, accountName: string): number {
  if (!leadName || !accountName) return 0;
  
  const norm1 = normalizeCompanyName(leadName);
  const norm2 = normalizeCompanyName(accountName);
  
  // Exact match after normalization = 1.0
  if (norm1 === norm2) return 1.0;
  
  // Calculate multiple similarity metrics
  const levenshtein = levenshteinSimilarity(norm1, norm2);
  const token = tokenSimilarity(norm1, norm2);
  
  // Weighted average (Levenshtein 60%, Token 40%)
  const composite = (levenshtein * 0.6) + (token * 0.4);
  
  return composite;
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

    // Step 4: Fuzzy matching - optimized in-memory processing
    const startTime = Date.now();
    
    // Fetch all unlinked leads at once
    const { data: unlinkedLeads, error: unlinkedError } = await supabase
      .from('Leads')
      .select('id, company, website, email, country')
      .eq('org_id', org_id)
      .is('account_external_id', null)
      .is('match_confidence', null)
      .limit(5000);

    if (unlinkedError) {
      console.error('⚠️ Fuzzy match fetch error:', unlinkedError.message);
    }

    let fuzzyMatched = 0;
    if (unlinkedLeads && unlinkedLeads.length > 0) {
      console.log(`🔍 Running in-memory fuzzy matching on ${unlinkedLeads.length} leads...`);
      
      // Fetch all accounts at once for matching
      const { data: allAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, domain, name, country')
        .eq('org_id', org_id);

      if (accountsError || !allAccounts) {
        console.error('⚠️ Failed to fetch accounts:', accountsError?.message);
      } else {
        console.log(`📦 Loaded ${allAccounts.length} accounts for matching`);
        
        // Build lookup maps for fast matching
        const domainMap = new Map<string, string>(); // base_domain -> account_external_id
        const nameCountryMap = new Map<string, string>(); // normalized_name|country -> account_external_id
        
        for (const account of allAccounts) {
          // Index by base domain
          if (account.domain) {
            const baseDomain = getBaseDomain(account.domain);
            if (baseDomain && !domainMap.has(baseDomain)) {
              domainMap.set(baseDomain, account.external_id);
            }
          }
          
          // Index by name + country
          if (account.name && account.country) {
            const normalizedName = normalizeCompanyName(account.name);
            const key = `${normalizedName}|${account.country.toLowerCase()}`;
            if (!nameCountryMap.has(key)) {
              nameCountryMap.set(key, account.external_id);
            }
          }
        }
        
        console.log(`🗂️ Built indexes: ${domainMap.size} domains, ${nameCountryMap.size} name+country pairs`);
        
        // Match leads in memory with advanced fuzzy matching
        const matches: Array<{ lead_id: number; account_id: string; confidence: number }> = [];
        
        for (const lead of unlinkedLeads) {
          const baseDomain = getBaseDomain(lead.website || extractDomainFromEmail(lead.email));
          const leadCountry = lead.country?.toLowerCase();
          
          let bestMatch: { accountId: string; confidence: number } | null = null;
          
          for (const account of allAccounts) {
            let confidence = 0;
            
            // Strategy 1: Domain + Country (highest confidence)
            if (baseDomain && account.domain) {
              const accountBaseDomain = getBaseDomain(account.domain);
              if (baseDomain === accountBaseDomain) {
                confidence = 0.75; // Base domain match
                if (leadCountry && account.country?.toLowerCase() === leadCountry) {
                  confidence = 0.90; // Domain + country match
                }
              }
            }
            
            // Strategy 2: Advanced Name Matching (if no strong domain match)
            if (confidence < 0.80 && lead.company && account.name) {
              const nameScore = calculateNameMatchScore(lead.company, account.name);
              
              if (nameScore >= 0.85) { // High name similarity threshold
                confidence = Math.max(confidence, nameScore * 0.85); // Max 85% for name only
                
                // Boost if country also matches
                if (leadCountry && account.country?.toLowerCase() === leadCountry) {
                  confidence = Math.min(0.95, confidence + 0.10); // +10% bonus for country match
                }
              }
            }
            
            // Keep best match above threshold
            if (confidence >= 0.80) {
              if (!bestMatch || confidence > bestMatch.confidence) {
                bestMatch = { accountId: account.external_id, confidence };
              }
            }
          }
          
          if (bestMatch) {
            matches.push({
              lead_id: lead.id,
              account_id: bestMatch.accountId,
              confidence: bestMatch.confidence
            });
          }
        }
        
        console.log(`✨ Found ${matches.length} high-confidence matches (>= 0.80)`);
        
        // Bulk update all matches at once
        if (matches.length > 0) {
          const updateData = matches.map(m => ({
            id: m.lead_id,
            account_external_id: m.account_id,
            match_confidence: m.confidence
          }));

          const { error: bulkUpdateError } = await supabase
            .from('Leads')
            .upsert(updateData, { onConflict: 'id' });

          if (bulkUpdateError) {
            console.error('⚠️ Bulk update error:', bulkUpdateError.message);
          } else {
            fuzzyMatched = matches.length;
          }
        }
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Step 4: Fuzzy matched ${fuzzyMatched} leads in ${elapsed}s (${(fuzzyMatched / parseFloat(elapsed)).toFixed(0)} leads/sec)`);
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

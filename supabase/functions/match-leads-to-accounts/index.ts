import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 1000; // Process leads in batches of 1000

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
  
  const withoutTld = normalized.replace(/\.[^.]+$/, '');
  const base = withoutTld.split('-')[0];
  
  return base.toLowerCase();
}

// Normalize company name for fuzzy matching
function normalizeCompanyName(name: string | null): string {
  if (!name) return '';
  
  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/\s+(inc|llc|ltd|corp|corporation|limited|gmbh|ag|sa|nv|bv|plc)\.?$/i, '');
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Calculate Levenshtein distance similarity (0-1)
function levenshteinSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  // Optimization: skip if lengths are too different
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

// Calculate Jaccard similarity based on word tokens
function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

// Combine multiple matching strategies
function calculateNameMatchScore(leadName: string, accountName: string): number {
  if (!leadName || !accountName) return 0;
  
  const norm1 = normalizeCompanyName(leadName);
  const norm2 = normalizeCompanyName(accountName);
  
  if (norm1 === norm2) return 1.0;
  
  const levenshtein = levenshteinSimilarity(norm1, norm2);
  const token = tokenSimilarity(norm1, norm2);
  
  return (levenshtein * 0.6) + (token * 0.4);
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
      return new Response(
        JSON.stringify({ error: 'org_id is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔗 Starting batched lead-to-account matching for org: ${org_id}`);
    const startTime = Date.now();

    // Get count of unlinked leads
    const { count: totalUnlinked } = await supabase
      .from('Leads')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .is('account_external_id', null);

    console.log(`📋 Total unlinked leads: ${totalUnlinked || 0}`);

    let totalMatched = 0;
    let totalCreated = 0;
    let totalFuzzyMatched = 0;
    const newAccountIds: string[] = [];
    const data_source = is_external_db ? 'database' : 'crm';

    // Process in batches to avoid timeout
    let offset = 0;
    let batchNumber = 0;
    const totalBatches = Math.ceil((totalUnlinked || 0) / BATCH_SIZE);

    while (true) {
      batchNumber++;
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (offset: ${offset})`);

      // Step 1: Get batch of unlinked leads
      const { data: batchLeads, error: batchError } = await supabase
        .from('Leads')
        .select('id, company, website, email, industry, employee_count, revenue_range, country, state_province, phone, mobile')
        .eq('org_id', org_id)
        .is('account_external_id', null)
        .range(0, BATCH_SIZE - 1); // Always get from start since we're linking them

      if (batchError) {
        console.error(`❌ Batch fetch error:`, batchError.message);
        break;
      }

      if (!batchLeads || batchLeads.length === 0) {
        console.log(`✅ No more unlinked leads to process`);
        break;
      }

      console.log(`📥 Fetched ${batchLeads.length} unlinked leads`);

      // Step 2: Get existing accounts for domain matching
      const { data: existingAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, domain, name, country')
        .eq('org_id', org_id);

      if (accountsError) {
        console.error(`❌ Accounts fetch error:`, accountsError.message);
        break;
      }

      // Build domain lookup map
      const domainToAccount = new Map<string, { external_id: string; name: string; country: string | null }>();
      for (const account of existingAccounts || []) {
        if (account.domain) {
          const normalizedDomain = normalizeDomain(account.domain);
          if (normalizedDomain) {
            domainToAccount.set(normalizedDomain, {
              external_id: account.external_id,
              name: account.name || '',
              country: account.country
            });
          }
        }
      }

      console.log(`📚 Loaded ${domainToAccount.size} domain mappings`);

      // Step 3: Match leads to existing accounts or prepare new accounts
      const leadsToUpdate: Array<{ id: number; account_external_id: string; match_confidence?: number }> = [];
      const accountsToCreate: Array<any> = [];
      const seenDomains = new Set<string>();

      for (const lead of batchLeads) {
        const domain = normalizeDomain(lead.website) || extractDomainFromEmail(lead.email);
        
        // Try exact domain match first
        if (domain && domainToAccount.has(domain)) {
          const account = domainToAccount.get(domain)!;
          leadsToUpdate.push({
            id: lead.id,
            account_external_id: account.external_id,
            match_confidence: 1.0
          });
          totalMatched++;
          continue;
        }

        // Try fuzzy matching
        let bestMatch: { accountId: string; confidence: number } | null = null;
        const baseDomain = domain ? getBaseDomain(domain) : null;
        const leadCountry = lead.country?.toLowerCase();

        for (const account of existingAccounts || []) {
          let confidence = 0;

          // Base domain match
          if (baseDomain && account.domain) {
            const accountBaseDomain = getBaseDomain(account.domain);
            if (baseDomain === accountBaseDomain) {
              confidence = 0.75;
              if (leadCountry && account.country?.toLowerCase() === leadCountry) {
                confidence = 0.90;
              }
            }
          }

          // Name matching
          if (confidence < 0.80 && lead.company && account.name) {
            const nameScore = calculateNameMatchScore(lead.company, account.name);
            if (nameScore >= 0.85) {
              confidence = Math.max(confidence, nameScore * 0.85);
              if (leadCountry && account.country?.toLowerCase() === leadCountry) {
                confidence = Math.min(0.95, confidence + 0.10);
              }
            }
          }

          if (confidence >= 0.80) {
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { accountId: account.external_id, confidence };
            }
          }
        }

        if (bestMatch) {
          leadsToUpdate.push({
            id: lead.id,
            account_external_id: bestMatch.accountId,
            match_confidence: bestMatch.confidence
          });
          totalFuzzyMatched++;
          continue;
        }

        // No match found - need to create new account
        if (domain && !seenDomains.has(domain)) {
          seenDomains.add(domain);
          const newExternalId = crypto.randomUUID();
          accountsToCreate.push({
            external_id: newExternalId,
            name: lead.company,
            domain: domain,
            industry_norm: lead.industry,
            employee_count: lead.employee_count,
            revenue_range: lead.revenue_range,
            country: lead.country,
            state_province: lead.state_province,
            phone: lead.phone,
            mobile: lead.mobile,
            data_source: data_source
          });
          
          // Add to domain map for subsequent leads in this batch
          domainToAccount.set(domain, { external_id: newExternalId, name: lead.company || '', country: lead.country });
          
          leadsToUpdate.push({
            id: lead.id,
            account_external_id: newExternalId,
            match_confidence: 1.0
          });
          totalCreated++;
        }
      }

      // Step 4: Bulk create new accounts
      if (accountsToCreate.length > 0) {
        console.log(`➕ Creating ${accountsToCreate.length} new accounts...`);
        
        const { data: bulkResult, error: bulkError } = await supabase
          .rpc('bulk_create_accounts', {
            p_org_id: org_id,
            p_accounts: accountsToCreate
          });

        if (bulkError) {
          console.error(`⚠️ Bulk create error:`, bulkError.message);
          // Fallback to individual inserts
          for (const account of accountsToCreate) {
            const { error: insertError } = await supabase
              .from('accounts')
              .insert({ ...account, org_id });
            if (insertError) {
              console.error(`⚠️ Insert error for ${account.domain}:`, insertError.message);
            }
          }
        } else {
          const ids = bulkResult?.[0]?.account_ids || [];
          newAccountIds.push(...ids);
        }
      }

      // Step 5: Bulk update leads with account links
      if (leadsToUpdate.length > 0) {
        console.log(`🔗 Linking ${leadsToUpdate.length} leads...`);
        
        // Update in chunks of 500 to avoid payload limits
        for (let i = 0; i < leadsToUpdate.length; i += 500) {
          const chunk = leadsToUpdate.slice(i, i + 500);
          const { error: updateError } = await supabase
            .from('Leads')
            .upsert(chunk, { onConflict: 'id' });

          if (updateError) {
            console.error(`⚠️ Lead update error:`, updateError.message);
          }
        }
      }

      console.log(`✅ Batch ${batchNumber} complete: ${leadsToUpdate.length} linked, ${accountsToCreate.length} accounts created`);

      // Safety check to prevent infinite loop
      if (batchNumber > 100) {
        console.log(`⚠️ Safety limit reached, stopping`);
        break;
      }
    }

    // Step 6: Score new accounts
    let scored = 0;
    if (newAccountIds.length > 0) {
      const { data: icpData } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', org_id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (icpData?.id) {
        console.log(`🎯 Scoring ${newAccountIds.length} new accounts...`);
        
        // Score in batches of 1000
        for (let i = 0; i < newAccountIds.length; i += 1000) {
          const chunk = newAccountIds.slice(i, i + 1000);
          const { data: scoreResult, error: scoreError } = await supabase
            .rpc('bulk_score_accounts_batch', {
              p_org_id: org_id,
              p_account_ids: chunk,
              p_icp_id: icpData.id
            });

          if (scoreError) {
            console.error(`⚠️ Scoring error:`, scoreError.message);
          } else {
            scored += scoreResult?.[0]?.success_count || 0;
          }
        }
        console.log(`✅ Scored ${scored} accounts`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalLinked = totalMatched + totalFuzzyMatched + totalCreated;

    console.log(`\n🎉 Matching complete in ${elapsed}s`);
    console.log(`   Exact matched: ${totalMatched}`);
    console.log(`   Fuzzy matched: ${totalFuzzyMatched}`);
    console.log(`   New accounts: ${totalCreated}`);
    console.log(`   Total linked: ${totalLinked}`);
    console.log(`   Accounts scored: ${scored}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: totalUnlinked || 0,
        matched_to_existing: totalMatched,
        new_accounts_created: totalCreated,
        fuzzy_matched: totalFuzzyMatched,
        accounts_scored: scored,
        total_linked: totalLinked,
        failed: 0,
        processing_time_seconds: parseFloat(elapsed)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

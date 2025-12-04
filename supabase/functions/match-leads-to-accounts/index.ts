import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process only 100 leads per call to avoid timeouts
const MICRO_BATCH_SIZE = 100;

// Simple domain normalization - no fuzzy matching
function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  let normalized = domain.trim().toLowerCase();
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/\/.*$/, '');
  normalized = normalized.replace(/\.$/, '');
  return normalized;
}

function extractDomainFromEmail(email: string | null): string {
  if (!email || !email.includes('@')) return '';
  const parts = email.split('@');
  return normalizeDomain(parts[1]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, batch_size = MICRO_BATCH_SIZE } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveBatchSize = Math.min(batch_size, 200); // Cap at 200 for safety
    console.log(`🔗 Processing up to ${effectiveBatchSize} unlinked leads for org: ${org_id}`);

    // Step 1: Get ONLY a micro-batch of unlinked leads
    const { data: unlinkedLeads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, company, website, email, industry, employee_count, revenue_range, country, state_province, phone, mobile')
      .eq('org_id', org_id)
      .is('account_external_id', null)
      .limit(effectiveBatchSize);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!unlinkedLeads || unlinkedLeads.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          matched: 0,
          created: 0,
          has_more: false,
          message: 'No unlinked leads remaining'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Processing ${unlinkedLeads.length} unlinked leads`);

    // Step 2: Build domain map from existing accounts (O(n) operation)
    const { data: existingAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, domain')
      .eq('org_id', org_id)
      .not('domain', 'is', null);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    const domainToAccountId = new Map<string, string>();
    for (const account of existingAccounts || []) {
      if (account.domain) {
        const normalized = normalizeDomain(account.domain);
        if (normalized) {
          domainToAccountId.set(normalized, account.external_id);
        }
      }
    }

    console.log(`📚 Loaded ${domainToAccountId.size} domain mappings`);

    // Step 3: Match leads by domain ONLY (no fuzzy matching)
    const leadsToUpdate: Array<{ id: number; account_external_id: string }> = [];
    const accountsToCreate: Array<any> = [];
    const seenDomains = new Set<string>();
    
    let matched = 0;
    let created = 0;

    for (const lead of unlinkedLeads) {
      const domain = normalizeDomain(lead.website) || extractDomainFromEmail(lead.email);
      
      if (!domain) {
        // No domain available - skip this lead (can't match without domain)
        continue;
      }

      // Check if domain maps to existing account
      if (domainToAccountId.has(domain)) {
        leadsToUpdate.push({
          id: lead.id,
          account_external_id: domainToAccountId.get(domain)!
        });
        matched++;
        continue;
      }

      // Check if we're already creating an account for this domain in this batch
      if (seenDomains.has(domain)) {
        // Get the account_external_id we're about to create
        const pendingAccount = accountsToCreate.find(a => a.domain === domain);
        if (pendingAccount) {
          leadsToUpdate.push({
            id: lead.id,
            account_external_id: pendingAccount.external_id
          });
        }
        continue;
      }

      // Create new account for this domain
      seenDomains.add(domain);
      const newExternalId = crypto.randomUUID();
      
      accountsToCreate.push({
        external_id: newExternalId,
        org_id: org_id,
        name: lead.company || domain,
        domain: domain,
        industry_norm: lead.industry,
        employee_count: lead.employee_count,
        revenue_range: lead.revenue_range,
        country: lead.country,
        state_province: lead.state_province,
        phone: lead.phone,
        mobile: lead.mobile,
        data_source: 'upload'
      });

      // Update domain map for subsequent leads in this batch
      domainToAccountId.set(domain, newExternalId);

      leadsToUpdate.push({
        id: lead.id,
        account_external_id: newExternalId
      });
      created++;
    }

    // Step 4: Insert new accounts
    if (accountsToCreate.length > 0) {
      console.log(`➕ Creating ${accountsToCreate.length} new accounts...`);
      
      const { error: insertError } = await supabase
        .from('accounts')
        .insert(accountsToCreate);

      if (insertError) {
        console.error(`⚠️ Account creation error:`, insertError.message);
        // Continue anyway - some may have been created
      }
    }

    // Step 5: Update leads with account links
    if (leadsToUpdate.length > 0) {
      console.log(`🔗 Linking ${leadsToUpdate.length} leads...`);
      
      const { error: updateError } = await supabase
        .from('Leads')
        .upsert(leadsToUpdate, { onConflict: 'id' });

      if (updateError) {
        console.error(`⚠️ Lead update error:`, updateError.message);
      }
    }

    // Step 6: Score new accounts if ICP exists
    let scored = 0;
    if (accountsToCreate.length > 0) {
      const { data: icpData } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('org_id', org_id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (icpData?.id) {
        console.log(`🎯 Scoring ${accountsToCreate.length} new accounts...`);
        
        const accountIds = accountsToCreate.map(a => a.external_id);
        const { data: scoreResult, error: scoreError } = await supabase
          .rpc('bulk_score_accounts_batch', {
            p_org_id: org_id,
            p_account_ids: accountIds,
            p_icp_id: icpData.id
          });

        if (!scoreError) {
          scored = scoreResult?.[0]?.success_count || accountIds.length;
        }
      }
    }

    // Check if there are more unlinked leads
    const { count: remainingCount } = await supabase
      .from('Leads')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .is('account_external_id', null);

    const hasMore = (remainingCount || 0) > 0;

    console.log(`✅ Batch complete: ${matched} matched, ${created} created, ${scored} scored, ${remainingCount || 0} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: unlinkedLeads.length,
        matched: matched,
        created: created,
        scored: scored,
        remaining: remainingCount || 0,
        has_more: hasMore
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ error: `Match failed: ${error.message}`, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

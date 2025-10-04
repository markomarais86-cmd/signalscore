import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MergeResult {
  org_id: string;
  total_accounts_before: number;
  total_accounts_after: number;
  duplicates_merged: number;
  accounts_deleted: number;
  leads_relinked: number;
  contacts_relinked: number;
  scores_relinked: number;
  domains_processed: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's org_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const orgId = profile.org_id;
    console.log(`Starting duplicate merge for org: ${orgId}`);

    // Step 1: Get count before merge
    const { count: countBefore } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    console.log(`Total accounts before merge: ${countBefore}`);

    // Step 2: Get all accounts for this org
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .not('domain', 'is', null);

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    console.log(`Fetched ${accounts?.length || 0} accounts with domains`);

    // Step 3: Group accounts by normalized domain
    const domainGroups = new Map<string, any[]>();
    
    for (const account of accounts || []) {
      const domain = account.domain;
      if (!domain) continue;

      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push(account);
    }

    console.log(`Found ${domainGroups.size} unique domains`);

    // Step 4: Process duplicates
    let duplicatesMerged = 0;
    let accountsDeleted = 0;
    let leadsRelinked = 0;
    let contactsRelinked = 0;
    let scoresRelinked = 0;
    const domainsProcessed: string[] = [];

    for (const [domain, accountList] of domainGroups.entries()) {
      // Only process if there are duplicates
      if (accountList.length <= 1) continue;

      console.log(`Processing ${accountList.length} duplicates for domain: ${domain}`);
      domainsProcessed.push(domain);

      // Select master account (most complete data, then earliest created)
      const master = accountList.reduce((best, current) => {
        const bestScore = [
          best.industry_norm,
          best.employee_count,
          best.revenue_range,
          best.country,
        ].filter(Boolean).length;

        const currentScore = [
          current.industry_norm,
          current.employee_count,
          current.revenue_range,
          current.country,
        ].filter(Boolean).length;

        if (currentScore > bestScore) return current;
        if (currentScore < bestScore) return best;
        
        // If equal completeness, prefer earlier updated
        return new Date(best.updated_at) < new Date(current.updated_at) 
          ? best 
          : current;
      });

      // Get duplicate IDs (all except master)
      const duplicateIds = accountList
        .filter(acc => acc.external_id !== master.external_id)
        .map(acc => acc.external_id);

      console.log(`Master account: ${master.external_id}, Duplicates: ${duplicateIds.length}`);

      // Relink Leads
      const { error: leadsError, count: leadsCount } = await supabase
        .from('Leads')
        .update({ account_external_id: master.external_id })
        .eq('org_id', orgId)
        .in('account_external_id', duplicateIds);

      if (!leadsError && leadsCount) {
        leadsRelinked += leadsCount;
        console.log(`Relinked ${leadsCount} leads to master account`);
      }

      // Relink Contacts
      const { error: contactsError, count: contactsCount } = await supabase
        .from('contacts')
        .update({ account_external_id: master.external_id })
        .eq('org_id', orgId)
        .in('account_external_id', duplicateIds);

      if (!contactsError && contactsCount) {
        contactsRelinked += contactsCount;
        console.log(`Relinked ${contactsCount} contacts to master account`);
      }

      // Relink Scores (or delete if master already has a score)
      const { error: scoresError, count: scoresCount } = await supabase
        .from('scores')
        .update({ account_external_id: master.external_id })
        .eq('org_id', orgId)
        .in('account_external_id', duplicateIds);

      if (!scoresError && scoresCount) {
        scoresRelinked += scoresCount;
        console.log(`Relinked ${scoresCount} scores to master account`);
      }

      // Delete duplicate accounts
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('org_id', orgId)
        .in('external_id', duplicateIds);

      if (deleteError) {
        console.error(`Failed to delete duplicates for ${domain}:`, deleteError);
      } else {
        accountsDeleted += duplicateIds.length;
        duplicatesMerged++;
        console.log(`Deleted ${duplicateIds.length} duplicate accounts for ${domain}`);
      }
    }

    // Step 5: Get count after merge
    const { count: countAfter } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    console.log(`Total accounts after merge: ${countAfter}`);

    const result: MergeResult = {
      org_id: orgId,
      total_accounts_before: countBefore || 0,
      total_accounts_after: countAfter || 0,
      duplicates_merged: duplicatesMerged,
      accounts_deleted: accountsDeleted,
      leads_relinked: leadsRelinked,
      contacts_relinked: contactsRelinked,
      scores_relinked: scoresRelinked,
      domains_processed: domainsProcessed,
    };

    console.log('Merge completed successfully:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in merge-duplicate-accounts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

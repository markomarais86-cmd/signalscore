import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      org_id,
      account_ids,
      persona_criteria,
      provider = 'apollo',
      preview_only = false
    } = await req.json();

    console.log('[find-campaign-contacts] Starting contact search:', {
      org_id,
      account_count: account_ids?.length,
      provider,
      preview_only,
      criteria: persona_criteria
    });

    if (!org_id || !account_ids || account_ids.length === 0) {
      throw new Error('Missing required fields: org_id and account_ids');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch account details
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, external_database_id')
      .eq('org_id', org_id)
      .in('external_id', account_ids);

    if (accountsError) throw accountsError;

    console.log(`[find-campaign-contacts] Found ${accounts?.length} accounts`);

    const allContacts: any[] = [];
    let totalApiCalls = 0;

    // For each account, fetch contacts from provider
    for (const account of accounts || []) {
      if (!account.domain) {
        console.log(`[find-campaign-contacts] Skipping account ${account.external_id} - no domain`);
        continue;
      }

      // Mock API call for now (replace with actual provider API)
      const mockContacts = await findContactsForAccount(
        account,
        persona_criteria,
        provider,
        supabase
      );

      allContacts.push(...mockContacts);
      totalApiCalls++;
    }

    console.log(`[find-campaign-contacts] Found ${allContacts.length} total contacts before deduplication`);

    // Deduplicate by email
    const emailMap = new Map();
    for (const contact of allContacts) {
      if (!emailMap.has(contact.email)) {
        emailMap.set(contact.email, contact);
      }
    }

    const uniqueContacts = Array.from(emailMap.values());
    console.log(`[find-campaign-contacts] ${uniqueContacts.length} unique contacts after deduplication`);

    // Check campaign_snapshots for recently exported emails (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const emails = uniqueContacts.map(c => c.email);
    const { data: recentExports } = await supabase
      .from('campaign_snapshots')
      .select('exported_emails')
      .eq('org_id', org_id)
      .gte('exported_at', thirtyDaysAgo.toISOString());

    // Build set of previously exported emails
    const exportedEmailsSet = new Set<string>();
    for (const snapshot of recentExports || []) {
      if (snapshot.exported_emails && Array.isArray(snapshot.exported_emails)) {
        snapshot.exported_emails.forEach((email: string) => exportedEmailsSet.add(email.toLowerCase()));
      }
    }

    // Mark contacts as previously exported
    const contactsWithHistory = uniqueContacts.map(contact => ({
      ...contact,
      previously_exported: exportedEmailsSet.has(contact.email.toLowerCase())
    }));

    const newContacts = contactsWithHistory.filter(c => !c.previously_exported);
    console.log(`[find-campaign-contacts] ${newContacts.length} new contacts, ${contactsWithHistory.length - newContacts.length} previously exported`);

    // Calculate data quality scores for all contacts (including previously exported)
    const enrichedContacts = contactsWithHistory.map(contact => ({
      ...contact,
      data_quality_score: calculateDataQuality(contact)
    }));

    // Sort by: new contacts first, then by quality score
    enrichedContacts.sort((a, b) => {
      if (a.previously_exported !== b.previously_exported) {
        return a.previously_exported ? 1 : -1;
      }
      return b.data_quality_score - a.data_quality_score;
    });

    // Calculate cost
    const costPerContact: Record<string, number> = {
      apollo: 0.02,
      zoominfo: 0.10,
      clearbit: 0.05
    };

    const stats = {
      total_found: allContacts.length,
      deduped: uniqueContacts.length,
      new_contacts: newContacts.length,
      previously_exported: enrichedContacts.length - newContacts.length,
      final_count: enrichedContacts.length
    };

    const costBreakdown = {
      api_calls: totalApiCalls,
      cost_per_contact: costPerContact[provider],
      total_cost: enrichedContacts.length * costPerContact[provider]
    };

    return new Response(
      JSON.stringify({
        success: true,
        contacts: enrichedContacts,
        stats,
        cost_breakdown: costBreakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[find-campaign-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function findContactsForAccount(
  account: any,
  criteria: any,
  provider: string,
  supabase: any
): Promise<any[]> {
  console.log(`[find-campaign-contacts] Finding contacts from Leads table for ${account.name}`);
  
  try {
    // Build query to fetch contacts from Leads table
    let query = supabase
      .from('Leads')
      .select('id, first_name, last_name, email, title, phone, mobile, linkedin_url, persona, level')
      .eq('account_external_id', account.external_id);

    // Apply persona filters if provided
    if (criteria.job_titles && criteria.job_titles.length > 0) {
      // Match titles using ILIKE for case-insensitive pattern matching
      const titleConditions = criteria.job_titles.map((t: string) => `title.ilike.%${t}%`).join(',');
      query = query.or(titleConditions);
    }

    if (criteria.seniority_levels && criteria.seniority_levels.length > 0) {
      query = query.in('level', criteria.seniority_levels);
    }

    if (criteria.departments && criteria.departments.length > 0) {
      query = query.in('persona', criteria.departments);
    }

    // Limit results per account
    const maxPerAccount = criteria.max_per_account || 10;
    query = query.limit(maxPerAccount);

    const { data: leads, error } = await query;

    if (error) {
      console.error(`[find-campaign-contacts] Error fetching leads:`, error);
      return [];
    }

    console.log(`[find-campaign-contacts] Found ${leads?.length || 0} contacts for ${account.name}`);

    // Transform leads into contact format with E.164 phone formatting
    const contacts = (leads || []).map(lead => {
      // Format phone to E.164 if available
      let phoneE164 = lead.phone;
      if (phoneE164 && !phoneE164.startsWith('+')) {
        // Basic E.164 formatting: remove non-digits, add +1 for US if no country code
        const digits = phoneE164.replace(/\D/g, '');
        if (digits.length === 10) {
          phoneE164 = '+1' + digits;
        } else if (digits.length === 11 && digits.startsWith('1')) {
          phoneE164 = '+' + digits;
        }
      }

      return {
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        email: lead.email || '',
        title: lead.title || '',
        phone: lead.phone || '',
        phone_e164: phoneE164 || '',
        mobile: lead.mobile || '',
        linkedin_url: lead.linkedin_url || '',
        account_name: account.name,
        account_id: account.external_id,
        provider: provider,
        persona: lead.persona,
        level: lead.level
      };
    });

    return contacts;
  } catch (error) {
    console.error(`[find-campaign-contacts] Unexpected error:`, error);
    return [];
  }
}


function calculateDataQuality(contact: any): number {
  const fields = [
    contact.first_name,
    contact.last_name,
    contact.email,
    contact.title,
    contact.phone,
    contact.linkedin_url
  ];
  
  const filledFields = fields.filter(f => f && f !== '').length;
  return Math.round((filledFields / fields.length) * 100);
}

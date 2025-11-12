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

    // Check identity registry for duplicates
    const emails = uniqueContacts.map(c => c.email);
    const { data: existingIdentities } = await supabase
      .from('identity_registry')
      .select('email_hash')
      .eq('org_id', org_id)
      .in('email_hash', emails.map(e => hashEmail(e)));

    const existingEmails = new Set(existingIdentities?.map(i => i.email_hash) || []);
    const newContacts = uniqueContacts.filter(c => !existingEmails.has(hashEmail(c.email)));

    console.log(`[find-campaign-contacts] ${newContacts.length} new contacts (not in identity registry)`);

    // Calculate data quality scores
    const enrichedContacts = newContacts.map(contact => ({
      ...contact,
      data_quality_score: calculateDataQuality(contact)
    }));

    // Sort by quality score
    enrichedContacts.sort((a, b) => b.data_quality_score - a.data_quality_score);

    // Calculate cost
    const costPerContact: Record<string, number> = {
      apollo: 0.02,
      zoominfo: 0.10,
      clearbit: 0.05
    };

    const stats = {
      total_found: allContacts.length,
      deduped: uniqueContacts.length,
      verified: enrichedContacts.length,
      suppressed: 0,
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
  // First, check if we have leads for this account in our database
  const { data: existingLeads } = await supabase
    .from('Leads')
    .select('*')
    .eq('account_external_id', account.external_id)
    .limit(criteria.max_per_account);

  if (existingLeads && existingLeads.length > 0) {
    console.log(`[find-campaign-contacts] Found ${existingLeads.length} existing leads for ${account.name}`);
    return existingLeads.map((lead: any) => ({
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      title: lead.title || '',
      phone: lead.phone,
      mobile_phone: lead.mobile_phone,
      linkedin_url: lead.linkedin_url,
      account_name: account.name,
      account_id: account.external_id
    }));
  }

  // If no leads in database, generate mock data
  // TODO: Replace with actual API calls to Apollo/ZoomInfo/Clearbit
  console.log(`[find-campaign-contacts] Generating mock contacts for ${account.name}`);
  
  const mockContacts: any[] = [];
  const count = Math.min(criteria.max_per_account, 3);
  
  const titles = criteria.job_titles?.length > 0 
    ? criteria.job_titles 
    : ['VP Sales', 'Director of Marketing', 'Head of Business Development'];

  for (let i = 0; i < count; i++) {
    const firstName = ['John', 'Jane', 'Michael', 'Sarah', 'David'][Math.floor(Math.random() * 5)];
    const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)];
    const domain = account.domain || 'example.com';
    
    mockContacts.push({
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      title: titles[i % titles.length],
      phone: '+1-555-0100',
      linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      account_name: account.name,
      account_id: account.external_id
    });
  }

  return mockContacts;
}

function hashEmail(email: string): string {
  // Simple hash for demo - in production use crypto
  return email.toLowerCase().trim();
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

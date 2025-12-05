import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedemptionRequest {
  org_id: string;
  account_domains: string[];
  persona_filters?: string[];
  max_contacts: number;
  campaign_name?: string;
}

interface ApolloContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  organization_name: string;
  organization?: {
    primary_domain: string;
  };
  linkedin_url?: string;
  phone_numbers?: { raw_number: string }[];
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      org_id, 
      account_domains, 
      persona_filters, 
      max_contacts,
      campaign_name 
    }: RedemptionRequest = await req.json();

    if (!org_id || !account_domains || account_domains.length === 0) {
      return new Response(
        JSON.stringify({ error: 'org_id and account_domains are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ error: 'Apollo API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[redeem-apollo-contacts] Starting redemption for org ${org_id}`);
    console.log(`[redeem-apollo-contacts] Domains: ${account_domains.length}, Max contacts: ${max_contacts}`);

    // Step 1: Get existing emails to deduplicate
    const { data: existingLeads } = await supabase
      .from('Leads')
      .select('email')
      .eq('org_id', org_id)
      .not('email', 'is', null);

    const existingEmails = new Set(
      (existingLeads || []).map(l => l.email?.toLowerCase()).filter(Boolean)
    );

    // Get previously exported emails (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: exports } = await supabase
      .from('campaign_snapshots')
      .select('exported_emails')
      .eq('org_id', org_id)
      .gte('exported_at', ninetyDaysAgo.toISOString());

    if (exports) {
      exports.forEach(exp => {
        if (exp.exported_emails && Array.isArray(exp.exported_emails)) {
          exp.exported_emails.forEach((e: string) => existingEmails.add(e.toLowerCase()));
        }
      });
    }

    console.log(`[redeem-apollo-contacts] Found ${existingEmails.size} existing/exported emails to skip`);

    // Step 2: Get account mapping (domain -> external_id)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, domain')
      .eq('org_id', org_id)
      .in('domain', account_domains);

    const domainToAccountId = new Map<string, string>();
    accounts?.forEach(a => {
      if (a.domain) {
        domainToAccountId.set(a.domain.toLowerCase(), a.external_id);
      }
    });

    // Step 3: Call Apollo People Search API
    // Build seniority filter based on persona_filters
    let seniorityLevels: string[] = [];
    if (persona_filters && persona_filters.length > 0) {
      const seniorityMap: Record<string, string[]> = {
        'Technical Decision Maker': ['c_suite', 'vp', 'director'],
        'Business Decision Maker': ['c_suite', 'vp', 'director'],
        'IT Decision Maker': ['c_suite', 'vp', 'director'],
        'Technical Influencer': ['manager', 'senior'],
        'Business Influencer': ['manager', 'senior'],
      };
      
      persona_filters.forEach(p => {
        const levels = seniorityMap[p] || [];
        levels.forEach(l => {
          if (!seniorityLevels.includes(l)) {
            seniorityLevels.push(l);
          }
        });
      });
    }

    const apolloRequestBody: Record<string, unknown> = {
      q_organization_domains: account_domains.join('\n'),
      per_page: Math.min(max_contacts, 100), // Apollo max is 100 per page
      page: 1,
    };

    if (seniorityLevels.length > 0) {
      apolloRequestBody.person_seniorities = seniorityLevels;
    }

    console.log(`[redeem-apollo-contacts] Calling Apollo people search...`);
    
    const allContacts: ApolloContact[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = Math.ceil(max_contacts / 100);

    while (hasMore && page <= maxPages && allContacts.length < max_contacts) {
      apolloRequestBody.page = page;
      
      const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apolloApiKey,
        },
        body: JSON.stringify(apolloRequestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[redeem-apollo-contacts] Apollo API error:`, response.status, errorText);
        throw new Error(`Apollo API error: ${response.status}`);
      }

      const data = await response.json();
      const contacts = data.people || [];
      
      console.log(`[redeem-apollo-contacts] Page ${page}: ${contacts.length} contacts`);
      
      allContacts.push(...contacts);
      hasMore = contacts.length === 100;
      page++;
      
      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[redeem-apollo-contacts] Total contacts from Apollo: ${allContacts.length}`);

    // Step 4: Deduplicate and prepare for insertion
    const newLeads: any[] = [];
    const skippedDuplicates: string[] = [];
    const redeemedEmails: string[] = [];

    for (const contact of allContacts) {
      if (newLeads.length >= max_contacts) break;
      
      const email = contact.email?.toLowerCase();
      if (!email || existingEmails.has(email)) {
        if (email) skippedDuplicates.push(email);
        continue;
      }

      // Find matching account
      const domain = contact.organization?.primary_domain?.toLowerCase();
      const accountExternalId = domain ? domainToAccountId.get(domain) : null;

      // Map seniority to persona
      let persona = 'Unknown';
      if (contact.seniority) {
        const seniorityToPersona: Record<string, string> = {
          'c_suite': 'Business Decision Maker',
          'vp': 'Business Decision Maker',
          'director': 'Technical Decision Maker',
          'manager': 'Technical Influencer',
          'senior': 'Technical Influencer',
        };
        persona = seniorityToPersona[contact.seniority] || 'Business Influencer';
      }

      newLeads.push({
        org_id,
        external_id: `apollo_${contact.id}`,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        title: contact.title,
        company: contact.organization_name,
        persona,
        linkedin: contact.linkedin_url,
        phone: contact.phone_numbers?.[0]?.raw_number,
        city: contact.city,
        state_province: contact.state,
        country: contact.country,
        account_external_id: accountExternalId,
        data_source: 'apollo',
        export_eligible: true,
      });

      redeemedEmails.push(email);
      existingEmails.add(email); // Prevent duplicates within this batch
    }

    console.log(`[redeem-apollo-contacts] New leads to insert: ${newLeads.length}, Duplicates skipped: ${skippedDuplicates.length}`);

    // Step 5: Insert new leads
    if (newLeads.length > 0) {
      const { error: insertError } = await supabase
        .from('Leads')
        .upsert(newLeads, { onConflict: 'org_id,external_id' });

      if (insertError) {
        console.error(`[redeem-apollo-contacts] Insert error:`, insertError);
        throw new Error(`Failed to insert leads: ${insertError.message}`);
      }
    }

    // Step 6: Log redemption
    const { error: logError } = await supabase
      .from('apollo_redemption_log')
      .insert({
        org_id,
        credits_used: newLeads.length, // Approximately 1 credit per contact
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates.length,
        persona_filters: persona_filters ? { filters: persona_filters } : null,
        campaign_name,
        source_accounts: account_domains.slice(0, 100), // Limit stored accounts
        redeemed_emails: redeemedEmails.slice(0, 1000), // Limit stored emails
      });

    if (logError) {
      console.error(`[redeem-apollo-contacts] Log error:`, logError);
    }

    // Step 7: Update credit usage
    const { data: currentCredits } = await supabase
      .from('external_data_sources')
      .select('credits_used_total')
      .eq('org_id', org_id)
      .eq('provider', 'apollo')
      .single();

    await supabase
      .from('external_data_sources')
      .upsert({
        org_id,
        provider: 'apollo',
        credits_used_total: (currentCredits?.credits_used_total || 0) + newLeads.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider'
      });

    console.log(`[redeem-apollo-contacts] Redemption complete!`);

    return new Response(
      JSON.stringify({
        success: true,
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates.length,
        credits_used: newLeads.length,
        redeemed_emails: redeemedEmails,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redeem-apollo-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
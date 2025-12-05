import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ICPRedemptionRequest {
  org_id: string;
  icp_criteria: {
    industries?: string[];
    geographies?: string[];
    company_sizes?: number[];
    revenue_ranges?: string[];
  };
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
    id: string;
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
      icp_criteria,
      persona_filters, 
      max_contacts,
      campaign_name 
    }: ICPRedemptionRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!icp_criteria || Object.keys(icp_criteria).length === 0) {
      return new Response(
        JSON.stringify({ error: 'icp_criteria is required' }),
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

    console.log(`[redeem-apollo-by-icp] Starting ICP-based redemption for org ${org_id}`);
    console.log(`[redeem-apollo-by-icp] ICP criteria:`, JSON.stringify(icp_criteria));
    console.log(`[redeem-apollo-by-icp] Max contacts: ${max_contacts}`);

    // Step 1: Get ALL existing emails to deduplicate
    // Get from Leads table
    const { data: existingLeads } = await supabase
      .from('Leads')
      .select('email')
      .eq('org_id', org_id)
      .not('email', 'is', null);

    const existingEmails = new Set<string>(
      (existingLeads || []).map(l => l.email?.toLowerCase()).filter(Boolean)
    );

    console.log(`[redeem-apollo-by-icp] Existing leads to skip: ${existingEmails.size}`);

    // Get previously exported emails (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: exports } = await supabase
      .from('campaign_snapshots')
      .select('exported_emails')
      .eq('org_id', org_id)
      .gte('exported_at', ninetyDaysAgo.toISOString());

    let exportedCount = 0;
    if (exports) {
      exports.forEach(exp => {
        if (exp.exported_emails && Array.isArray(exp.exported_emails)) {
          exp.exported_emails.forEach((e: string) => {
            existingEmails.add(e.toLowerCase());
            exportedCount++;
          });
        }
      });
    }

    console.log(`[redeem-apollo-by-icp] Previously exported emails added: ${exportedCount}`);
    console.log(`[redeem-apollo-by-icp] Total emails to skip: ${existingEmails.size}`);

    // Step 2: Build Apollo search parameters based on ICP criteria
    const searchBody: Record<string, unknown> = {
      per_page: 100, // Apollo max per page
      page: 1,
    };

    // Map industries
    if (icp_criteria.industries && icp_criteria.industries.length > 0) {
      searchBody.q_keywords = icp_criteria.industries.slice(0, 5).join(' OR ');
    }

    // Map geographies
    if (icp_criteria.geographies && icp_criteria.geographies.length > 0) {
      const locationNames = icp_criteria.geographies.map(g => {
        if (g.includes(',')) return g.split(',')[0].trim();
        return g;
      });
      searchBody.organization_locations = locationNames;
    }

    // Map company sizes to Apollo employee ranges
    if (icp_criteria.company_sizes && icp_criteria.company_sizes.length > 0) {
      const employeeRanges: string[] = [];
      icp_criteria.company_sizes.forEach(size => {
        if (size <= 10) employeeRanges.push('1,10');
        else if (size <= 50) employeeRanges.push('11,50');
        else if (size <= 200) employeeRanges.push('51,200');
        else if (size <= 500) employeeRanges.push('201,500');
        else if (size <= 1000) employeeRanges.push('501,1000');
        else if (size <= 5000) employeeRanges.push('1001,5000');
        else employeeRanges.push('5001,10000');
      });
      if (employeeRanges.length > 0) {
        searchBody.organization_num_employees_ranges = [...new Set(employeeRanges)];
      }
    }

    // Map persona filters to seniority
    if (persona_filters && persona_filters.length > 0) {
      const seniorityMap: Record<string, string[]> = {
        'Technical Decision Maker': ['c_suite', 'vp', 'director'],
        'Business Decision Maker': ['c_suite', 'vp', 'director'],
        'IT Decision Maker': ['c_suite', 'vp', 'director'],
        'Technical Influencer': ['manager', 'senior'],
        'Business Influencer': ['manager', 'senior'],
      };
      
      const seniorities: string[] = [];
      persona_filters.forEach(p => {
        const levels = seniorityMap[p] || [];
        levels.forEach(l => {
          if (!seniorities.includes(l)) {
            seniorities.push(l);
          }
        });
      });
      
      if (seniorities.length > 0) {
        searchBody.person_seniorities = seniorities;
      }
    }

    console.log(`[redeem-apollo-by-icp] Apollo search body:`, JSON.stringify(searchBody, null, 2));

    // Step 3: Fetch contacts from Apollo with pagination
    const allContacts: ApolloContact[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = Math.ceil(max_contacts / 100) + 2; // Extra pages for deduplication buffer

    while (hasMore && page <= maxPages && allContacts.length < max_contacts * 2) {
      searchBody.page = page;
      
      const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apolloApiKey,
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[redeem-apollo-by-icp] Apollo API error:`, response.status, errorText);
        throw new Error(`Apollo API error: ${response.status}`);
      }

      const data = await response.json();
      const contacts = data.people || [];
      
      console.log(`[redeem-apollo-by-icp] Page ${page}: ${contacts.length} contacts`);
      
      allContacts.push(...contacts);
      hasMore = contacts.length === 100;
      page++;
      
      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[redeem-apollo-by-icp] Total contacts from Apollo: ${allContacts.length}`);

    // Step 4: Deduplicate and prepare for insertion
    const newLeads: any[] = [];
    const skippedDuplicates: string[] = [];
    const redeemedEmails: string[] = [];

    for (const contact of allContacts) {
      if (newLeads.length >= max_contacts) break;
      
      const email = contact.email?.toLowerCase();
      if (!email) continue;
      
      // Skip duplicates
      if (existingEmails.has(email)) {
        skippedDuplicates.push(email);
        continue;
      }

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
        external_id: `apollo_icp_${contact.id}`,
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
        data_source: 'apollo',
        export_eligible: true,
      });

      redeemedEmails.push(email);
      existingEmails.add(email); // Prevent duplicates within this batch
    }

    console.log(`[redeem-apollo-by-icp] New leads to insert: ${newLeads.length}`);
    console.log(`[redeem-apollo-by-icp] Duplicates skipped: ${skippedDuplicates.length}`);

    // Step 5: Insert new leads
    if (newLeads.length > 0) {
      const { error: insertError } = await supabase
        .from('Leads')
        .upsert(newLeads, { onConflict: 'org_id,external_id' });

      if (insertError) {
        console.error(`[redeem-apollo-by-icp] Insert error:`, insertError);
        throw new Error(`Failed to insert leads: ${insertError.message}`);
      }
    }

    // Step 6: Log redemption
    const { error: logError } = await supabase
      .from('apollo_redemption_log')
      .insert({
        org_id,
        credits_used: newLeads.length,
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates.length,
        persona_filters: persona_filters ? { filters: persona_filters } : null,
        account_filters: { icp_criteria },
        campaign_name,
        redeemed_emails: redeemedEmails.slice(0, 1000),
      });

    if (logError) {
      console.error(`[redeem-apollo-by-icp] Log error:`, logError);
    }

    // Step 7: Update credit usage tracking
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

    console.log(`[redeem-apollo-by-icp] Redemption complete!`);

    return new Response(
      JSON.stringify({
        success: true,
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates.length,
        credits_used: newLeads.length,
        redeemed_emails: redeemedEmails,
        deduplication_summary: {
          total_from_apollo: allContacts.length,
          duplicates_removed: skippedDuplicates.length,
          new_contacts_added: newLeads.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redeem-apollo-by-icp] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

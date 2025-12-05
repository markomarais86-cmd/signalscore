import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedemptionRequest {
  org_id: string;
  domains?: string[];
  icp_criteria?: {
    industries?: string[];
    geographies?: string[];
    company_sizes?: number[];
    revenue_ranges?: string[];
  };
  persona_filters?: string[];
  max_contacts?: number;
  campaign_name?: string;
}

interface PDLPerson {
  work_email?: string;
  emails?: Array<{ address: string }>;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_website?: string;
  job_title_levels?: string[];
  linkedin_url?: string;
  location_name?: string;
  location_country?: string;
  mobile_phone?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      org_id, 
      domains, 
      icp_criteria, 
      persona_filters, 
      max_contacts = 50,
      campaign_name 
    }: RedemptionRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    if (!pdlApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'PDL API key not configured',
          configured: false,
          provider: 'pdl'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[redeem-pdl-contacts] Starting redemption for org ${org_id}, max ${max_contacts} contacts`);

    // Step 1: Get existing emails to deduplicate
    const { data: existingLeads } = await supabase
      .from('Leads')
      .select('email')
      .eq('org_id', org_id)
      .not('email', 'is', null);

    const existingEmails = new Set(
      (existingLeads || []).map(l => l.email?.toLowerCase()).filter(Boolean)
    );

    // Also get previously exported emails
    const { data: exportedSnapshots } = await supabase
      .from('campaign_snapshots')
      .select('exported_emails')
      .eq('org_id', org_id);

    (exportedSnapshots || []).forEach(snapshot => {
      if (snapshot.exported_emails && Array.isArray(snapshot.exported_emails)) {
        snapshot.exported_emails.forEach((email: string) => {
          existingEmails.add(email?.toLowerCase());
        });
      }
    });

    console.log(`[redeem-pdl-contacts] Found ${existingEmails.size} existing emails to dedupe against`);

    // Step 2: Get account mappings for domain -> account linking
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, domain, name')
      .eq('org_id', org_id)
      .not('domain', 'is', null);

    const domainToAccount = new Map<string, { external_id: string; name: string }>();
    (accounts || []).forEach(acc => {
      if (acc.domain) {
        const normalizedDomain = acc.domain.toLowerCase().replace(/^www\./, '');
        domainToAccount.set(normalizedDomain, { external_id: acc.external_id, name: acc.name || '' });
      }
    });

    // Step 3: Map persona filters to PDL seniorities
    const seniorityMapping: Record<string, string[]> = {
      'Technical Decision Maker': ['cxo', 'vp', 'director'],
      'Business Decision Maker': ['cxo', 'vp', 'director', 'owner', 'partner'],
      'IT Decision Maker': ['cxo', 'vp', 'director'],
      'Technical Influencer': ['manager', 'senior'],
      'Business Influencer': ['manager', 'senior'],
    };

    const pdlSeniorities = persona_filters && persona_filters.length > 0
      ? [...new Set(persona_filters.flatMap(p => seniorityMapping[p] || []))]
      : ['cxo', 'vp', 'director', 'manager'];

    // Step 4: Build PDL query
    const queryParts: string[] = [];

    if (domains && domains.length > 0) {
      const domainList = domains.slice(0, 50).map(d => `"${d.toLowerCase().replace(/^www\./, '')}"`).join(',');
      queryParts.push(`job_company_website IN (${domainList})`);
    }

    if (icp_criteria) {
      if (icp_criteria.geographies && icp_criteria.geographies.length > 0) {
        const countries = icp_criteria.geographies.map(g => `"${g}"`).join(',');
        queryParts.push(`location_country IN (${countries})`);
      }

      if (icp_criteria.industries && icp_criteria.industries.length > 0) {
        const industries = icp_criteria.industries.map(i => `"${i}"`).join(',');
        queryParts.push(`job_company_industry IN (${industries})`);
      }

      if (icp_criteria.company_sizes && icp_criteria.company_sizes.length > 0) {
        const sizes = icp_criteria.company_sizes;
        const minSize = Math.min(...sizes);
        const maxSize = Math.max(...sizes) * 2;
        queryParts.push(`job_company_size >= ${minSize} AND job_company_size <= ${maxSize}`);
      }
    }

    if (pdlSeniorities.length > 0) {
      const seniorities = pdlSeniorities.map(s => `"${s}"`).join(',');
      queryParts.push(`job_title_levels IN (${seniorities})`);
    }

    queryParts.push(`work_email IS NOT NULL`);

    const searchParams = {
      size: Math.min(max_contacts * 2, 200), // Fetch extra to account for duplicates
      dataset: 'all',
      sql: queryParts.join(' AND '),
    };

    console.log('[redeem-pdl-contacts] PDL Query:', searchParams.sql);

    // Step 5: Call PDL Person Search API
    const response = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': pdlApiKey,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[redeem-pdl-contacts] PDL API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `PDL API error: ${response.status}`,
          details: errorText,
          provider: 'pdl'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[redeem-pdl-contacts] PDL returned ${data.data?.length || 0} contacts`);

    // Step 6: Process contacts and deduplicate
    const mapSeniorityToPersona = (levels: string[]): string => {
      const level = levels?.[0]?.toLowerCase() || '';
      if (['cxo', 'owner', 'partner'].includes(level)) return 'Business Decision Maker';
      if (level === 'vp') return 'Technical Decision Maker';
      if (level === 'director') return 'IT Decision Maker';
      if (level === 'manager') return 'Technical Influencer';
      return 'Business Influencer';
    };

    const newLeads: any[] = [];
    let skippedDuplicates = 0;

    for (const person of (data.data || []) as PDLPerson[]) {
      if (newLeads.length >= max_contacts) break;

      const email = person.work_email || person.emails?.[0]?.address;
      if (!email) continue;

      const emailLower = email.toLowerCase();
      if (existingEmails.has(emailLower)) {
        skippedDuplicates++;
        continue;
      }

      // Find matching account
      const companyDomain = person.job_company_website?.toLowerCase().replace(/^www\./, '').replace(/\/$/, '');
      const accountMatch = companyDomain ? domainToAccount.get(companyDomain) : null;

      newLeads.push({
        org_id,
        email,
        first_name: person.first_name,
        last_name: person.last_name,
        name: person.full_name,
        title: person.job_title,
        company: person.job_company_name,
        website: person.job_company_website,
        persona: mapSeniorityToPersona(person.job_title_levels || []),
        linkedin_url: person.linkedin_url,
        country: person.location_country,
        city: person.location_name,
        mobile: person.mobile_phone,
        account_external_id: accountMatch?.external_id || null,
        data_source: 'database',
        enriched_from: 'pdl',
        enriched_at: new Date().toISOString(),
        export_eligible: true,
      });

      existingEmails.add(emailLower); // Prevent duplicates within this batch
    }

    console.log(`[redeem-pdl-contacts] Inserting ${newLeads.length} new leads, skipped ${skippedDuplicates} duplicates`);

    // Step 7: Insert new leads
    if (newLeads.length > 0) {
      const { error: insertError } = await supabase
        .from('Leads')
        .upsert(newLeads, { 
          onConflict: 'org_id,email',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('[redeem-pdl-contacts] Insert error:', insertError);
        throw insertError;
      }
    }

    // Step 8: Log redemption
    await supabase
      .from('apollo_redemption_log')
      .insert({
        org_id,
        campaign_name: campaign_name || 'PDL Contact Import',
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates,
        credits_used: 1, // PDL charges per search
        persona_filters: persona_filters ? { personas: persona_filters } : null,
        source_accounts: domains?.slice(0, 100) || [],
        redeemed_emails: newLeads.map(l => l.email),
      });

    // Step 9: Update credit tracking
    await supabase
      .from('external_data_sources')
      .upsert({
        org_id,
        provider: 'pdl',
        credits_used_total: 1,
        is_active: true,
        api_key_configured: true,
        credits_last_checked: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider'
      });

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'pdl',
        contacts_redeemed: newLeads.length,
        contacts_skipped_duplicate: skippedDuplicates,
        total_available: data.total || 0,
        message: `Successfully imported ${newLeads.length} contacts via PDL`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redeem-pdl-contacts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, provider: 'pdl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

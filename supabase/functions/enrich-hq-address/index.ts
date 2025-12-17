// HQ Address Enrichment Edge Function
// Fetches company headquarters address data from Apollo/PDL and updates accounts/leads

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  org_id: string;
  account_ids?: string[]; // Optional: specific accounts to enrich
  max_accounts?: number; // Limit for batch processing
  provider?: 'apollo' | 'pdl' | 'auto'; // Which provider to use
}

interface ApolloCompanyResponse {
  organization?: {
    street_address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

interface PDLCompanyResponse {
  location?: {
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, account_ids, max_accounts = 100, provider = 'auto' } = await req.json() as EnrichmentRequest;

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which provider to use
    let useApollo = provider === 'apollo' || (provider === 'auto' && !!apolloApiKey);
    let usePDL = provider === 'pdl' || (provider === 'auto' && !apolloApiKey && !!pdlApiKey);

    if (!apolloApiKey && !pdlApiKey) {
      return new Response(
        JSON.stringify({ error: 'No enrichment provider configured. Please add APOLLO_API_KEY or PDL_API_KEY.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enrich-hq-address] Starting enrichment for org ${org_id}, provider: ${useApollo ? 'apollo' : 'pdl'}`);

    // Fetch accounts that need HQ address enrichment
    let query = supabase
      .from('accounts')
      .select('id, external_id, name, domain')
      .eq('org_id', org_id)
      .or('hq_address.is.null,hq_city.is.null,hq_state.is.null')
      .not('domain', 'is', null)
      .limit(max_accounts);

    if (account_ids && account_ids.length > 0) {
      query = query.in('id', account_ids);
    }

    const { data: accounts, error: fetchError } = await query;

    if (fetchError) {
      console.error('[enrich-hq-address] Error fetching accounts:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch accounts', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No accounts need HQ address enrichment', enriched: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enrich-hq-address] Found ${accounts.length} accounts to enrich`);

    let enriched = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        let addressData: {
          hq_address: string | null;
          hq_city: string | null;
          hq_state: string | null;
          hq_postal_code: string | null;
          country: string | null;
        } | null = null;

        if (useApollo && apolloApiKey) {
          addressData = await enrichFromApollo(account.domain!, apolloApiKey);
        } else if (usePDL && pdlApiKey) {
          addressData = await enrichFromPDL(account.domain!, pdlApiKey);
        }

        if (addressData && (addressData.hq_address || addressData.hq_city || addressData.hq_state)) {
          // Update account
          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              ...addressData,
              enriched_at: new Date().toISOString(),
              enriched_from: useApollo ? 'apollo' : 'pdl',
            })
            .eq('id', account.id);

          if (updateError) {
            console.error(`[enrich-hq-address] Error updating account ${account.id}:`, updateError);
            failed++;
            errors.push(`Account ${account.name}: ${updateError.message}`);
            continue;
          }

          // Also update linked leads with the address data
          const { error: leadsError } = await supabase
            .from('Leads')
            .update({
              company_hq_address: addressData.hq_address,
              company_hq_city: addressData.hq_city,
              company_hq_state: addressData.hq_state,
              company_hq_postal_code: addressData.hq_postal_code,
              country: addressData.country,
            })
            .eq('account_external_id', account.external_id)
            .eq('org_id', org_id);

          if (leadsError) {
            console.warn(`[enrich-hq-address] Warning: Could not update leads for account ${account.id}:`, leadsError);
          }

          enriched++;
          console.log(`[enrich-hq-address] Enriched account ${account.name} (${account.domain})`);
        } else {
          console.log(`[enrich-hq-address] No address data found for ${account.domain}`);
          failed++;
        }

        // Rate limiting - small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[enrich-hq-address] Error enriching account ${account.id}:`, error);
        failed++;
        errors.push(`Account ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[enrich-hq-address] Completed: ${enriched} enriched, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched,
        failed,
        total: accounts.length,
        provider: useApollo ? 'apollo' : 'pdl',
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-hq-address] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function enrichFromApollo(domain: string, apiKey: string): Promise<{
  hq_address: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_postal_code: string | null;
  country: string | null;
} | null> {
  try {
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      console.error(`[Apollo] API error for ${domain}: ${response.status}`);
      return null;
    }

    const data = await response.json() as ApolloCompanyResponse;
    
    if (data.organization) {
      return {
        hq_address: data.organization.street_address || null,
        hq_city: data.organization.city || null,
        hq_state: data.organization.state || null,
        hq_postal_code: data.organization.postal_code || null,
        country: data.organization.country || null,
      };
    }

    return null;
  } catch (error) {
    console.error(`[Apollo] Error enriching ${domain}:`, error);
    return null;
  }
}

async function enrichFromPDL(domain: string, apiKey: string): Promise<{
  hq_address: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_postal_code: string | null;
  country: string | null;
} | null> {
  try {
    const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[PDL] API error for ${domain}: ${response.status}`);
      return null;
    }

    const data = await response.json() as PDLCompanyResponse;
    
    if (data.location) {
      return {
        hq_address: data.location.street_address || null,
        hq_city: data.location.locality || null,
        hq_state: data.location.region || null,
        hq_postal_code: data.location.postal_code || null,
        country: data.location.country || null,
      };
    }

    return null;
  } catch (error) {
    console.error(`[PDL] Error enriching ${domain}:`, error);
    return null;
  }
}

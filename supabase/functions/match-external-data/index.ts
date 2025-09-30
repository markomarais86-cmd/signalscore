// Phase 4: External Database Integration
// Edge function to match CRM accounts with external database records

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, provider } = await req.json();

    if (!org_id || !provider) {
      return new Response(
        JSON.stringify({ error: 'org_id and provider are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all CRM accounts for the organization
    const { data: crmAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, domain, name, external_id')
      .eq('org_id', org_id)
      .eq('data_source', 'crm');

    if (accountsError) throw accountsError;

    // TODO: Call external provider API to match accounts
    // For now, simulate matching logic
    const matches = crmAccounts?.map(account => ({
      account_id: account.id,
      domain: account.domain,
      matched: Math.random() > 0.3, // 70% match rate for simulation
    })) || [];

    // Update accounts with external database match flag
    for (const match of matches) {
      if (match.matched) {
        await supabase
          .from('accounts')
          .update({ external_database_match: true })
          .eq('id', match.account_id);
      }
    }

    // Update provider sync status
    const { error: updateError } = await supabase
      .from('external_data_sources')
      .update({
        last_synced_at: new Date().toISOString(),
        total_accounts: 95000, // Simulated total from provider
        total_contacts: 350000,
      })
      .eq('org_id', org_id)
      .eq('provider', provider);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        matched: matches.filter(m => m.matched).length,
        total: matches.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error matching external data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

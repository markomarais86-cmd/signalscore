import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting fast lead-to-account matching for org: ${org_id}`);

    // Use the optimized database function for bulk matching
    // This is MUCH faster than processing leads one by one
    const { data: result, error: matchError } = await supabase
      .rpc('match_leads_to_accounts_fast', {
        p_org_id: org_id,
        p_is_external_db: false
      });

    if (matchError) {
      console.error('Error in bulk matching:', matchError);
      throw matchError;
    }

    console.log(`Matching complete:`, result);

    return new Response(
      JSON.stringify({
        success: result?.success || true,
        total_leads: result?.total_leads || 0,
        matched_to_existing: result?.matched_to_existing || 0,
        new_accounts_created: result?.new_accounts_created || 0,
        accounts_scored: result?.accounts_scored || 0,
        failed: result?.failed || 0,
        total_linked: result?.total_linked || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in match-leads-to-accounts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      console.error('❌ Missing org_id in request body');
      return new Response(
        JSON.stringify({ 
          error: 'org_id is required',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔗 Starting fast lead-to-account matching for org: ${org_id}`);
    console.log(`📝 Request received at: ${new Date().toISOString()}`);

    // Use the optimized database function for bulk matching
    // This is MUCH faster than processing leads one by one
    try {
      console.log(`📞 Calling RPC: match_leads_to_accounts_fast with params:`, {
        p_org_id: org_id,
        p_is_external_db: false
      });

      const { data: result, error: matchError } = await supabase
        .rpc('match_leads_to_accounts_fast', {
          p_org_id: org_id,
          p_is_external_db: false
        });

      if (matchError) {
        console.error('❌ RPC Error Details:', {
          message: matchError.message,
          details: matchError.details,
          hint: matchError.hint,
          code: matchError.code
        });
        throw new Error(`Database function error: ${matchError.message} (Code: ${matchError.code})`);
      }

      console.log(`✅ Matching complete:`, result);
      console.log(`📊 Results: ${result?.total_linked || 0} leads linked, ${result?.new_accounts_created || 0} accounts created, ${result?.accounts_scored || 0} scored`);

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
    } catch (rpcError: any) {
      console.error('❌ RPC Call Failed:', {
        error: rpcError,
        message: rpcError.message,
        stack: rpcError.stack,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to execute matching function: ${rpcError.message}`,
          success: false,
          details: rpcError.details || rpcError.hint || 'Check edge function logs for more information'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('❌ Unexpected Error in match-leads-to-accounts:', {
      error: error,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false,
        details: 'An unexpected error occurred during lead matching. Please check the logs.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

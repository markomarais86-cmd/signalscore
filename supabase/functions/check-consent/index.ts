import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { contact_id, email, org_id } = await req.json();

    let checkEmail = email;

    // If contact_id provided, fetch email
    if (contact_id && !email) {
      const { data: lead } = await supabase
        .from('Leads')
        .select('email')
        .eq('id', contact_id)
        .eq('org_id', org_id)
        .single();
      
      if (lead) checkEmail = lead.email;
    }

    if (!checkEmail) {
      throw new Error('Email required for consent check');
    }

    console.log(`🔒 Checking consent for: ${checkEmail}`);

    // Check consent registry
    const { data: consentRecord } = await supabase
      .from('consent_registry')
      .select('*')
      .eq('org_id', org_id)
      .eq('email', checkEmail.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check suppression rules - email match
    const { data: emailSuppression } = await supabase
      .from('suppression_rules')
      .select('*')
      .eq('org_id', org_id)
      .eq('suppression_type', 'email')
      .eq('email', checkEmail.toLowerCase())
      .maybeSingle();

    // Check suppression rules - domain match
    const domain = checkEmail.split('@')[1];
    const { data: domainSuppression } = await supabase
      .from('suppression_rules')
      .select('*')
      .eq('org_id', org_id)
      .eq('suppression_type', 'domain')
      .eq('domain', domain)
      .maybeSingle();

    const suppressed = !!(emailSuppression || domainSuppression);
    const suppressionReason = emailSuppression?.reason || domainSuppression?.reason;

    // Determine consent status
    let consentStatus = 'unknown';
    if (consentRecord?.opt_out_timestamp) {
      consentStatus = 'opted_out';
    } else if (consentRecord?.consent_given) {
      consentStatus = 'given';
    } else if (consentRecord) {
      consentStatus = 'not_given';
    }

    const eligible = consentStatus === 'given' && !suppressed;

    console.log(`✅ Consent check: eligible=${eligible}, status=${consentStatus}, suppressed=${suppressed}`);

    return new Response(
      JSON.stringify({
        eligible,
        consent_status: consentStatus,
        reason: !eligible ? (suppressed ? suppressionReason : 'No consent given') : undefined,
        suppressed,
        suppression_reason: suppressionReason
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Consent check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

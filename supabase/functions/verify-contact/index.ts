import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { contact_id, verification_type, org_id } = await req.json();

    console.log(`🔍 Verifying ${verification_type} for contact ${contact_id}`);

    // Fetch contact from Leads table
    const { data: lead, error: fetchError } = await supabase
      .from('Leads')
      .select('email, phone, org_id')
      .eq('id', contact_id)
      .eq('org_id', org_id)
      .single();

    if (fetchError || !lead) {
      throw new Error('Contact not found');
    }

    const valueToVerify = verification_type === 'email' ? lead.email : lead.phone;
    
    if (!valueToVerify) {
      throw new Error(`No ${verification_type} found for contact`);
    }

    // Mock verification (95% confidence for valid format)
    const isValidFormat = verification_type === 'email' 
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueToVerify)
      : /^\+?[\d\s\-\(\)]+$/.test(valueToVerify);

    const status = isValidFormat ? 'valid' : 'invalid';
    const confidence = isValidFormat ? 95.0 : 10.0;

    // Update Leads table
    const updateField = verification_type === 'email' 
      ? { email_verified: isValidFormat, email_verification_status: status }
      : { phone_verified: isValidFormat, phone_verification_status: status };

    await supabase
      .from('Leads')
      .update(updateField)
      .eq('id', contact_id)
      .eq('org_id', org_id);

    // Log to verification_log
    await supabase
      .from('verification_log')
      .insert({
        org_id,
        contact_id,
        verification_type,
        value_checked: valueToVerify,
        status,
        confidence_score: confidence,
        provider: 'mock',
        provider_response: { format_valid: isValidFormat }
      });

    // Update identity_registry if email verification
    if (verification_type === 'email') {
      const emailHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(valueToVerify.toLowerCase())
      );
      const hashHex = Array.from(new Uint8Array(emailHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await supabase
        .from('identity_registry')
        .upsert({
          org_id,
          contact_id,
          primary_email: valueToVerify.toLowerCase(),
          email_hash: hashHex,
          crm_object_type: 'lead',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'org_id,email_hash'
        });
    }

    console.log(`✅ Verification complete: ${status} (${confidence}%)`);

    return new Response(
      JSON.stringify({
        verified: isValidFormat,
        status,
        confidence,
        provider: 'mock'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

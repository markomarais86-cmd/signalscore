import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse, errorResponse, successResponse, handleCorsOptions } from '../_shared/auth.ts';
import { validateUUID, validateEmail, validateNumber, ValidationError, validationErrorResponse } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.success) {
      return unauthorizedResponse(req, authResult.error);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid JSON body', 400);
    }

    const data = body as Record<string, unknown>;

    // Validate inputs
    const org_id = validateUUID(data.org_id, 'org_id');
    const contact_id = data.contact_id ? validateNumber(data.contact_id, 'contact_id', { integer: true, min: 1 }) : undefined;
    const email = data.email ? validateEmail(data.email, 'email', false) : undefined;

    if (!contact_id && !email) {
      return errorResponse(req, 'Either contact_id or email is required', 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      return errorResponse(req, 'Email required for consent check', 400);
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

    return successResponse(req, {
      eligible,
      consent_status: consentStatus,
      reason: !eligible ? (suppressed ? suppressionReason : 'No consent given') : undefined,
      suppressed,
      suppression_reason: suppressionReason
    });

  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error, corsHeaders);
    }
    
    console.error('❌ Consent check error:', error);
    return errorResponse(req, error instanceof Error ? error.message : 'Unknown error', 400);
  }
});

// Phase 4: External Database Integration
// Edge function to match CRM accounts with external database records

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse, errorResponse, successResponse, handleCorsOptions } from '../_shared/auth.ts';
import { validateUUID, validateString, ValidationError, validationErrorResponse } from '../_shared/validation.ts';

serve(async (req) => {
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
    const org_id = validateUUID(data.org_id, 'org_id');
    const provider = validateString(data.provider, 'provider', { required: true, minLength: 1, maxLength: 100 });

    if (!provider) {
      return errorResponse(req, 'provider is required', 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    return successResponse(req, {
      success: true,
      matched: matches.filter(m => m.matched).length,
      total: matches.length,
    });

  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error, corsHeaders);
    }

    console.error('Error matching external data:', error);
    return errorResponse(req, error instanceof Error ? error.message : 'Unknown error', 500);
  }
});

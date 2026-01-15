import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse, errorResponse, successResponse, handleCorsOptions } from '../_shared/auth.ts';
import { validateUUID, ValidationError, validationErrorResponse } from '../_shared/validation.ts';

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
    const org_id = validateUUID(data.org_id, 'org_id');

    console.log(`Running master data enrichment for org: ${org_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the enrichment function
    const { data: enrichmentResult, error } = await supabase.rpc('enrich_accounts_from_master', {
      p_org_id: org_id
    });

    if (error) {
      console.error('Enrichment error:', error);
      return errorResponse(req, error.message, 500);
    }

    console.log('Enrichment result:', enrichmentResult);

    // Get coverage stats
    const { data: stats } = await supabase
      .from('accounts')
      .select('employee_count, revenue_range, industry_norm, naics, enriched_from')
      .eq('org_id', org_id);

    const totalAccounts = stats?.length || 0;
    const coverage = {
      employee_count: stats?.filter(a => a.employee_count !== null).length || 0,
      revenue_range: stats?.filter(a => a.revenue_range !== null).length || 0,
      industry: stats?.filter(a => a.industry_norm !== null).length || 0,
      naics: stats?.filter(a => a.naics !== null).length || 0,
      enriched_from_master: stats?.filter(a => a.enriched_from?.includes('master_data')).length || 0,
    };

    return successResponse(req, {
      success: true,
      ...enrichmentResult,
      coverage: {
        total_accounts: totalAccounts,
        ...coverage,
        percentages: {
          employee_count: totalAccounts > 0 ? Math.round((coverage.employee_count / totalAccounts) * 100) : 0,
          revenue_range: totalAccounts > 0 ? Math.round((coverage.revenue_range / totalAccounts) * 100) : 0,
          industry: totalAccounts > 0 ? Math.round((coverage.industry / totalAccounts) * 100) : 0,
          naics: totalAccounts > 0 ? Math.round((coverage.naics / totalAccounts) * 100) : 0,
        }
      }
    });

  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error, corsHeaders);
    }

    console.error('Error:', error);
    return errorResponse(req, error instanceof Error ? error.message : 'Unknown error', 500);
  }
});

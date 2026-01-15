import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse, errorResponse, successResponse, handleCorsOptions } from '../_shared/auth.ts';
import { validateUUID, ValidationError, validationErrorResponse } from '../_shared/validation.ts';

interface CapitalMetrics {
  totalInvestment: number;
  salesInvestment: number;
  marketingInvestment: number;
  pipelineValue: number;
  revenueGenerated: number;
  pipelineMultiplier: number;
  revenueMultiplier: number;
  cac: number;
  roas: number;
}

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
    const orgId = validateUUID(data.orgId, 'orgId');

    console.log(`[capital-metrics] Fetching metrics for org: ${orgId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the most recent capital tracking record
    const { data: tracking, error: trackingError } = await supabase
      .from('capital_tracking')
      .select('*')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (trackingError && trackingError.code !== 'PGRST116') {
      console.error('[capital-metrics] Error fetching tracking:', trackingError);
      throw trackingError;
    }

    let metrics: CapitalMetrics;

    if (tracking) {
      const totalInvestment = tracking.total_investment || 0;
      const pipelineValue = tracking.pipeline_value || 0;
      const revenueGenerated = tracking.revenue_generated || 0;

      metrics = {
        totalInvestment,
        salesInvestment: tracking.sales_investment || 0,
        marketingInvestment: tracking.marketing_investment || 0,
        pipelineValue,
        revenueGenerated,
        pipelineMultiplier: totalInvestment > 0 ? pipelineValue / totalInvestment : 0,
        revenueMultiplier: totalInvestment > 0 ? revenueGenerated / totalInvestment : 0,
        cac: tracking.cac || 0,
        roas: tracking.roas || 0,
      };
    } else {
      // Return default empty metrics
      metrics = {
        totalInvestment: 0,
        salesInvestment: 0,
        marketingInvestment: 0,
        pipelineValue: 0,
        revenueGenerated: 0,
        pipelineMultiplier: 0,
        revenueMultiplier: 0,
        cac: 0,
        roas: 0,
      };
    }

    console.log(`[capital-metrics] Returning metrics for org: ${orgId}`);

    return successResponse(req, metrics);

  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error, corsHeaders);
    }

    console.error('[capital-metrics] Error:', error);
    return errorResponse(req, error instanceof Error ? error.message : 'Unknown error', 500);
  }
});

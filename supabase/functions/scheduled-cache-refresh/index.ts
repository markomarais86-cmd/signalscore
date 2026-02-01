import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshRequest {
  org_id?: string; // Optional: refresh for specific org, or all orgs if not provided
  force?: boolean; // Force refresh even if recently refreshed
}

// Materialized views to refresh
const MATERIALIZED_VIEWS = [
  'dashboard_metrics_cache',
  'leads_metrics_cache',
  'account_score_distribution_cache',
  'enrichment_coverage_cache',
  'pipeline_velocity_cache',
  'icp_performance_cache',
];

// Minimum interval between refreshes (15 minutes)
const MIN_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody: RefreshRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is fine for scheduled runs
    }

    const { org_id, force = false } = requestBody;

    console.log(`🔄 Starting cache refresh${org_id ? ` for org ${org_id}` : ' (all orgs)'}${force ? ' (forced)' : ''}`);

    // Check last refresh time to avoid excessive refreshes
    const { data: lastRefresh } = await supabase
      .from('system_health_checks')
      .select('checked_at')
      .eq('check_type', 'cache_refresh')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!force && lastRefresh) {
      const timeSinceLastRefresh = Date.now() - new Date(lastRefresh.checked_at).getTime();
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL_MS) {
        console.log(`⏭️ Skipping refresh - last refresh was ${Math.round(timeSinceLastRefresh / 1000)}s ago`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'Recently refreshed',
            last_refresh: lastRefresh.checked_at,
            next_allowed_at: new Date(new Date(lastRefresh.checked_at).getTime() + MIN_REFRESH_INTERVAL_MS).toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const results: Record<string, { success: boolean; duration_ms: number; error?: string }> = {};

    // Refresh each materialized view
    for (const viewName of MATERIALIZED_VIEWS) {
      const viewStart = Date.now();
      try {
        // Check if the view exists before refreshing
        const { data: viewExists, error: checkError } = await supabase
          .rpc('check_materialized_view_exists', { view_name: viewName })
          .maybeSingle();

        if (checkError || !viewExists) {
          console.log(`⏭️ Skipping ${viewName} - view does not exist or check failed`);
          results[viewName] = {
            success: false,
            duration_ms: Date.now() - viewStart,
            error: 'View does not exist',
          };
          continue;
        }

        // Refresh the materialized view
        const { error: refreshError } = await supabase
          .rpc('refresh_materialized_view_concurrently', { view_name: viewName });

        if (refreshError) {
          console.error(`❌ Failed to refresh ${viewName}:`, refreshError.message);
          results[viewName] = {
            success: false,
            duration_ms: Date.now() - viewStart,
            error: refreshError.message,
          };
        } else {
          console.log(`✅ Refreshed ${viewName} in ${Date.now() - viewStart}ms`);
          results[viewName] = {
            success: true,
            duration_ms: Date.now() - viewStart,
          };
        }
      } catch (error: any) {
        console.error(`❌ Error refreshing ${viewName}:`, error.message);
        results[viewName] = {
          success: false,
          duration_ms: Date.now() - viewStart,
          error: error.message,
        };
      }
    }

    // Also refresh org-specific caches if org_id provided
    if (org_id) {
      console.log(`📊 Refreshing org-specific metrics for ${org_id}...`);
      
      try {
        // Refresh dashboard metrics for this org
        const { error: metricsError } = await supabase
          .rpc('refresh_dashboard_metrics', { p_org_id: org_id });

        if (metricsError) {
          console.warn(`⚠️ Failed to refresh org metrics: ${metricsError.message}`);
          results['org_dashboard_metrics'] = {
            success: false,
            duration_ms: 0,
            error: metricsError.message,
          };
        } else {
          results['org_dashboard_metrics'] = {
            success: true,
            duration_ms: 0,
          };
        }
      } catch (error: any) {
        console.warn(`⚠️ Org metrics refresh error: ${error.message}`);
      }
    }

    // Log this refresh attempt
    try {
      await supabase
        .from('system_health_checks')
        .insert({
          check_type: 'cache_refresh',
          status: 'completed',
          details: {
            results,
            org_id: org_id || 'all',
            forced: force,
          },
        });
    } catch (logError) {
      console.warn('Failed to log refresh attempt:', logError);
    }

    const duration = Date.now() - startTime;
    const successCount = Object.values(results).filter(r => r.success).length;
    const failCount = Object.values(results).filter(r => !r.success).length;

    console.log(`🎉 Cache refresh complete in ${duration}ms: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        refreshed_views: successCount,
        failed_views: failCount,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Cache refresh error:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

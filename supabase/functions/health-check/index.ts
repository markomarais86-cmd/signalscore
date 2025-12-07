import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: { status: string; latency_ms?: number; error?: string };
    auth: { status: string; error?: string };
    edge_functions: { status: string };
  };
  metrics?: {
    total_accounts: number;
    total_leads: number;
    total_organizations: number;
    active_enrichment_jobs: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks: {
      database: { status: "unknown" },
      auth: { status: "unknown" },
      edge_functions: { status: "ok" },
    },
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check database connectivity
    const dbStart = Date.now();
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id")
        .limit(1);

      if (error) throw error;
      
      healthStatus.checks.database = {
        status: "ok",
        latency_ms: Date.now() - dbStart,
      };
    } catch (dbError: any) {
      healthStatus.checks.database = {
        status: "error",
        error: dbError.message,
      };
      healthStatus.status = "degraded";
    }

    // Check auth service
    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      healthStatus.checks.auth = { status: "ok" };
    } catch (authError: any) {
      healthStatus.checks.auth = {
        status: "error",
        error: authError.message,
      };
      healthStatus.status = "degraded";
    }

    // Get basic metrics (only if database is healthy)
    if (healthStatus.checks.database.status === "ok") {
      try {
        const [accountsResult, leadsResult, orgsResult, jobsResult] = await Promise.all([
          supabase.from("accounts").select("id", { count: "exact", head: true }),
          supabase.from("Leads").select("id", { count: "exact", head: true }),
          supabase.from("organizations").select("id", { count: "exact", head: true }),
          supabase.from("enrichment_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        ]);

        healthStatus.metrics = {
          total_accounts: accountsResult.count || 0,
          total_leads: leadsResult.count || 0,
          total_organizations: orgsResult.count || 0,
          active_enrichment_jobs: jobsResult.count || 0,
        };
      } catch (metricsError) {
        console.error("Failed to fetch metrics:", metricsError);
      }
    }

    // Determine overall status
    const allChecksOk = Object.values(healthStatus.checks).every(
      (check) => check.status === "ok"
    );
    
    if (!allChecksOk) {
      const anyCriticalFailure = 
        healthStatus.checks.database.status === "error";
      healthStatus.status = anyCriticalFailure ? "unhealthy" : "degraded";
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 
                       healthStatus.status === "degraded" ? 200 : 503;

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Health check failed:", error);
    
    healthStatus.status = "unhealthy";
    healthStatus.checks.database = { status: "error", error: error.message };
    
    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

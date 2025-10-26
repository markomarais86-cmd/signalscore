import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface CapitalMetrics {
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

export function useCapitalData() {
  const { userProfile } = useAuth();
  const [metrics, setMetrics] = useState<CapitalMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    loadCapitalMetrics();
  }, [userProfile?.org_id]);

  const loadCapitalMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: tracking, error: trackingError } = await supabase
        .from("capital_tracking")
        .select("*")
        .eq("org_id", userProfile!.org_id)
        .order("period_start", { ascending: false })
        .limit(1)
        .single();

      if (trackingError && trackingError.code !== "PGRST116") throw trackingError;

      if (tracking) {
        const totalInvestment = tracking.total_investment || 0;
        const pipelineValue = tracking.pipeline_value || 0;
        const revenueGenerated = tracking.revenue_generated || 0;

        setMetrics({
          totalInvestment,
          salesInvestment: tracking.sales_investment || 0,
          marketingInvestment: tracking.marketing_investment || 0,
          pipelineValue,
          revenueGenerated,
          pipelineMultiplier: totalInvestment > 0 ? pipelineValue / totalInvestment : 0,
          revenueMultiplier: totalInvestment > 0 ? revenueGenerated / totalInvestment : 0,
          cac: tracking.cac || 0,
          roas: tracking.roas || 0,
        });
      } else {
        // No data yet
        setMetrics({
          totalInvestment: 0,
          salesInvestment: 0,
          marketingInvestment: 0,
          pipelineValue: 0,
          revenueGenerated: 0,
          pipelineMultiplier: 0,
          revenueMultiplier: 0,
          cac: 0,
          roas: 0,
        });
      }
    } catch (err) {
      console.error("Error loading capital metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load capital data");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    metrics,
    isLoading,
    error,
    refresh: loadCapitalMetrics,
  };
}

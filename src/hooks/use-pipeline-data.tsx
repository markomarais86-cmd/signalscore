import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface PipelineStage {
  stage: string;
  count: number;
  conversionRate: number;
  avgDuration: number;
}

export interface PipelineMetrics {
  stages: PipelineStage[];
  totalLeads: number;
  overallConversion: number;
  avgCycleTime: number;
}

export function usePipelineData() {
  const { userProfile } = useAuth();
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    loadPipelineMetrics();
  }, [userProfile?.org_id]);

  const loadPipelineMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: stages, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("org_id", userProfile!.org_id)
        .order("entered_at", { ascending: false });

      if (stagesError) throw stagesError;

      // Calculate metrics
      const stageOrder = ["dial", "connect", "meeting", "opportunity", "closed_won"];
      const stageCounts: Record<string, number> = {};
      const stageDurations: Record<string, number[]> = {};

      stages?.forEach((s) => {
        stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
        if (s.duration_hours) {
          if (!stageDurations[s.stage]) stageDurations[s.stage] = [];
          stageDurations[s.stage].push(s.duration_hours);
        }
      });

      const stageMetrics: PipelineStage[] = stageOrder.map((stage, idx) => {
        const count = stageCounts[stage] || 0;
        const prevCount = idx > 0 ? (stageCounts[stageOrder[idx - 1]] || 0) : count;
        const conversionRate = prevCount > 0 ? (count / prevCount) * 100 : 0;
        const durations = stageDurations[stage] || [];
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        return {
          stage,
          count,
          conversionRate: idx === 0 ? 100 : conversionRate,
          avgDuration,
        };
      });

      const totalLeads = stageCounts["dial"] || 0;
      const closedWon = stageCounts["closed_won"] || 0;
      const overallConversion = totalLeads > 0 ? (closedWon / totalLeads) * 100 : 0;

      // Calculate avg cycle time
      const allDurations = Object.values(stageDurations).flat();
      const avgCycleTime = allDurations.length > 0
        ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
        : 0;

      setMetrics({
        stages: stageMetrics,
        totalLeads,
        overallConversion,
        avgCycleTime,
      });
    } catch (err) {
      console.error("Error loading pipeline metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load pipeline data");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    metrics,
    isLoading,
    error,
    refresh: loadPipelineMetrics,
  };
}

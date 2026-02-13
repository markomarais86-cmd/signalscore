import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveOrg } from "./use-effective-org";

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendMetrics {
  scoreHistory: TrendPoint[];
  fitScoreHistory: TrendPoint[];
  intentScoreHistory: TrendPoint[];
  reachabilityHistory: TrendPoint[];
  dataQualityHistory: TrendPoint[];
  icpMatchHistory: TrendPoint[];
  pipelineVelocity: TrendPoint[];
}

async function fetchTrendMetrics(orgId: string, days: number): Promise<TrendMetrics> {
  const { data, error } = await supabase.functions.invoke('trend-metrics', {
    body: { orgId, days },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  
  return data as TrendMetrics;
}

export function useTrendData(days: number = 90) {
  const { effectiveOrgId: orgId } = useEffectiveOrg();

  const query = useQuery({
    queryKey: ['trend-metrics', orgId, days],
    queryFn: () => fetchTrendMetrics(orgId!, days),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isPending: query.isPending,
    error: query.error?.message ?? null,
    refresh: query.refetch,
  };
}

import { useQuery } from "@tanstack/react-query";
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

async function fetchCapitalMetrics(orgId: string): Promise<CapitalMetrics> {
  const { data, error } = await supabase.functions.invoke('capital-metrics', {
    body: { orgId },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  
  return data as CapitalMetrics;
}

export function useCapitalData() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const query = useQuery({
    queryKey: ['capital-metrics', orgId],
    queryFn: () => fetchCapitalMetrics(orgId!),
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

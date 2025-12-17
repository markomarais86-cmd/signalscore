import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface CohortData {
  cohortMonth: string;
  accountCount: number;
  retentionRates: Record<string, number>;
  ltv: number;
  conversionRate: number;
}

export interface CohortMetrics {
  cohorts: CohortData[];
  avgLtv: number;
  avgRetention: number;
  topCohort: string;
}

async function fetchCohortMetrics(orgId: string): Promise<CohortMetrics> {
  const { data, error } = await supabase.functions.invoke('cohort-metrics', {
    body: { orgId },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  
  return data as CohortMetrics;
}

export function useCohortData() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const query = useQuery({
    queryKey: ['cohort-metrics', orgId],
    queryFn: () => fetchCohortMetrics(orgId!),
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

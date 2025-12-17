import { useQuery, QueryFunctionContext } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

/**
 * Shape of the pipeline stage returned by the backend.
 */
export interface PipelineStage {
  stage: string;
  count: number;
  conversionRate: number;
  avgDuration: number;
}

/**
 * Aggregated metrics describing the state of the sales funnel.
 * The server computes these metrics; the client simply consumes them.
 */
export interface PipelineMetrics {
  stages: PipelineStage[];
  totalLeads: number;
  overallConversion: number;
  avgCycleTime: number;
}

/**
 * Use this hook to load pipeline metrics for the current organisation.
 * Uses TanStack Query to cache responses and handle loading/error states.
 * The query invokes a Supabase Edge Function `pipeline-metrics` which
 * executes server-side aggregation to avoid shipping large tables to the browser.
 */
export function usePipelineData() {
  const { userProfile } = useAuth();
  
  // Build a stable query key based on the organisation ID
  const queryKey = useMemo(
    () => ['pipeline_metrics', userProfile?.org_id],
    [userProfile?.org_id]
  );

  const query = useQuery<PipelineMetrics, Error>({
    queryKey,
    // Only fetch when an orgId is present
    enabled: !!userProfile?.org_id,
    /**
     * Query function: call Supabase Edge Function `pipeline-metrics` with the
     * current organisation ID.
     */
    queryFn: async ({ queryKey }: QueryFunctionContext) => {
      const [, orgId] = queryKey as [string, string];
      if (!orgId) throw new Error('No organisation ID');
      
      const { data, error } = await supabase.functions.invoke('pipeline-metrics', {
        body: { orgId },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to load pipeline metrics');
      }
      
      return data as PipelineMetrics;
    },
    // Cache results for 5 minutes
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Return compatible API with legacy hook
  return {
    metrics: query.data ?? null,
    isLoading: query.isPending,
    isPending: query.isPending,
    error: query.error?.message ?? null,
    refresh: query.refetch,
    // Expose additional query properties for React 19 usage
    data: query.data,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface StageMetrics {
  stage: string;
  count: number;
  value: number;
  conversionRate: number;
  avgDurationHours: number;
  avgDurationDays: number;
}

export interface DealAtRisk {
  id: string;
  name: string;
  amount: number;
  stage: string;
  daysInStage: number;
  daysOverdue: number;
  expectedCloseDate: string | null;
  accountName: string | null;
}

export interface LossReasonBreakdown {
  reason: string;
  count: number;
  value: number;
  percentage: number;
}

export interface PipelineMetrics {
  totalPipelineValue: number;
  totalOpenDeals: number;
  avgDealSize: number;
  wonDealsCount: number;
  wonDealsValue: number;
  lostDealsCount: number;
  lostDealsValue: number;
  winRate: number;
  avgSalesCycleDays: number;
  salesVelocity: number;
  slippageRate: number;
  dealsAtRisk: DealAtRisk[];
  stages: StageMetrics[];
  lossReasons: LossReasonBreakdown[];
  pipelineGrowthRate: number;
  winRateChange: number;
  velocityChange: number;
  periodStart: string;
  periodEnd: string;
}

interface UsePipelineAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

export function usePipelineAnalytics(options: UsePipelineAnalyticsOptions = {}) {
  const { userProfile } = useAuth();
  const { startDate, endDate, enabled = true } = options;

  const orgId = userProfile?.org_id;

  const query = useQuery({
    queryKey: ['pipelineAnalytics', orgId, startDate, endDate],
    queryFn: async (): Promise<PipelineMetrics> => {
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase.functions.invoke('pipeline-metrics', {
        body: { orgId, startDate, endDate },
      });

      if (error) throw error;
      return data as PipelineMetrics;
    },
    enabled: enabled && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for fetching deals directly
export function useDeals(options: { status?: string; stage?: string; limit?: number } = {}) {
  const { userProfile } = useAuth();
  const { status, stage, limit = 100 } = options;

  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['deals', orgId, status, stage, limit],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from('deals')
        .select('*')
        .eq('org_id', orgId)
        .order('amount', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }
      if (stage) {
        query = query.eq('stage', stage);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

// Hook for fetching activities
export function useActivities(options: { dealId?: string; activityType?: string; limit?: number } = {}) {
  const { userProfile } = useAuth();
  const { dealId, activityType, limit = 50 } = options;

  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['activities', orgId, dealId, activityType, limit],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from('activities')
        .select('*')
        .eq('org_id', orgId)
        .order('activity_date', { ascending: false })
        .limit(limit);

      if (dealId) {
        query = query.eq('deal_id', dealId);
      }
      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

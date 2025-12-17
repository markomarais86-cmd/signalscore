import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

interface ConversionPrediction {
  account_id: string;
  probability: number;
  confidence: number;
  factors: PredictionFactor[];
  predicted_value?: number;
  predicted_days_to_close?: number;
}

interface PredictionResponse {
  success: boolean;
  prediction_type: string;
  predictions: ConversionPrediction[];
  metadata: {
    total_accounts: number;
    avg_probability: number;
    high_probability_count: number;
    baseline_deal_value: number;
    baseline_sales_cycle: number;
  };
}

interface UsePredictionsOptions {
  orgId: string | null;
  accountIds?: string[];
  predictionType?: 'conversion' | 'churn' | 'deal_size' | 'time_to_close';
  enabled?: boolean;
}

export function usePredictions({
  orgId,
  accountIds,
  predictionType = 'conversion',
  enabled = true,
}: UsePredictionsOptions) {
  return useQuery({
    queryKey: ['predictions', orgId, predictionType, accountIds?.join(',')],
    queryFn: async (): Promise<PredictionResponse> => {
      if (!orgId) {
        throw new Error('Organization ID is required');
      }

      const { data, error } = await supabase.functions.invoke('prediction-service', {
        body: {
          org_id: orgId,
          account_ids: accountIds,
          prediction_type: predictionType,
        },
      });

      if (error) {
        throw new Error(`Prediction service error: ${error.message}`);
      }

      return data as PredictionResponse;
    },
    enabled: enabled && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });
}

// Hook for getting prediction for a single account
export function useAccountPrediction(orgId: string | null, accountId: string | null) {
  const { data, isLoading, isPending, error } = usePredictions({
    orgId,
    accountIds: accountId ? [accountId] : undefined,
    enabled: !!orgId && !!accountId,
  });

  const prediction = data?.predictions?.[0] || null;

  return {
    prediction,
    isLoading,
    isPending,
    error,
  };
}

// Hook for batch predictions with refresh capability
export function useBatchPredictions(orgId: string | null) {
  const queryClient = useQueryClient();

  const predictionsQuery = usePredictions({
    orgId,
    enabled: !!orgId,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organization ID required');
      
      const { data, error } = await supabase.functions.invoke('prediction-service', {
        body: { org_id: orgId },
      });

      if (error) throw error;
      return data as PredictionResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['predictions', orgId, 'conversion', undefined], data);
    },
  });

  return {
    ...predictionsQuery,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}

// Utility function to get probability color
export function getProbabilityColor(probability: number): string {
  if (probability >= 0.7) return 'text-green-600';
  if (probability >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
}

// Utility function to get probability badge variant
export function getProbabilityBadgeVariant(probability: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (probability >= 0.7) return 'default';
  if (probability >= 0.4) return 'secondary';
  return 'destructive';
}

// Utility function to format probability as percentage
export function formatProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

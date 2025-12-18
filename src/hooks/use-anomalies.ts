import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export interface DetectedAnomaly {
  id: string;
  metric_name: string;
  metric_value: number;
  expected_value: number | null;
  deviation_percent: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string | null;
  ai_recommendation: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  rule_id: string | null;
}

export interface AnomalyRule {
  id: string;
  name: string;
  metric_name: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'deviation';
  severity: string;
  is_active: boolean;
  lookback_days: number;
  created_at: string;
}

interface UseAnomaliesOptions {
  acknowledged?: boolean;
  severity?: string;
  limit?: number;
  enabled?: boolean;
}

export function useAnomalies(options: UseAnomaliesOptions = {}) {
  const { userProfile } = useAuth();
  const { acknowledged, severity, limit = 50, enabled = true } = options;
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['anomalies', orgId, acknowledged, severity, limit],
    queryFn: async (): Promise<DetectedAnomaly[]> => {
      if (!orgId) return [];

      let query = supabase
        .from('detected_anomalies')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (acknowledged !== undefined) {
        query = query.eq('acknowledged', acknowledged);
      }
      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DetectedAnomaly[];
    },
    enabled: enabled && !!orgId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAnomalyRules() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['anomalyRules', orgId],
    queryFn: async (): Promise<AnomalyRule[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('anomaly_rules')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AnomalyRule[];
    },
    enabled: !!orgId,
  });
}

export function useAcknowledgeAnomaly() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (anomalyId: string) => {
      const { error } = await supabase
        .from('detected_anomalies')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userProfile?.user_id,
        })
        .eq('id', anomalyId)
        .eq('org_id', userProfile?.org_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      toast({
        title: 'Anomaly Acknowledged',
        description: 'The anomaly has been marked as reviewed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRunAnomalyDetection() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('detect-anomalies', {
        body: { orgId: userProfile?.org_id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      toast({
        title: 'Anomaly Detection Complete',
        description: `Found ${data?.anomaliesDetected || 0} anomalies.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

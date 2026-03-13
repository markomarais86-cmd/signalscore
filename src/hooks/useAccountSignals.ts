import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { toast } from "sonner";

export interface AccountSignal {
  id: string;
  org_id: string;
  account_external_id: string;
  account_name: string | null;
  signal_type: string;
  signal_priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string | null;
  dismissed_at: string | null;
  actioned_at: string | null;
}

export interface SignalSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byType: Record<string, number>;
}

export function useAccountSignals(options?: { 
  priority?: string; 
  type?: string; 
  limit?: number;
  includeDissmissed?: boolean;
}) {
  const { effectiveOrgId } = useEffectiveOrg();
  const queryClient = useQueryClient();

  const { data: signals, isLoading, error, refetch } = useQuery({
    queryKey: ['account-signals', effectiveOrgId, options],
    queryFn: async (): Promise<AccountSignal[]> => {
      if (!effectiveOrgId) return [];

      let query = supabase
        .from('account_signals')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false });

      if (!options?.includeDissmissed) {
        query = query.is('dismissed_at', null);
      }

      if (options?.priority) {
        query = query.eq('signal_priority', options.priority);
      }

      if (options?.type) {
        query = query.eq('signal_type', options.type);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AccountSignal[];
    },
    enabled: !!effectiveOrgId,
    staleTime: 30000, // 30 seconds
  });

  // Memoize summary calculation to prevent recalculation on every render
  const summary: SignalSummary = useMemo(() => ({
    total: signals?.length || 0,
    critical: signals?.filter(s => s.signal_priority === 'critical').length || 0,
    high: signals?.filter(s => s.signal_priority === 'high').length || 0,
    medium: signals?.filter(s => s.signal_priority === 'medium').length || 0,
    low: signals?.filter(s => s.signal_priority === 'low').length || 0,
    byType: signals?.reduce((acc, s) => {
      acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {},
  }), [signals]);

  const dismissSignal = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase
        .from('account_signals')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', signalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-signals'] });
      toast.success('Signal dismissed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss: ${error.message}`);
    },
  });

  const actionSignal = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase
        .from('account_signals')
        .update({ actioned_at: new Date().toISOString() })
        .eq('id', signalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-signals'] });
    },
  });

  const bulkActionSignals = useMutation({
    mutationFn: async (signalIds: string[]) => {
      const { error } = await supabase
        .from('account_signals')
        .update({ actioned_at: new Date().toISOString() })
        .in('id', signalIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-signals'] });
      toast.success('Signals marked as actioned');
    },
  });

  const detectSignals = useMutation({
    mutationFn: async () => {
      if (!effectiveOrgId) throw new Error('No org ID');
      
      const { data, error } = await supabase.functions.invoke('detect-account-signals', {
        body: { org_id: effectiveOrgId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['account-signals'] });
      toast.success(`Detected ${data.signals_created} signals`);
    },
    onError: (error: Error) => {
      toast.error(`Signal detection failed: ${error.message}`);
    },
  });

  return {
    signals: signals || [],
    summary,
    isLoading,
    error,
    refetch,
    dismissSignal: dismissSignal.mutate,
    actionSignal: actionSignal.mutate,
    bulkActionSignals: bulkActionSignals.mutateAsync,
    detectSignals: detectSignals.mutate,
    isDetecting: detectSignals.isPending,
  };
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IntentSignalType = 'engagement_velocity' | 'multi_thread' | 'score_change' | 'coverage_gap' | 'new_high_fit' | 'data_freshness';

export interface IntentSignal {
  id: string;
  org_id: string;
  account_external_id: string;
  account_name: string | null;
  signal_type: IntentSignalType;
  signal_priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  actioned_at: string | null;
  dismissed_at: string | null;
  expires_at: string | null;
}

interface IntentSignalsResult {
  signals: IntentSignal[];
  breakdown: {
    engagement_velocity: number;
    multi_thread: number;
    score_change: number;
    coverage_gap: number;
    new_high_fit: number;
    data_freshness: number;
  };
  isLoading: boolean;
  isComputing: boolean;
  error: Error | null;
  computeSignals: () => Promise<void>;
  dismissSignal: (signalId: string) => Promise<void>;
  actionSignal: (signalId: string) => Promise<void>;
}

export function useIntentSignals(orgId: string | undefined): IntentSignalsResult {
  const queryClient = useQueryClient();
  const [isComputing, setIsComputing] = useState(false);

  // Fetch existing intent signals
  const { data, isLoading, error } = useQuery({
    queryKey: ['intent-signals', orgId],
    queryFn: async () => {
      if (!orgId) return { signals: [], breakdown: { engagement_velocity: 0, multi_thread: 0, score_change: 0, coverage_gap: 0, new_high_fit: 0, data_freshness: 0 } };

      const { data: signals, error } = await supabase
        .from('account_signals')
        .select('*')
        .eq('org_id', orgId)
        .in('signal_type', ['engagement_velocity', 'multi_thread', 'score_change', 'coverage_gap', 'new_high_fit', 'data_freshness'])
        .is('dismissed_at', null)
        .is('actioned_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const breakdown = {
        engagement_velocity: 0,
        multi_thread: 0,
        score_change: 0,
        coverage_gap: 0,
        new_high_fit: 0,
        data_freshness: 0,
      };

      for (const signal of signals || []) {
        const type = signal.signal_type as IntentSignalType;
        if (type in breakdown) {
          breakdown[type]++;
        }
      }

      return {
        signals: (signals || []) as IntentSignal[],
        breakdown,
      };
    },
    enabled: !!orgId,
    staleTime: 60000, // 1 minute
  });

  // Compute new intent signals
  const computeSignals = async () => {
    if (!orgId) return;
    
    setIsComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-intent-signals', {
        body: { org_id: orgId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Computed ${data.signals_computed} intent signals`);
        queryClient.invalidateQueries({ queryKey: ['intent-signals', orgId] });
      }
    } catch (err) {
      console.error('[IntentSignals] Error computing signals:', err);
      toast.error('Failed to compute intent signals');
    } finally {
      setIsComputing(false);
    }
  };

  // Dismiss a signal
  const dismissSignal = async (signalId: string) => {
    const { error } = await supabase
      .from('account_signals')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', signalId);

    if (error) {
      toast.error('Failed to dismiss signal');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['intent-signals', orgId] });
  };

  // Mark a signal as actioned
  const actionSignal = async (signalId: string) => {
    const { error } = await supabase
      .from('account_signals')
      .update({ actioned_at: new Date().toISOString() })
      .eq('id', signalId);

    if (error) {
      toast.error('Failed to mark signal as actioned');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['intent-signals', orgId] });
    toast.success('Signal marked as actioned');
  };

  return {
    signals: data?.signals || [],
    breakdown: data?.breakdown || { engagement_velocity: 0, multi_thread: 0, score_change: 0, coverage_gap: 0 },
    isLoading,
    isComputing,
    error: error as Error | null,
    computeSignals,
    dismissSignal,
    actionSignal,
  };
}

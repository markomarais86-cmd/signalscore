import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { realtimeLogger as log } from '@/lib/logger';
import type { AccountChangePayload, ScoringJobPayload, EnrichmentJobPayload } from '@/types/realtime-payloads';

interface DataChangeListenerOptions {
  onAccountsChanged?: () => void;
  onScoringCompleted?: () => void;
  onEnrichmentCompleted?: () => void;
  debounceMs?: number;
}

/**
 * Hook that listens for significant data changes and triggers callbacks.
 * Uses Supabase realtime with automatic polling fallback on CHANNEL_ERROR.
 */
export function useDataChangeListener({
  onAccountsChanged,
  onScoringCompleted,
  onEnrichmentCompleted,
  debounceMs = 5000
}: DataChangeListenerOptions) {
  const { userProfile } = useAuth();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTriggerTimes = useRef<Record<string, number>>({});
  const pollingIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const realtimeFailed = useRef(false);
  
  const onAccountsChangedRef = useRef(onAccountsChanged);
  const onScoringCompletedRef = useRef(onScoringCompleted);
  const onEnrichmentCompletedRef = useRef(onEnrichmentCompleted);
  
  useEffect(() => { onAccountsChangedRef.current = onAccountsChanged; }, [onAccountsChanged]);
  useEffect(() => { onScoringCompletedRef.current = onScoringCompleted; }, [onScoringCompleted]);
  useEffect(() => { onEnrichmentCompletedRef.current = onEnrichmentCompleted; }, [onEnrichmentCompleted]);

  const debouncedCallback = useCallback((key: string, callbackRef: React.MutableRefObject<(() => void) | undefined>) => {
    const callback = callbackRef.current;
    if (!callback) return;

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    debounceTimers.current[key] = setTimeout(() => {
      callbackRef.current?.();
      lastTriggerTimes.current[key] = Date.now();
    }, debounceMs);
  }, [debounceMs]);

  // Polling fallback — checks for recent scoring/enrichment completions
  const startPollingFallback = useCallback((orgId: string) => {
    if (realtimeFailed.current) return; // already polling
    realtimeFailed.current = true;
    log.warn('Realtime failed, switching to polling fallback (60s interval)');

    const scoringPoll = setInterval(async () => {
      try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
        const { data } = await supabase
          .from('bulk_scoring_jobs')
          .select('id, status, completed_at')
          .eq('org_id', orgId)
          .eq('status', 'completed')
          .gte('completed_at', fiveMinAgo)
          .limit(1);
        if (data && data.length > 0) {
          debouncedCallback('scoring-completed', onScoringCompletedRef);
        }
      } catch { /* swallow */ }
    }, 60_000);

    const enrichmentPoll = setInterval(async () => {
      try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
        const { data } = await supabase
          .from('enrichment_jobs')
          .select('id, status, completed_at')
          .eq('org_id', orgId)
          .eq('status', 'completed')
          .gte('completed_at', fiveMinAgo)
          .limit(1);
        if (data && data.length > 0) {
          debouncedCallback('enrichment-completed', onEnrichmentCompletedRef);
        }
      } catch { /* swallow */ }
    }, 60_000);

    pollingIntervals.current.push(scoringPoll, enrichmentPoll);
  }, [debouncedCallback]);

  useEffect(() => {
    if (!userProfile?.org_id) return;
    const orgId = userProfile.org_id;

    log.info('Setting up realtime subscriptions for org:', orgId);
    let isMounted = true;

    const handleChannelError = (status: string) => {
      if (status === 'CHANNEL_ERROR' && isMounted) {
        startPollingFallback(orgId);
      }
    };

    // Single consolidated channel for all tables
    const channel = supabase
      .channel(`org-data-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (!isMounted) return;
          log.debug('Account change detected:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            debouncedCallback('accounts-insert', onAccountsChangedRef);
          } else if (payload.eventType === 'UPDATE') {
            const newRow = payload.new as AccountChangePayload;
            const oldRow = payload.old as Partial<AccountChangePayload>;
            if (newRow.propensity_score !== oldRow?.propensity_score) {
              debouncedCallback('accounts-score', onAccountsChangedRef);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bulk_scoring_jobs', filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (!isMounted) return;
          const newRow = payload.new as ScoringJobPayload;
          const oldRow = payload.old as Partial<ScoringJobPayload>;
          log.debug('Scoring job status change:', { oldStatus: oldRow?.status, newStatus: newRow.status });
          if (oldRow?.status !== 'completed' && newRow.status === 'completed') {
            log.info('Scoring job completed, triggering refresh');
            debouncedCallback('scoring-completed', onScoringCompletedRef);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'enrichment_jobs', filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (!isMounted) return;
          const newRow = payload.new as EnrichmentJobPayload;
          const oldRow = payload.old as Partial<EnrichmentJobPayload>;
          log.debug('Enrichment job status change:', { oldStatus: oldRow?.status, newStatus: newRow.status });
          if (oldRow?.status !== 'completed' && newRow.status === 'completed') {
            log.info('Enrichment job completed, triggering refresh');
            debouncedCallback('enrichment-completed', onEnrichmentCompletedRef);
          }
        }
      )
      .subscribe((status) => {
        log.debug('Data channel status:', status);
        handleChannelError(status);
      });

    return () => {
      log.debug('Cleaning up subscriptions');
      isMounted = false;
      supabase.removeChannel(channel);
      pollingIntervals.current.forEach(id => clearInterval(id));
      pollingIntervals.current = [];
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      debounceTimers.current = {};
    };
  }, [userProfile?.org_id, debouncedCallback, startPollingFallback]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      pollingIntervals.current.forEach(id => clearInterval(id));
    };
  }, []);
}

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
 * Hook that listens for significant data changes and triggers callbacks
 * Uses Supabase realtime to detect changes to accounts, scoring jobs, and enrichment
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
  
  const onAccountsChangedRef = useRef(onAccountsChanged);
  const onScoringCompletedRef = useRef(onScoringCompleted);
  const onEnrichmentCompletedRef = useRef(onEnrichmentCompleted);
  
  useEffect(() => {
    onAccountsChangedRef.current = onAccountsChanged;
  }, [onAccountsChanged]);
  
  useEffect(() => {
    onScoringCompletedRef.current = onScoringCompleted;
  }, [onScoringCompleted]);
  
  useEffect(() => {
    onEnrichmentCompletedRef.current = onEnrichmentCompleted;
  }, [onEnrichmentCompleted]);

  const debouncedCallback = useCallback((key: string, callbackRef: React.MutableRefObject<(() => void) | undefined>) => {
    const callback = callbackRef.current;
    if (!callback) return;

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    const now = Date.now();
    const lastTrigger = lastTriggerTimes.current[key] || 0;
    const timeSinceLastTrigger = now - lastTrigger;

    if (timeSinceLastTrigger < 30000) {
      debounceTimers.current[key] = setTimeout(() => {
        callbackRef.current?.();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    } else {
      debounceTimers.current[key] = setTimeout(() => {
        callbackRef.current?.();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    }
  }, [debounceMs]);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    log.info('Setting up realtime subscriptions for org:', userProfile.org_id);

    let isMounted = true;

    // Listen for account changes (inserts/updates)
    const accountsChannel = supabase
      .channel('accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `org_id=eq.${userProfile.org_id}`
        },
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
      .subscribe((status) => {
        log.debug('Accounts channel status:', status);
      });

    // Listen for bulk scoring job completions
    const scoringChannel = supabase
      .channel('scoring-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bulk_scoring_jobs',
          filter: `org_id=eq.${userProfile.org_id}`
        },
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
      .subscribe((status) => {
        log.debug('Scoring jobs channel status:', status);
      });

    // Listen for enrichment job completions
    const enrichmentChannel = supabase
      .channel('enrichment-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `org_id=eq.${userProfile.org_id}`
        },
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
        log.debug('Enrichment jobs channel status:', status);
      });

    return () => {
      log.debug('Cleaning up subscriptions');
      isMounted = false;
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(scoringChannel);
      supabase.removeChannel(enrichmentChannel);
      
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      debounceTimers.current = {};
    };
  }, [userProfile?.org_id, debouncedCallback]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);
}

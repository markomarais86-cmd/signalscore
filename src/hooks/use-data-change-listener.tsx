import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { realtimeLogger as log } from '@/lib/logger';

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
  
  // Use refs for callbacks to avoid re-subscriptions when callbacks change
  const onAccountsChangedRef = useRef(onAccountsChanged);
  const onScoringCompletedRef = useRef(onScoringCompleted);
  const onEnrichmentCompletedRef = useRef(onEnrichmentCompleted);
  
  // Keep refs in sync
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

    // Clear existing timer
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Check if we've triggered recently (within last 30 seconds)
    const now = Date.now();
    const lastTrigger = lastTriggerTimes.current[key] || 0;
    const timeSinceLastTrigger = now - lastTrigger;

    if (timeSinceLastTrigger < 30000) {
      // Too soon, just debounce
      debounceTimers.current[key] = setTimeout(() => {
        callbackRef.current?.();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    } else {
      // It's been a while, trigger immediately but still debounce future calls
      debounceTimers.current[key] = setTimeout(() => {
        callbackRef.current?.();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    }
  }, [debounceMs]);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    log.info('Setting up realtime subscriptions for org:', userProfile.org_id);

    // Track mounted state to prevent state updates after unmount
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
          } else if (payload.eventType === 'UPDATE' && (payload.new as any).propensity_score !== (payload.old as any)?.propensity_score) {
            // Score was updated
            debouncedCallback('accounts-score', onAccountsChangedRef);
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
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;
          
          log.debug('Scoring job status change:', { oldStatus, newStatus });
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
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
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;
          
          log.debug('Enrichment job status change:', { oldStatus, newStatus });
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
            log.info('Enrichment job completed, triggering refresh');
            debouncedCallback('enrichment-completed', onEnrichmentCompletedRef);
          }
        }
      )
      .subscribe((status) => {
        log.debug('Enrichment jobs channel status:', status);
      });

    // Cleanup
    return () => {
      log.debug('Cleaning up subscriptions');
      isMounted = false;
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(scoringChannel);
      supabase.removeChannel(enrichmentChannel);
      
      // Clear all debounce timers
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      debounceTimers.current = {};
    };
  }, [userProfile?.org_id, debouncedCallback]); // Removed callback dependencies

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);
}

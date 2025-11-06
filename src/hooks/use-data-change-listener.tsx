import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

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
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const lastTriggerTimes = useRef<Record<string, number>>({});

  const debouncedCallback = useCallback((key: string, callback?: () => void) => {
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
        callback();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    } else {
      // It's been a while, trigger immediately but still debounce future calls
      debounceTimers.current[key] = setTimeout(() => {
        callback();
        lastTriggerTimes.current[key] = Date.now();
      }, debounceMs);
    }
  }, [debounceMs]);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    console.log('[DataChangeListener] Setting up realtime subscriptions for org:', userProfile.org_id);

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
          console.log('[DataChangeListener] Account change detected:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            debouncedCallback('accounts-insert', onAccountsChanged);
          } else if (payload.eventType === 'UPDATE' && (payload.new as any).propensity_score !== (payload.old as any)?.propensity_score) {
            // Score was updated
            debouncedCallback('accounts-score', onAccountsChanged);
          }
        }
      )
      .subscribe((status) => {
        console.log('[DataChangeListener] Accounts channel status:', status);
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
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;
          
          console.log('[DataChangeListener] Scoring job status change:', { oldStatus, newStatus });
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
            console.log('[DataChangeListener] Scoring job completed, triggering refresh');
            debouncedCallback('scoring-completed', onScoringCompleted);
          }
        }
      )
      .subscribe((status) => {
        console.log('[DataChangeListener] Scoring jobs channel status:', status);
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
          const newStatus = (payload.new as any).status;
          const oldStatus = (payload.old as any)?.status;
          
          console.log('[DataChangeListener] Enrichment job status change:', { oldStatus, newStatus });
          
          if (oldStatus !== 'completed' && newStatus === 'completed') {
            console.log('[DataChangeListener] Enrichment job completed, triggering refresh');
            debouncedCallback('enrichment-completed', onEnrichmentCompleted);
          }
        }
      )
      .subscribe((status) => {
        console.log('[DataChangeListener] Enrichment jobs channel status:', status);
      });

    // Cleanup
    return () => {
      console.log('[DataChangeListener] Cleaning up subscriptions');
      supabase.removeChannel(accountsChannel);
      supabase.removeChannel(scoringChannel);
      supabase.removeChannel(enrichmentChannel);
      
      // Clear all debounce timers
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
      debounceTimers.current = {};
    };
  }, [userProfile?.org_id, debouncedCallback, onAccountsChanged, onScoringCompleted, onEnrichmentCompleted]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);
}

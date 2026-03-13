import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from './use-effective-org';
import { realtimeLogger as log } from '@/lib/logger';

/**
 * Listens for high-priority signals, agent completions, and campaign results,
 * then dispatches matching alerts via the send-alert edge function.
 */
export function useNotificationDispatcher() {
  const { effectiveOrgId } = useEffectiveOrg();
  const recentlyFired = useRef<Set<string>>(new Set());

  const fireMatchingAlerts = useCallback(async (
    orgId: string,
    alertType: string,
    message: string,
    triggerValue: number,
    contextData?: Record<string, any>
  ) => {
    const dedupeKey = `${alertType}-${Date.now().toString().slice(0, -4)}`; // ~10s window
    if (recentlyFired.current.has(dedupeKey)) return;
    recentlyFired.current.add(dedupeKey);
    setTimeout(() => recentlyFired.current.delete(dedupeKey), 30000);

    try {
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id, name, threshold_value')
        .eq('org_id', orgId)
        .eq('alert_type', alertType)
        .eq('is_active', true);

      if (!alerts?.length) return;

      for (const alert of alerts) {
        await supabase.functions.invoke('send-alert', {
          body: {
            alertId: alert.id,
            orgId,
            payload: {
              alertId: alert.id,
              alertType,
              alertName: alert.name,
              triggerValue,
              thresholdValue: alert.threshold_value ?? 0,
              message,
              contextData,
            },
          },
        });
      }
      log.info(`[dispatcher] Fired ${alerts.length} alert(s) for ${alertType}`);
    } catch (err) {
      log.error('[dispatcher] Error firing alerts:', err);
    }
  }, []);

  useEffect(() => {
    const orgId = effectiveOrgId;
    if (!orgId) return;

    let mounted = true;

    // 1. High-priority signal inserts
    const signalsCh = supabase
      .channel('dispatcher-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'account_signals', filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (!mounted) return;
          const sig = payload.new as any;
          if (sig.signal_priority === 'high' || sig.signal_priority === 'critical') {
            fireMatchingAlerts(
              orgId,
              'high_priority_signal',
              `🔔 ${sig.title} — ${sig.account_name || sig.account_external_id}`,
              1,
              { signal_type: sig.signal_type, account: sig.account_name, priority: sig.signal_priority }
            );
          }
        }
      )
      .subscribe();

    // 2. Agent run completions
    const agentRunsCh = supabase
      .channel('dispatcher-agent-runs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_agent_runs' },
        (payload) => {
          if (!mounted) return;
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (oldRow?.status !== 'completed' && newRow.status === 'completed') {
            fireMatchingAlerts(
              orgId,
              'agent_completed',
              `✅ Agent run completed — ${newRow.records_processed ?? 0} records processed`,
              newRow.records_processed ?? 0,
              { agent_id: newRow.agent_id, run_id: newRow.id, records_affected: newRow.records_affected }
            );
          }
        }
      )
      .subscribe();

    // 3. Campaign status changes
    const campaignsCh = supabase
      .channel('dispatcher-campaigns')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `org_id=eq.${orgId}` },
        (payload) => {
          if (!mounted) return;
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (oldRow?.status !== newRow.status && (newRow.status === 'completed' || newRow.status === 'sent')) {
            fireMatchingAlerts(
              orgId,
              'campaign_completed',
              `📣 Campaign "${newRow.name}" is now ${newRow.status} — ${newRow.total_contacts ?? 0} contacts`,
              newRow.total_contacts ?? 0,
              { campaign_id: newRow.id, campaign_name: newRow.name, status: newRow.status }
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(signalsCh);
      supabase.removeChannel(agentRunsCh);
      supabase.removeChannel(campaignsCh);
    };
  }, [effectiveOrgId, fireMatchingAlerts]);
}

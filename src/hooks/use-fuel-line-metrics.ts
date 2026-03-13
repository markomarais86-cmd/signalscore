import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface FuelLineMetric {
  fuel_line_type: string;
  campaign_count: number;
  total_accounts: number;
  total_contacts: number;
  from_signals: number;
}

export function useFuelLineMetrics() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['fuel-line-metrics', orgId],
    queryFn: async (): Promise<FuelLineMetric[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('fuel_line_type, total_accounts, total_contacts, signal_source_ids, metadata')
        .eq('org_id', orgId)
        .not('fuel_line_type', 'is', null);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const grouped = new Map<string, FuelLineMetric>();

      for (const row of data) {
        const type = row.fuel_line_type || 'unknown';
        const existing = grouped.get(type) || {
          fuel_line_type: type,
          campaign_count: 0,
          total_accounts: 0,
          total_contacts: 0,
          from_signals: 0,
        };
        existing.campaign_count += 1;
        existing.total_accounts += row.total_accounts || 0;
        existing.total_contacts += row.total_contacts || 0;
        if (row.signal_source_ids && row.signal_source_ids.length > 0) {
          existing.from_signals += 1;
        }
        grouped.set(type, existing);
      }

      return Array.from(grouped.values()).sort((a, b) => b.campaign_count - a.campaign_count);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

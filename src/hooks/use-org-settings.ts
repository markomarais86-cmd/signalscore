import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { toast } from 'sonner';

export interface OrgSettings {
  average_deal_size: number;
  conversion_rate: number;
}

const DEFAULTS: OrgSettings = {
  average_deal_size: 75000,
  conversion_rate: 0.15,
};

export function useOrgSettings() {
  const { effectiveOrgId } = useEffectiveOrg();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['org-settings', effectiveOrgId],
    queryFn: async (): Promise<OrgSettings> => {
      if (!effectiveOrgId) return DEFAULTS;

      const { data, error } = await supabase
        .from('organizations')
        .select('org_settings')
        .eq('id', effectiveOrgId)
        .single();

      if (error || !data?.org_settings) return DEFAULTS;

      const raw = data.org_settings as Record<string, unknown>;
      return {
        average_deal_size: Number(raw.average_deal_size) || DEFAULTS.average_deal_size,
        conversion_rate: Number(raw.conversion_rate) || DEFAULTS.conversion_rate,
      };
    },
    enabled: !!effectiveOrgId,
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<OrgSettings>) => {
      if (!effectiveOrgId) throw new Error('No org');

      const current = settings || DEFAULTS;
      const merged = { ...current, ...updates };

      // org_settings is a JSONB column not in generated Update type; bypass via spread
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateValue = { org_settings: merged } as any;
      const { error } = await supabase
        .from('organizations')
        .update(updateValue)
        .eq('id', effectiveOrgId);

      if (error) throw error;
      return merged;
    },
    onSuccess: (merged) => {
      queryClient.setQueryData(['org-settings', effectiveOrgId], merged);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  return {
    averageDealSize: settings?.average_deal_size ?? DEFAULTS.average_deal_size,
    conversionRate: settings?.conversion_rate ?? DEFAULTS.conversion_rate,
    isLoading,
    updateSettings: mutation.mutate,
    isSaving: mutation.isPending,
  };
}

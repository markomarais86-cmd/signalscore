import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from './use-effective-org';
import { useAuth } from './use-auth';

export interface SuppressionRule {
  id: string;
  org_id: string;
  suppression_type: string;
  domain: string | null;
  email: string | null;
  reason: string;
  created_at: string | null;
  created_by: string | null;
}

export function useSuppressionRules() {
  const { effectiveOrgId } = useEffectiveOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['suppression-rules', effectiveOrgId];

  const { data: rules = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from('suppression_rules')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SuppressionRule[];
    },
    enabled: !!effectiveOrgId,
    staleTime: 60_000,
  });

  const addRules = useMutation({
    mutationFn: async (entries: { type: 'domain' | 'email'; value: string; reason?: string }[]) => {
      if (!effectiveOrgId) throw new Error('No org');
      const rows = entries.map(e => ({
        org_id: effectiveOrgId,
        suppression_type: e.type,
        domain: e.type === 'domain' ? e.value.toLowerCase() : null,
        email: e.type === 'email' ? e.value.toLowerCase() : null,
        reason: e.reason || 'Manual exclusion',
        created_by: user?.id || null,
      }));
      const { error } = await supabase.from('suppression_rules').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from('suppression_rules').delete().eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const suppressedDomains = new Set(
    rules.filter(r => r.suppression_type === 'domain' && r.domain).map(r => r.domain!.toLowerCase())
  );
  const suppressedEmails = new Set(
    rules.filter(r => r.suppression_type === 'email' && r.email).map(r => r.email!.toLowerCase())
  );

  const isSuppressed = (domain?: string | null, email?: string | null): boolean => {
    if (domain && suppressedDomains.has(domain.toLowerCase())) return true;
    if (email && suppressedEmails.has(email.toLowerCase())) return true;
    return false;
  };

  return {
    rules,
    isLoading,
    addRules,
    removeRule,
    suppressedDomains,
    suppressedEmails,
    isSuppressed,
    totalCount: rules.length,
  };
}

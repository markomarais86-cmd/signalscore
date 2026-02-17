import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from '@/hooks/use-effective-org';

/**
 * Resolves the "data org" for account/lead queries.
 * 
 * Child orgs (consulting model) have a `parent_org_id` pointing to the
 * parent org that owns the shared dataset. This hook returns that parent
 * org ID for data queries, falling back to the effective org ID when
 * no parent exists (self-service / standalone orgs).
 * 
 * Usage:
 * - Use `dataOrgId` when querying accounts, leads, or any shared data
 * - Use `effectiveOrgId` (from useEffectiveOrg) for ICPs, scores, settings
 */
export function useDataOrgId() {
  const { effectiveOrgId, isImpersonating } = useEffectiveOrg();

  const { data: dataOrgId, isLoading } = useQuery({
    queryKey: ['data-org-id', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('parent_org_id')
        .eq('id', effectiveOrgId)
        .single();

      if (error || !data) return effectiveOrgId;
      return (data as any).parent_org_id || effectiveOrgId;
    },
    enabled: !!effectiveOrgId,
    staleTime: 30 * 60 * 1000, // 30 min — rarely changes
    gcTime: 60 * 60 * 1000,
  });

  return {
    /** The org ID to use for account/lead data queries */
    dataOrgId: dataOrgId ?? effectiveOrgId,
    /** The org ID for ICP/scores/settings (the child org itself) */
    effectiveOrgId,
    /** Whether the data comes from a parent org */
    isChildOrg: !!dataOrgId && dataOrgId !== effectiveOrgId,
    isImpersonating,
    isLoading,
  };
}

import { useOrgSwitcher } from '@/contexts/OrgSwitcherContext';

/**
 * Returns the effective org ID for data fetching.
 * For super admins, this reflects the currently selected org.
 * For regular users, this is always their own org_id.
 */
export function useEffectiveOrg() {
  const { effectiveOrgId, isImpersonating } = useOrgSwitcher();
  return { effectiveOrgId, isImpersonating };
}

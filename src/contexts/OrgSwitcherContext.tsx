import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useRoles } from '@/hooks/use-roles';

interface Organization {
  id: string;
  name: string;
  status: string | null;
}

interface OrgSwitcherContextType {
  effectiveOrgId: string | null;
  selectedOrg: Organization | null;
  organizations: Organization[];
  isImpersonating: boolean;
  isLoadingOrgs: boolean;
  setSelectedOrgId: (orgId: string) => void;
  resetToOwnOrg: () => void;
  refreshOrgs: () => Promise<void>;
}

const OrgSwitcherContext = createContext<OrgSwitcherContextType | undefined>(undefined);

const SESSION_KEY = 'org_switcher_selected_id';

export function OrgSwitcherProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const ownOrgId = userProfile?.org_id ?? null;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_KEY);
    }
    return null;
  });

  const fetchOrgs = useCallback(async () => {
    setIsLoadingOrgs(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, status')
      .order('name');

    if (!error && data) {
      setOrganizations(data as Organization[]);
    }
    setIsLoadingOrgs(false);
  }, []);

  // Fetch all orgs for super admins
  useEffect(() => {
    if (rolesLoading || !isSuperAdmin || !ownOrgId) return;
    fetchOrgs();
  }, [isSuperAdmin, rolesLoading, ownOrgId, fetchOrgs]);

  const setSelectedOrgId = useCallback((orgId: string) => {
    setSelectedOrgIdState(orgId);
    sessionStorage.setItem(SESSION_KEY, orgId);
  }, []);

  const resetToOwnOrg = useCallback(() => {
    setSelectedOrgIdState(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  // Determine effective org ID
  const effectiveOrgId = isSuperAdmin && selectedOrgId ? selectedOrgId : ownOrgId;
  const isImpersonating = isSuperAdmin && !!selectedOrgId && selectedOrgId !== ownOrgId;
  const selectedOrg = organizations.find(o => o.id === effectiveOrgId) ?? null;

  return (
    <OrgSwitcherContext.Provider value={{
      effectiveOrgId,
      selectedOrg,
      organizations,
      isImpersonating,
      isLoadingOrgs,
      setSelectedOrgId,
      resetToOwnOrg,
      refreshOrgs: fetchOrgs,
    }}>
      {children}
    </OrgSwitcherContext.Provider>
  );
}

export function useOrgSwitcher() {
  const context = useContext(OrgSwitcherContext);
  if (!context) {
    throw new Error('useOrgSwitcher must be used within OrgSwitcherProvider');
  }
  return context;
}

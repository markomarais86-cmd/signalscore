// Hook for managing external data sources and coverage calculations

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { calculateCoverage, DataSourceStats } from '@/utils/data-source-attribution';

export function useDataSources() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DataSourceStats>({
    crmAccounts: 0,
    databaseAccounts: 0,
    whitespaceAccounts: 0,
    coveragePercentage: 0,
    crmContacts: 0,
    databaseContacts: 0,
    whitespaceContacts: 0,
    contactCoveragePercentage: 0,
  });
  const { userProfile } = useAuth();

  useEffect(() => {
    loadDataSourceStats();
  }, [userProfile.org_id]);

  const loadDataSourceStats = async () => {
    if (!userProfile.org_id) return;

    try {
      // Get CRM account count
      const { count: crmAccountCount, error: crmAccountError } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'crm');

      if (crmAccountError) throw crmAccountError;

      // Get CRM lead count
      const { count: crmContactCount, error: crmContactError } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'crm');

      if (crmContactError) throw crmContactError;

      // Get external database totals from provider connections
      const { data: providers, error: providerError } = await supabase
        .from('external_data_sources')
        .select('total_accounts, total_contacts')
        .eq('org_id', userProfile.org_id)
        .eq('is_active', true);

      if (providerError) throw providerError;

      const databaseAccountTotal = providers?.reduce((sum, p) => sum + (p.total_accounts || 0), 0) || 0;
      const databaseContactTotal = providers?.reduce((sum, p) => sum + (p.total_contacts || 0), 0) || 0;

      const calculatedStats = calculateCoverage(
        crmAccountCount || 0,
        databaseAccountTotal,
        crmContactCount || 0,
        databaseContactTotal
      );

      setStats(calculatedStats);
    } catch (error) {
      console.error('Error loading data source stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    reload: loadDataSourceStats,
  };
}

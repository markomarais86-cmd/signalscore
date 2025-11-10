import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardMetrics {
  total_accounts: number;
  total_scores: number;
  total_leads: number;
  crm_accounts: number;
  database_accounts: number;
  both_accounts: number;
  linked_leads: number;
  high_fit_scores: number;
  med_fit_scores: number;
  low_fit_scores: number;
  high_fit_crm_accounts: number;
  high_fit_database_accounts: number;
  crm_leads: number;
  database_leads: number;
  high_fit_leads_total: number;
  high_fit_crm_leads: number;
  high_fit_database_leads: number;
  campaign_ready_accounts: number;
  campaign_ready_contacts: number;
  campaign_ready_leads: number;
  data_completeness: number;
}

interface ExternalTAMData {
  totalAccounts: number;
  totalContacts: number;
  provider: string;
  lastSyncedAt: string | null;
}

interface DashboardData {
  metrics: DashboardMetrics;
  icpProfiles: any[];
  tamData: ExternalTAMData | null;
}

export function useDashboardData(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-metrics', orgId],
    queryFn: async (): Promise<DashboardData> => {
      if (!orgId) throw new Error('No org ID provided');
      
      // Parallel fetch: metrics + ICP profiles + TAM data (3 queries instead of 22+)
      const [metricsResult, icpResult, tamResult] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_fast' as any, { p_org_id: orgId }),
        supabase
          .from('icp_profiles')
          .select('*')
          .eq('org_id', orgId)
          .eq('status', 'active'),
        supabase
          .from('external_data_sources')
          .select('provider, total_accounts, total_contacts, last_synced_at')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('last_synced_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);
      
      if (metricsResult.error) {
        console.error('[useDashboardData] ❌ Metrics fetch error:', metricsResult.error);
        throw metricsResult.error;
      }
      
      if (icpResult.error) {
        console.error('[useDashboardData] ❌ ICP fetch error:', icpResult.error);
        throw icpResult.error;
      }

      // TAM data is optional, don't throw if missing
      if (tamResult.error) {
        console.warn('[useDashboardData] ⚠️ TAM fetch error:', tamResult.error);
      }
      
      // Map the function response to expected structure
      const rawMetrics = metricsResult.data as any;
      
      const mappedMetrics: DashboardMetrics = {
        total_accounts: rawMetrics?.totalAccounts || 0,
        total_scores: rawMetrics?.scoredAccounts || 0,
        total_leads: rawMetrics?.totalLeads || 0,
        crm_accounts: rawMetrics?.crmAccounts || 0,
        database_accounts: rawMetrics?.databaseAccounts || 0,
        both_accounts: rawMetrics?.bothAccounts || 0,
        linked_leads: rawMetrics?.linkedLeads || 0,
        high_fit_scores: rawMetrics?.highFitAccounts || 0,
        med_fit_scores: rawMetrics?.mediumFitAccounts || 0,
        low_fit_scores: rawMetrics?.lowFitAccounts || 0,
        high_fit_crm_accounts: rawMetrics?.highFitCrmAccounts || 0,
        high_fit_database_accounts: rawMetrics?.highFitDatabaseAccounts || 0,
        crm_leads: rawMetrics?.crmLeads || 0,
        database_leads: rawMetrics?.databaseLeads || 0,
        high_fit_leads_total: rawMetrics?.highFitLeadsTotal || 0,
        high_fit_crm_leads: rawMetrics?.highFitCrmLeads || 0,
        high_fit_database_leads: rawMetrics?.highFitDatabaseLeads || 0,
        campaign_ready_accounts: rawMetrics?.campaignReadyAccounts || 0,
        campaign_ready_contacts: rawMetrics?.campaignReadyLeads || 0, // Now from Leads table
        campaign_ready_leads: rawMetrics?.campaignReadyLeads || 0,
        data_completeness: rawMetrics?.dataCompleteness || 0,
      };
      
      // Map TAM data
      const tamData: ExternalTAMData | null = tamResult.data ? {
        totalAccounts: Number(tamResult.data.total_accounts) || 0,
        totalContacts: Number(tamResult.data.total_contacts) || 0,
        provider: tamResult.data.provider || 'Unknown',
        lastSyncedAt: tamResult.data.last_synced_at
      } : null;

      return {
        metrics: mappedMetrics,
        icpProfiles: icpResult.data || [],
        tamData
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Hook for geography data (lazy loaded)
export function useGeographyData(orgId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['geography-distribution', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_geography_distribution', {
        p_org_id: orgId
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000,
  });
}

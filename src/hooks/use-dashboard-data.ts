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
  campaign_ready_leads: number;
  data_completeness: number;
}

interface DashboardData {
  metrics: DashboardMetrics;
  icpProfiles: any[];
}

export function useDashboardData(orgId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-metrics', orgId],
    queryFn: async (): Promise<DashboardData> => {
      if (!orgId) throw new Error('No org ID provided');
      
      // Parallel fetch: metrics + ICP profiles (only 2 queries instead of 22+)
      const [metricsResult, icpResult] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_fast' as any, { p_org_id: orgId }),
        supabase
          .from('icp_profiles')
          .select('*')
          .eq('org_id', orgId)
          .eq('status', 'active')
      ]);
      
      if (metricsResult.error) {
        console.error('Metrics fetch error:', metricsResult.error);
        throw metricsResult.error;
      }
      
      if (icpResult.error) {
        console.error('ICP fetch error:', icpResult.error);
        throw icpResult.error;
      }
      
      return {
        metrics: metricsResult.data as unknown as DashboardMetrics,
        icpProfiles: icpResult.data || []
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

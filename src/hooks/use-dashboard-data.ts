import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const dashboardLogger = logger.scope('Dashboard');

async function computeDataCompleteness(dataOrgId: string, childOrgId?: string): Promise<number> {
  const isChildOrg = childOrgId && childOrgId !== dataOrgId;

  try {
    const { data, error } = await supabase.rpc('get_data_completeness' as any, {
      p_data_org_id: dataOrgId,
      p_child_org_id: isChildOrg ? childOrgId : null,
    });

    if (error) {
      dashboardLogger.error('Data completeness RPC error:', error);
      return 0;
    }

    return (data as any)?.completeness || 0;
  } catch (err) {
    dashboardLogger.error('Data completeness error:', err);
    return 0;
  }
}

interface DashboardMetrics {
  total_accounts: number;
  scored_accounts: number;
  total_leads: number;
  total_crm_accounts: number;
  total_database_accounts: number;
  scored_crm_accounts: number;
  scored_database_accounts: number;
  both_accounts: number;
  linked_leads: number;
  high_fit_accounts: number;
  medium_fit_accounts: number;
  low_fit_accounts: number;
  high_fit_crm_accounts: number;
  high_fit_database_accounts: number;
  medium_fit_crm_accounts: number;
  medium_fit_database_accounts: number;
  low_fit_crm_accounts: number;
  low_fit_database_accounts: number;
  total_crm_leads: number;
  total_database_leads: number;
  high_fit_leads: number;
  medium_fit_leads: number;
  low_fit_leads: number;
  high_fit_crm_leads: number;
  high_fit_database_leads: number;
  medium_fit_crm_leads: number;
  medium_fit_database_leads: number;
  low_fit_crm_leads: number;
  low_fit_database_leads: number;
  campaign_ready_accounts: number;
  campaign_ready_contacts: number;
  campaign_ready_leads: number;
  data_completeness: number;
}

interface ExternalTAMData {
  totalAccounts: number;
  totalLeads: number;
  provider: string;
  lastSyncedAt: string | null;
  geography_breakdown?: any;
  industry_breakdown?: any;
  company_size_breakdown?: any;
  revenue_breakdown?: any;
  technology_breakdown?: any;
  funding_breakdown?: any;
}

interface DashboardData {
  metrics: DashboardMetrics;
  icpProfiles: any[];
  tamData: ExternalTAMData | null;
}

export function useDashboardData(orgId: string | undefined, sourceFilter: 'crm' | 'database' = 'crm', dataOrgId?: string) {
  // For data completeness, use the data org (parent) since accounts live there
  const resolvedDataOrgId = dataOrgId || orgId;
  return useQuery({
    queryKey: ['dashboard-metrics', orgId, sourceFilter, resolvedDataOrgId],
    queryFn: async (): Promise<DashboardData> => {
      if (!orgId) throw new Error('No org ID provided');
      
      // Parallel fetch: ICP profiles + TAM data first (fast queries)
      const [icpResult, tamResult, dataCompleteness] = await Promise.all([
        supabase
          .from('icp_profiles')
          .select('*')
          .eq('org_id', orgId)
          .eq('status', 'active'),
        supabase
          .from('external_data_sources')
          .select(`
            provider, 
            total_accounts, 
            total_contacts, 
            last_synced_at,
            geography_breakdown,
            industry_breakdown,
            company_size_breakdown,
            revenue_breakdown,
            technology_breakdown,
            funding_breakdown
          `)
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('last_synced_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        computeDataCompleteness(resolvedDataOrgId!, orgId)
      ]);
      
      if (icpResult.error) {
        dashboardLogger.error('ICP fetch error:', icpResult.error);
        throw icpResult.error;
      }

      // TAM data is optional, don't throw if missing
      if (tamResult.error) {
        dashboardLogger.warn('TAM fetch error:', tamResult.error);
      }
      
      // Fetch metrics from cached materialized view (much faster)
      let metricsResult;
      try {
        metricsResult = await supabase.rpc('get_dashboard_metrics_cached' as any, { 
          p_org_id: orgId
        });
      } catch (err) {
        dashboardLogger.error('Metrics RPC timeout/error:', err);
        // Return empty metrics on timeout, don't block the whole page
        metricsResult = { data: null, error: err };
      }
      
      if (metricsResult.error) {
        dashboardLogger.error('Metrics fetch error:', metricsResult.error);
        // Don't throw - return default metrics so page loads
      }

      // TAM data is optional, don't throw if missing
      if (tamResult.error) {
        dashboardLogger.warn('TAM fetch error:', tamResult.error);
      }
      
      // Map the function response to expected structure (handles both array and direct object returns)
      const rawMetrics = Array.isArray(metricsResult.data) 
        ? (metricsResult.data as any)?.[0] 
        : (metricsResult.data as any);
      
      const mappedMetrics: DashboardMetrics = {
        total_accounts: rawMetrics?.total_accounts || 0,
        scored_accounts: rawMetrics?.scored_accounts || 0,
        total_leads: rawMetrics?.total_leads || 0,
        total_crm_accounts: rawMetrics?.total_crm_accounts || 0,
        total_database_accounts: rawMetrics?.total_database_accounts || 0,
        scored_crm_accounts: rawMetrics?.scored_crm_accounts || 0,
        scored_database_accounts: rawMetrics?.scored_database_accounts || 0,
        both_accounts: rawMetrics?.both_accounts || 0,
        linked_leads: rawMetrics?.linked_leads || 0,
        high_fit_accounts: rawMetrics?.high_fit_accounts || 0,
        medium_fit_accounts: rawMetrics?.medium_fit_accounts || 0,
        low_fit_accounts: rawMetrics?.low_fit_accounts || 0,
        high_fit_crm_accounts: rawMetrics?.high_fit_crm_accounts || 0,
        high_fit_database_accounts: rawMetrics?.high_fit_database_accounts || 0,
        medium_fit_crm_accounts: rawMetrics?.medium_fit_crm_accounts || 0,
        medium_fit_database_accounts: rawMetrics?.medium_fit_database_accounts || 0,
        low_fit_crm_accounts: rawMetrics?.low_fit_crm_accounts || 0,
        low_fit_database_accounts: rawMetrics?.low_fit_database_accounts || 0,
        total_crm_leads: rawMetrics?.total_crm_leads || 0,
        total_database_leads: rawMetrics?.total_database_leads || 0,
        high_fit_leads: rawMetrics?.high_fit_leads || 0,
        medium_fit_leads: rawMetrics?.medium_fit_leads || 0,
        low_fit_leads: rawMetrics?.low_fit_leads || 0,
        high_fit_crm_leads: rawMetrics?.high_fit_crm_leads || 0,
        high_fit_database_leads: rawMetrics?.high_fit_database_leads || 0,
        medium_fit_crm_leads: rawMetrics?.medium_fit_crm_leads || 0,
        medium_fit_database_leads: rawMetrics?.medium_fit_database_leads || 0,
        low_fit_crm_leads: rawMetrics?.low_fit_crm_leads || 0,
        low_fit_database_leads: rawMetrics?.low_fit_database_leads || 0,
        campaign_ready_accounts: rawMetrics?.campaign_ready_accounts || 0,
        campaign_ready_contacts: rawMetrics?.campaign_ready || 0,
        campaign_ready_leads: rawMetrics?.campaign_ready || 0,
        data_completeness: dataCompleteness,
      };
      
      // Map TAM data - prefer metrics function data over separate TAM query
      const tamData: ExternalTAMData | null = rawMetrics?.apollo_accounts_available ? {
        totalAccounts: Number(rawMetrics.apollo_accounts_available) || 0,
        totalLeads: Number(rawMetrics.apollo_contacts_available) || 0,
        provider: rawMetrics.apollo_provider || 'Apollo',
        lastSyncedAt: tamResult.data?.last_synced_at,
        geography_breakdown: tamResult.data?.geography_breakdown,
        industry_breakdown: tamResult.data?.industry_breakdown,
        company_size_breakdown: tamResult.data?.company_size_breakdown,
        revenue_breakdown: tamResult.data?.revenue_breakdown,
        technology_breakdown: tamResult.data?.technology_breakdown,
        funding_breakdown: tamResult.data?.funding_breakdown
      } : (tamResult.data ? {
        totalAccounts: Number(tamResult.data.total_accounts) || 0,
        totalLeads: Number(tamResult.data.total_contacts) || 0,
        provider: tamResult.data.provider || 'Unknown',
        lastSyncedAt: tamResult.data.last_synced_at,
        geography_breakdown: tamResult.data.geography_breakdown,
        industry_breakdown: tamResult.data.industry_breakdown,
        company_size_breakdown: tamResult.data.company_size_breakdown,
        revenue_breakdown: tamResult.data.revenue_breakdown,
        technology_breakdown: tamResult.data.technology_breakdown,
        funding_breakdown: tamResult.data.funding_breakdown
      } : null);

      return {
        metrics: mappedMetrics,
        icpProfiles: icpResult.data || [],
        tamData
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - instant navigation back
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on every tab switch
    retry: 2,
  });
}

// Hook for geography data (lazy loaded)
export function useGeographyData(orgId: string | undefined, enabled: boolean = true, sourceFilter: 'crm' | 'database' = 'crm') {
  return useQuery({
    queryKey: ['geography-distribution', orgId, sourceFilter],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_geography_distribution', {
        p_org_id: orgId,
        p_source_filter: sourceFilter
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000,
  });
}

// Hook for source filter toggle stats - derives directly from dashboard data to avoid race conditions
export function useSourceFilterStats(orgId: string | undefined) {
  const { data: dashboardData, isLoading } = useDashboardData(orgId, 'crm');
  
  // Directly derive stats from loaded dashboard data - no separate query needed
  const stats = dashboardData?.metrics 
    ? {
        crm: dashboardData.metrics.total_crm_accounts || dashboardData.metrics.total_accounts || 0,
        database: dashboardData.tamData?.totalAccounts || 0,
      }
    : { crm: 0, database: 0 };
  
  return { 
    data: stats, 
    isLoading 
  };
}

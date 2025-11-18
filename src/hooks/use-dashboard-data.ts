import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardMetrics {
  total_accounts: number;
  total_scores: number;
  total_leads: number;
  crm_accounts: number;
  database_accounts: number;
  crm_scored_accounts: number;
  database_scored_accounts: number;
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

export function useDashboardData(orgId: string | undefined, sourceFilter: 'all' | 'crm' | 'database' = 'all') {
  return useQuery({
    queryKey: ['dashboard-metrics', orgId, sourceFilter],
    queryFn: async (): Promise<DashboardData> => {
      if (!orgId) throw new Error('No org ID provided');
      
      // Parallel fetch: metrics + ICP profiles + TAM data (3 queries instead of 22+)
      const [metricsResult, icpResult, tamResult] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_fast' as any, { 
          p_org_id: orgId,
          p_source_filter: sourceFilter
        }),
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
      
      // Map the function response to expected structure (function returns an array of rows)
      const rawMetrics = (metricsResult.data as any)?.[0];
      
      const mappedMetrics: DashboardMetrics = {
        total_accounts: rawMetrics?.total_accounts || 0,
        total_scores: (rawMetrics?.high_fit_accounts || 0) + (rawMetrics?.medium_fit_accounts || 0) + (rawMetrics?.low_fit_accounts || 0),
        total_leads: rawMetrics?.total_leads || 0,
        crm_accounts: rawMetrics?.crm_accounts || 0,
        database_accounts: rawMetrics?.database_accounts || 0,
        crm_scored_accounts: rawMetrics?.crm_scored_accounts || 0,
        database_scored_accounts: rawMetrics?.database_scored_accounts || 0,
        both_accounts: rawMetrics?.both_accounts || 0,
        linked_leads: rawMetrics?.linked_leads || 0,
        high_fit_scores: rawMetrics?.high_fit_accounts || 0,
        med_fit_scores: rawMetrics?.medium_fit_accounts || 0,
        low_fit_scores: rawMetrics?.low_fit_accounts || 0,
        high_fit_crm_accounts: rawMetrics?.high_fit_crm_accounts || 0,
        high_fit_database_accounts: rawMetrics?.high_fit_database_accounts || 0,
        crm_leads: rawMetrics?.crm_leads || 0,
        database_leads: rawMetrics?.database_leads || 0,
        high_fit_leads_total: rawMetrics?.high_fit_leads_total || 0,
        high_fit_crm_leads: rawMetrics?.high_fit_crm_leads || 0,
        high_fit_database_leads: rawMetrics?.high_fit_database_leads || 0,
        campaign_ready_accounts: rawMetrics?.campaign_ready_accounts || 0,
        campaign_ready_contacts: rawMetrics?.campaign_ready_leads || 0,
        campaign_ready_leads: rawMetrics?.campaign_ready_leads || 0,
        data_completeness: rawMetrics?.data_completeness || 0,
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
    staleTime: 0, // Always fetch fresh data to see TAM updates immediately
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for geography data (lazy loaded)
export function useGeographyData(orgId: string | undefined, enabled: boolean = true, sourceFilter: 'all' | 'crm' | 'database' = 'all') {
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

// Hook for source filter toggle stats (always fetches unfiltered data)
export function useSourceFilterStats(orgId: string | undefined) {
  return useQuery({
    queryKey: ['source-filter-stats', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      // Fetch all three views in parallel
      const [allResult, crmResult, dbResult] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_fast' as any, { 
          p_org_id: orgId,
          p_source_filter: 'all'
        }),
        supabase.rpc('get_dashboard_metrics_fast' as any, { 
          p_org_id: orgId,
          p_source_filter: 'crm'
        }),
        supabase.rpc('get_dashboard_metrics_fast' as any, { 
          p_org_id: orgId,
          p_source_filter: 'database'
        }),
      ]);
      
      if (allResult.error || crmResult.error || dbResult.error) {
        console.error('[useSourceFilterStats] RPC error(s)', {
          allError: allResult.error,
          crmError: crmResult.error,
          dbError: dbResult.error,
        });
      }
      
      const allMetrics = (allResult.data as any)?.[0] ?? allResult.data;
      const crmMetrics = (crmResult.data as any)?.[0] ?? crmResult.data;
      const dbMetrics = (dbResult.data as any)?.[0] ?? dbResult.data;

      return {
        total: allMetrics?.total_accounts ?? allMetrics?.totalAccounts ?? 0,
        crm: crmMetrics?.total_accounts ?? crmMetrics?.totalAccounts ?? 0,
        database: dbMetrics?.total_accounts ?? dbMetrics?.totalAccounts ?? 0,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

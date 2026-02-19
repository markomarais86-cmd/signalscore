import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { FilterCriteria, ICPProfile } from './useCampaignState';
import { campaignsLogger } from '@/lib/logger';
import { HIGH_FIT_THRESHOLD, MEDIUM_FIT_THRESHOLD } from '@/lib/score-bands';

interface AccountWithScore {
  external_id: string;
  name: string;
  domain: string;
  industry_norm: string;
  employee_count: number;
  revenue_range: string;
  country: string;
  state_province: string;
  city: string;
  overall_score: number;
  fit_score: number;
  intent_score: number;
}

export function useCampaignData(
  filterCriteria: FilterCriteria,
  dataSource: 'all' | 'crm' | 'database',
  useICP: boolean
) {
  const { userProfile } = useAuth();
  const [previewData, setPreviewData] = useState<AccountWithScore[] | null>(null);
  const [estimatedLeads, setEstimatedLeads] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [realtimeLeadCount, setRealtimeLeadCount] = useState<number | null>(null);
  const [isCountingLeads, setIsCountingLeads] = useState(false);
  const [apolloTamData, setApolloTamData] = useState<any>(null);
  const [apolloTamDomains, setApolloTamDomains] = useState<string[]>([]);

  // Real-time lead count as filters change
  useEffect(() => {
    const countLeadsRealtime = async () => {
      if (!userProfile?.org_id) return;
      
      setIsCountingLeads(true);
      try {
        let query = supabase
          .from('Leads')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .not('email', 'is', null);
        
        const { count } = await query;
        setRealtimeLeadCount(count || 0);
      } catch (error) {
        campaignsLogger.error('Error counting leads:', error);
      } finally {
        setIsCountingLeads(false);
      }
    };
    
    const debounce = setTimeout(countLeadsRealtime, 500);
    return () => clearTimeout(debounce);
  }, [userProfile?.org_id, filterCriteria]);

  // Load Apollo TAM data when 'database' source is selected
  useEffect(() => {
    const loadApolloTamData = async () => {
      if (!userProfile?.org_id || dataSource !== 'database') {
        setApolloTamData(null);
        setApolloTamDomains([]);
        return;
      }
      
      try {
        const { data: externalSource, error } = await supabase
          .from('external_data_sources')
          .select('*')
          .eq('org_id', userProfile.org_id)
          .eq('provider', 'apollo')
          .single();
        
        if (error) {
          campaignsLogger.error('Error loading Apollo TAM:', error);
          return;
        }
        
        if (externalSource) {
          setApolloTamData(externalSource);
          setApolloTamDomains(['__apollo_tam__']);
        }
      } catch (err) {
        campaignsLogger.error('Error loading Apollo TAM:', err);
      }
    };
    
    loadApolloTamData();
  }, [userProfile?.org_id, dataSource]);

  const loadPreview = useCallback(async (provider: 'apollo' | 'zoominfo' | 'clearbit') => {
    if (!userProfile?.org_id) return;
    setIsLoadingPreview(true);
    
    try {
      const pageSize = 1000;
      let allAccounts: any[] = [];
      let page = 0;
      let hasMore = true;
      
      setLoadingProgress('Loading accounts...');
      
      while (hasMore) {
        let query = supabase
          .from('accounts')
          .select('external_id, name, domain, industry_norm, employee_count, revenue_range, country, state_province, city')
          .eq('org_id', userProfile.org_id)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (dataSource === 'crm') {
          query = query.in('data_source', ['crm', 'both']);
        } else if (dataSource === 'database') {
          query = query.in('data_source', ['database', 'both']);
        }
        
        if (!useICP && filterCriteria.employeeMin) {
          query = query.gte('employee_count', filterCriteria.employeeMin);
        }
        if (!useICP && filterCriteria.employeeMax) {
          query = query.lte('employee_count', filterCriteria.employeeMax);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allAccounts = [...allAccounts, ...data];
          setLoadingProgress(`Loading accounts... ${allAccounts.length.toLocaleString()} loaded`);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      if (allAccounts.length === 0) {
        setPreviewData([]);
        setEstimatedLeads(0);
        setLoadingProgress('');
        return;
      }
      
      // Fetch scores in batches
      const accountIds = allAccounts.map((a: any) => a.external_id);
      const scoreBatchSize = 100;
      let allScores: any[] = [];
      
      setLoadingProgress(`Loading scores for ${accountIds.length.toLocaleString()} accounts...`);
      
      for (let i = 0; i < accountIds.length; i += scoreBatchSize) {
        const batch = accountIds.slice(i, i + scoreBatchSize);
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('account_external_id, overall, fit, intent')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', batch);
        
        if (!scoresError && scoresData) {
          allScores = [...allScores, ...scoresData];
        }
        setLoadingProgress(`Loading scores... ${allScores.length.toLocaleString()} of ${accountIds.length.toLocaleString()}`);
      }
      
      const scoreMap = new Map(allScores.map((s: any) => [s.account_external_id, s]));
      
      const accountsWithScores = allAccounts.map((acc: any) => {
        const score = scoreMap.get(acc.external_id);
        return {
          ...acc,
          overall_score: score?.overall || 0,
          fit_score: score?.fit || 0,
          intent_score: score?.intent || 0
        };
      });
      
      const filteredAccounts = accountsWithScores.filter((acc: any) => 
        acc.overall_score >= filterCriteria.fitScoreMin && 
        acc.overall_score <= filterCriteria.fitScoreMax
      );
      
      setPreviewData(filteredAccounts);
      
      // Count leads
      setLoadingProgress(`Counting leads for ${filteredAccounts.length.toLocaleString()} accounts...`);
      if (filteredAccounts.length > 0) {
        const filteredAccountIds = filteredAccounts.map((a: any) => a.external_id);
        let totalLeads = 0;
        const batchSize = 100;
        
        for (let i = 0; i < filteredAccountIds.length; i += batchSize) {
          const batch = filteredAccountIds.slice(i, i + batchSize);
          const { count, error: leadsError } = await supabase
            .from('Leads')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', userProfile.org_id)
            .in('account_external_id', batch)
            .not('email', 'is', null);
          
          if (!leadsError) {
            totalLeads += count || 0;
          }
          setLoadingProgress(`Counting leads... ${totalLeads.toLocaleString()} found`);
        }
        
        setEstimatedLeads(totalLeads);
      } else {
        setEstimatedLeads(0);
      }
      setLoadingProgress('');
      
      // Calculate cost
      if (dataSource === 'database') {
        const costPerContact = provider === 'apollo' ? 0.50 : provider === 'zoominfo' ? 0.75 : 1.00;
        setEstimatedCost((filteredAccounts.length || 0) * costPerContact);
      } else {
        setEstimatedCost(0);
      }
    } catch (error: any) {
      campaignsLogger.error('Error loading preview:', error);
      setPreviewData([]);
      setEstimatedLeads(0);
    } finally {
      setIsLoadingPreview(false);
      setLoadingProgress('');
    }
  }, [userProfile?.org_id, filterCriteria, dataSource, useICP]);

  const scoreBandBreakdown = useMemo(() => {
    if (!previewData) return { A: 0, B: 0, C: 0 };
    const breakdown = { A: 0, B: 0, C: 0 };
    previewData.forEach((acc: any) => {
      const score = acc.overall_score || 0;
      if (score >= HIGH_FIT_THRESHOLD) breakdown.A++;
      else if (score >= MEDIUM_FIT_THRESHOLD) breakdown.B++;
      else breakdown.C++;
    });
    return breakdown;
  }, [previewData]);

  return {
    previewData,
    estimatedLeads,
    estimatedCost,
    setEstimatedCost,
    isLoadingPreview,
    loadingProgress,
    realtimeLeadCount,
    isCountingLeads,
    apolloTamData,
    apolloTamDomains,
    loadPreview,
    scoreBandBreakdown
  };
}

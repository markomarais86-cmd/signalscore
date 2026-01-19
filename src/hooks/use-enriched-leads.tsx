import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EnrichedLead {
  id: number;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  direct_phone: string | null;
  title: string | null;
  seniority_level: string | null;
  department_category: string | null;
  persona: string | null;
  company: string | null;
  account_external_id: string | null;
  linkedin_url: string | null;
  // Enrichment fields
  enriched_at: string | null;
  enriched_from: string | null;
  enrichment_confidence: number | null;
  enrichment_overall_score: number | null;
  enrichment_citations: any | null;
  email_verified: boolean | null;
  phones: any | null;
  icp_qualified: boolean | null;
  still_at_company: string | null;
  org_id: string;
}

export interface UseEnrichedLeadsOptions {
  orgId: string | null;
  pageSize?: number;
  searchTerm?: string;
  enrichmentSource?: string;
  confidenceLevel?: 'high' | 'medium' | 'low' | 'all';
  dateRange?: 'day' | 'week' | 'month' | 'all';
  hasPhone?: boolean | null;
  icpQualified?: boolean | null;
  sortField?: 'name' | 'enriched_at' | 'enrichment_confidence';
  sortDirection?: 'asc' | 'desc';
}

interface PaginationState {
  leads: EnrichedLead[];
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  totalCount: number;
  error: string | null;
}

export function useEnrichedLeads(options: UseEnrichedLeadsOptions) {
  const {
    orgId,
    pageSize = 25,
    searchTerm,
    enrichmentSource,
    confidenceLevel = 'all',
    dateRange = 'all',
    hasPhone,
    icpQualified,
    sortField = 'enriched_at',
    sortDirection = 'desc'
  } = options;

  const { toast } = useToast();
  
  const [state, setState] = useState<PaginationState>({
    leads: [],
    cursor: null,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    totalCount: 0,
    error: null
  });

  const loadLeads = useCallback(async (loadMore = false) => {
    if (!orgId) return;

    setState(prev => ({
      ...prev,
      isLoading: !loadMore,
      isLoadingMore: loadMore,
      error: null
    }));

    try {
      // Build base query - only enriched leads (enriched_at IS NOT NULL)
      let query = supabase
        .from('Leads')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .not('enriched_at', 'is', null);

      // Search filter
      if (searchTerm && searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company.ilike.${term}`);
      }

      // Enrichment source filter
      if (enrichmentSource && enrichmentSource !== 'all') {
        query = query.ilike('enriched_from', `%${enrichmentSource}%`);
      }

      // Confidence level filter
      if (confidenceLevel !== 'all') {
        if (confidenceLevel === 'high') {
          query = query.gte('enrichment_confidence', 80);
        } else if (confidenceLevel === 'medium') {
          query = query.gte('enrichment_confidence', 50).lt('enrichment_confidence', 80);
        } else if (confidenceLevel === 'low') {
          query = query.lt('enrichment_confidence', 50);
        }
      }

      // Date range filter
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        if (dateRange === 'day') {
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (dateRange === 'week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        
        query = query.gte('enriched_at', startDate.toISOString());
      }

      // Has phone filter
      if (hasPhone === true) {
        query = query.or('direct_phone.not.is.null,phone.not.is.null,mobile.not.is.null');
      } else if (hasPhone === false) {
        query = query.is('direct_phone', null).is('phone', null).is('mobile', null);
      }

      // ICP qualified filter
      if (icpQualified === true) {
        query = query.eq('icp_qualified', true);
      } else if (icpQualified === false) {
        query = query.or('icp_qualified.eq.false,icp_qualified.is.null');
      }

      // Cursor-based pagination
      const cursor = loadMore ? state.cursor : null;
      if (cursor) {
        if (sortDirection === 'desc') {
          query = query.lt(sortField, cursor);
        } else {
          query = query.gt(sortField, cursor);
        }
      }

      // Sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });
      query = query.order('id', { ascending: false }); // Secondary sort for stability

      // Limit
      query = query.limit(pageSize);

      const { data, error, count } = await query;

      if (error) throw error;

      // Map database rows to our interface
      const leads = ((data || []) as unknown as EnrichedLead[]).map(row => ({
        ...row,
        seniority_level: (row as any).seniority_level || (row as any).seniority || null,
        department_category: (row as any).department_category || (row as any).department || null
      }));
      const newCursor = leads.length > 0 ? (leads[leads.length - 1] as any)[sortField] : null;

      setState(prev => ({
        leads: loadMore ? [...prev.leads, ...leads] : leads,
        cursor: newCursor as string | null,
        hasMore: leads.length === pageSize,
        isLoading: false,
        isLoadingMore: false,
        totalCount: count || 0,
        error: null
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load enriched leads';
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: message
      }));
      toast({
        title: 'Error loading leads',
        description: message,
        variant: 'destructive'
      });
    }
  }, [orgId, pageSize, searchTerm, enrichmentSource, confidenceLevel, dateRange, hasPhone, icpQualified, sortField, sortDirection, state.cursor, toast]);

  // Initial load and reload on filter changes
  useEffect(() => {
    if (orgId) {
      loadLeads(false);
    }
  }, [orgId, searchTerm, enrichmentSource, confidenceLevel, dateRange, hasPhone, icpQualified, sortField, sortDirection]);

  const loadMore = useCallback(() => {
    if (!state.isLoadingMore && state.hasMore) {
      loadLeads(true);
    }
  }, [loadLeads, state.isLoadingMore, state.hasMore]);

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, cursor: null }));
    loadLeads(false);
  }, [loadLeads]);

  return {
    leads: state.leads,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    hasMore: state.hasMore,
    totalCount: state.totalCount,
    error: state.error,
    loadMore,
    refresh
  };
}

// Hook for enriched leads metrics
export function useEnrichedLeadsMetrics(orgId: string | null) {
  const [metrics, setMetrics] = useState({
    totalEnriched: 0,
    highConfidence: 0,
    phoneDiscovered: 0,
    emailVerified: 0,
    isLoading: true
  });

  useEffect(() => {
    if (!orgId) return;

    async function loadMetrics() {
      try {
        // Total enriched
        const { count: totalEnriched } = await supabase
          .from('Leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .not('enriched_at', 'is', null);

        // High confidence (80%+)
        const { count: highConfidence } = await supabase
          .from('Leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .not('enriched_at', 'is', null)
          .gte('enrichment_confidence', 80);

        // Phone discovered
        const { count: phoneDiscovered } = await supabase
          .from('Leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .not('enriched_at', 'is', null)
          .or('direct_phone.not.is.null,phone.not.is.null,mobile.not.is.null');

        // Email verified
        const { count: emailVerified } = await supabase
          .from('Leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .not('enriched_at', 'is', null)
          .eq('email_verified', true);

        setMetrics({
          totalEnriched: totalEnriched || 0,
          highConfidence: highConfidence || 0,
          phoneDiscovered: phoneDiscovered || 0,
          emailVerified: emailVerified || 0,
          isLoading: false
        });
      } catch (error) {
        console.error('Failed to load enriched leads metrics:', error);
        setMetrics(prev => ({ ...prev, isLoading: false }));
      }
    }

    loadMetrics();
  }, [orgId]);

  return metrics;
}

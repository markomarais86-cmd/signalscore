import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCursorPagination } from './use-cursor-pagination';
import { useToast } from './use-toast';

interface Lead {
  id: number;
  external_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  persona: string | null;
  company: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  state_province: string | null;
  status: string | null;
  account_external_id: string | null;
  contact_external_id: string | null;
  created_at?: string;
  // Enrichment fields
  icp_qualified: boolean | null;
  icp_fail_reasons: string[] | null;
  enrichment_overall_score: number | null;
  enrichment_field_scores: Record<string, number> | null;
  linkedin_url: string | null;
  still_at_company: string | null;
  direct_phone: string | null;
  enriched_at: string | null;
  account?: {
    name: string | null;
    domain: string | null;
    industry_norm: string | null;
    employee_count: number | null;
    revenue_range: string | null;
    country: string | null;
  } | null;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
    reasons: any;
  } | null;
}

interface UseInfiniteLeadsOptions {
  orgId: string | null;
  pageSize?: number;
  searchTerm?: string;
  statusFilter?: string;
  linkFilter?: string;
  personaFilter?: string;
  campaignReadyFilter?: string;
  icpFilter?: string;
  staleDaysFilter?: number;
  enabled?: boolean;
}

/**
 * Hook for loading leads with infinite scroll and cursor-based pagination
 */
export function useInfiniteLeads(options: UseInfiniteLeadsOptions) {
  const {
    orgId,
    pageSize = 25,
    searchTerm = '',
    statusFilter = 'all',
    linkFilter = 'all',
    personaFilter = 'all',
    campaignReadyFilter = 'all',
    icpFilter = 'all',
    staleDaysFilter,
    enabled = true,
  } = options;

  const pagination = useCursorPagination<Lead>({ pageSize });
  const { toast } = useToast();
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const loadLeads = useCallback(
    async (isLoadingMore = false) => {
      if (!orgId || !enabled) return;

      if (isLoadingMore) {
        pagination.setLoadingMore(true);
      } else {
        pagination.setLoading(true);
      }

      try {
        // Build query with created_at for cursor
        let query = supabase
          .from('Leads')
          .select('*', { count: 'exact' })
          .eq('org_id', orgId)
          .order('id', { ascending: false })
          .limit(pageSize);

        // Apply cursor (for loading more)
        if (isLoadingMore && pagination.state.cursor) {
          query = query.lt('id', pagination.state.cursor);
        }

        // Apply filters
        if (searchTerm) {
          query = query.or(
            `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`
          );
        }

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        if (linkFilter === 'linked') {
          query = query.not('account_external_id', 'is', null);
        } else if (linkFilter === 'unlinked') {
          query = query.is('account_external_id', null);
        }

        if (personaFilter && personaFilter !== 'all') {
          query = query.eq('persona', personaFilter);
        }

        // Campaign ready filter
        if (campaignReadyFilter === 'yes') {
          // Campaign ready: has email, title, and persona (not Unknown)
          query = query
            .not('email', 'is', null)
            .not('title', 'is', null)
            .not('persona', 'is', null)
            .neq('persona', 'Unknown');
        } else if (campaignReadyFilter === 'no') {
          // Not campaign ready: missing email, title, or has Unknown persona
          query = query.or(
            'email.is.null,title.is.null,persona.is.null,persona.eq.Unknown'
          );
        }

        // ICP qualification filter
        if (icpFilter === 'qualified') {
          query = query.eq('icp_qualified', true);
        } else if (icpFilter === 'failed') {
          query = query.eq('icp_qualified', false);
        } else if (icpFilter === 'not_enriched') {
          query = query.is('enriched_at', null);
        }

        // Stale days filter - show leads not updated in X days
        if (staleDaysFilter && staleDaysFilter > 0) {
          const staleCutoffDate = new Date();
          staleCutoffDate.setDate(staleCutoffDate.getDate() - staleDaysFilter);
          query = query.lt('updated_at', staleCutoffDate.toISOString());
        }

        const { data, error, count } = await query;

        if (error) throw error;

        const leads = (data || []) as Lead[];

        // Update state
        if (isLoadingMore) {
          pagination.appendItems(leads);
        } else {
          pagination.setItems(leads);
          if (count !== null) {
            pagination.setTotalCount(count);
          }
        }

        // Update cursor and hasMore
        if (leads.length > 0) {
          const lastLead = leads[leads.length - 1];
          pagination.setCursor(String(lastLead.id));
          pagination.setHasMore(leads.length === pageSize);
        } else {
          pagination.setHasMore(false);
        }

        // Load linked accounts and scores
        if (leads.length > 0) {
          const linkedExternalIds = leads
            .map((l) => l.account_external_id)
            .filter((id): id is string => id !== null);

          let linkedAccounts: any[] = [];
          let scores: any[] = [];

          if (linkedExternalIds.length > 0) {
            const [accountsRes, scoresRes] = await Promise.all([
              supabase
                .from('accounts')
                .select('external_id, name, domain, industry_norm, employee_count, revenue_range, country')
                .eq('org_id', orgId)
                .in('external_id', linkedExternalIds),
              supabase
                .from('scores')
                .select('*')
                .eq('org_id', orgId)
                .in('account_external_id', linkedExternalIds),
            ]);

            linkedAccounts = accountsRes.data || [];
            scores = scoresRes.data || [];
          }

          // Merge data
          const enrichedLeads = leads.map((lead) => {
            const linkedAccount = linkedAccounts.find(
              (a) => a.external_id === lead.account_external_id
            );
            const scoreData = scores.find(
              (s) => s.account_external_id === lead.account_external_id
            );

            return {
              ...lead,
              account: linkedAccount || null,
              score: scoreData
                ? {
                    overall: scoreData.overall,
                    fit: scoreData.fit,
                    intent: scoreData.intent,
                    reachability: scoreData.reachability,
                    reasons: scoreData.reasons,
                  }
                : null,
            };
          }) as Lead[];

          if (isLoadingMore) {
            pagination.setItems([
              ...pagination.state.items.slice(0, -leads.length),
              ...enrichedLeads,
            ] as Lead[]);
          } else {
            pagination.setItems(enrichedLeads);
          }
        }
      } catch (error: any) {
        console.error('Error loading leads:', error);
        pagination.setError(error);
        setLastError(error);
        
        // Show toast notification
        const errorMessage = error?.message || 'Failed to load leads';
        toast({
          title: isLoadingMore ? 'Error Loading More' : 'Error Loading Leads',
          description: retryCount < 3 ? `${errorMessage}. Click retry button below to try again.` : errorMessage,
          variant: 'destructive',
        });
      } finally {
        pagination.setLoading(false);
        pagination.setLoadingMore(false);
      }
    },
    [
      orgId,
      enabled,
      pageSize,
      searchTerm,
      statusFilter,
      linkFilter,
      personaFilter,
      campaignReadyFilter,
      icpFilter,
      staleDaysFilter,
      pagination,
      toast,
    ]
  );

  const loadMore = useCallback(() => {
    if (
      !pagination.state.isLoadingMore &&
      pagination.state.hasMore &&
      pagination.state.cursor
    ) {
      loadLeads(true);
    }
  }, [loadLeads, pagination.state.isLoadingMore, pagination.state.hasMore, pagination.state.cursor]);

  const refresh = useCallback(() => {
    setRetryCount(0);
    setLastError(null);
    pagination.reset();
    loadLeads(false);
  }, [loadLeads, pagination]);

  const retry = useCallback(() => {
    if (lastError) {
      setRetryCount(prev => prev + 1);
      setLastError(null);
      loadLeads(pagination.state.items.length > 0);
    }
  }, [lastError, loadLeads, pagination.state.items.length]);

  // Load initial data when filters change
  useEffect(() => {
    pagination.reset();
    loadLeads(false);
  }, [orgId, searchTerm, statusFilter, linkFilter, personaFilter, campaignReadyFilter, icpFilter, staleDaysFilter]);

  return {
    leads: pagination.state.items,
    isLoading: pagination.state.isLoading,
    isLoadingMore: pagination.state.isLoadingMore,
    hasMore: pagination.state.hasMore,
    error: pagination.state.error,
    lastError,
    retryCount,
    totalCount: pagination.state.totalCount,
    loadMore,
    refresh,
    retry,
  };
}

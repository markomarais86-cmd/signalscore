import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCursorPagination } from './use-cursor-pagination';
import { useToast } from './use-toast';

interface Account {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  updated_at: string;
  data_source?: 'crm' | 'database' | 'both';
  external_database_match?: boolean;
  enriched_from?: string | null;
  enriched_at?: string | null;
  contacts?: number;
  score?: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  } | null;
}

interface UseInfiniteAccountsOptions {
  orgId: string | null;
  pageSize?: number;
  searchTerm?: string;
  industryFilter?: string;
  subIndustryFilter?: string;
  sourceFilter?: string | null;
  fitFilter?: string | null;
  countryFilter?: string | null;
  enabled?: boolean;
}

/**
 * Hook for loading accounts with infinite scroll and cursor-based pagination
 */
export function useInfiniteAccounts(options: UseInfiniteAccountsOptions) {
  const {
    orgId,
    pageSize = 25,
    searchTerm = '',
    industryFilter = 'all',
    subIndustryFilter = 'all',
    sourceFilter = null,
    fitFilter = null,
    countryFilter = null,
    enabled = true,
  } = options;

  const pagination = useCursorPagination<Account>({ pageSize });
  const { toast } = useToast();
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const loadAccounts = useCallback(
    async (isLoadingMore = false) => {
      if (!orgId || !enabled) return;

      if (isLoadingMore) {
        pagination.setLoadingMore(true);
      } else {
        pagination.setLoading(true);
      }

      try {
        // Build query
        let query = supabase
          .from('accounts')
          .select('*', { count: 'exact' })
          .eq('org_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(pageSize);

        // Apply cursor (for loading more)
        if (isLoadingMore && pagination.state.cursor) {
          query = query.lt('updated_at', pagination.state.cursor);
        }

        // Apply filters
        if (searchTerm) {
          query = query.or(
            `name.ilike.%${searchTerm}%,domain.ilike.%${searchTerm}%,external_id.ilike.%${searchTerm}%`
          );
        }

        if (industryFilter && industryFilter !== 'all') {
          query = query.eq('industry_norm', industryFilter);
        }

        if (sourceFilter) {
          query = query.eq('data_source', sourceFilter);
        }

        if (countryFilter) {
          query = query.eq('country', countryFilter);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        const accounts = (data || []) as Account[];

        // Update state
        if (isLoadingMore) {
          pagination.appendItems(accounts);
        } else {
          pagination.setItems(accounts);
          if (count !== null) {
            pagination.setTotalCount(count);
          }
        }

        // Update cursor and hasMore
        if (accounts.length > 0) {
          const lastAccount = accounts[accounts.length - 1];
          pagination.setCursor(lastAccount.updated_at);
          pagination.setHasMore(accounts.length === pageSize);
        } else {
          pagination.setHasMore(false);
        }

        // Also load scores and contacts for accounts
        if (accounts.length > 0) {
          const accountIds = accounts.map((a) => a.external_id);
          
          // Fetch scores
          const { data: scores } = await supabase
            .from('scores')
            .select('*')
            .eq('org_id', orgId)
            .in('account_external_id', accountIds);

          // Fetch contact counts
          const { data: contactCounts } = await supabase
            .from('contacts')
            .select('account_external_id')
            .eq('org_id', orgId)
            .in('account_external_id', accountIds);

          // Group contact counts by account
          const contactCountMap = contactCounts?.reduce((acc, contact) => {
            acc[contact.account_external_id] = (acc[contact.account_external_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {};

          // Merge scores and contact counts with accounts
          const accountsWithScoresAndContacts = accounts.map((account) => {
            const score = scores?.find(
              (s) => s.account_external_id === account.external_id
            );
            return {
              ...account,
              score: score
                ? {
                    overall: score.overall,
                    fit: score.fit,
                    intent: score.intent,
                    reachability: score.reachability,
                  }
                : null,
              contacts: contactCountMap[account.external_id] || 0,
            };
          }) as Account[];

          if (isLoadingMore) {
            pagination.setItems([
              ...pagination.state.items.slice(0, -accounts.length),
              ...accountsWithScoresAndContacts,
            ] as Account[]);
          } else {
            pagination.setItems(accountsWithScoresAndContacts);
          }
        }
      } catch (error: any) {
        console.error('Error loading accounts:', error);
        pagination.setError(error);
        setLastError(error);
        
        // Show toast notification
        const errorMessage = error?.message || 'Failed to load accounts';
        toast({
          title: isLoadingMore ? 'Error Loading More' : 'Error Loading Accounts',
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
      industryFilter,
      subIndustryFilter,
      sourceFilter,
      fitFilter,
      countryFilter,
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
      loadAccounts(true);
    }
  }, [loadAccounts, pagination.state.isLoadingMore, pagination.state.hasMore, pagination.state.cursor]);

  const refresh = useCallback(() => {
    setRetryCount(0);
    setLastError(null);
    pagination.reset();
    loadAccounts(false);
  }, [loadAccounts, pagination]);

  const retry = useCallback(() => {
    if (lastError) {
      setRetryCount(prev => prev + 1);
      setLastError(null);
      loadAccounts(pagination.state.items.length > 0);
    }
  }, [lastError, loadAccounts, pagination.state.items.length]);

  // Load initial data when filters change
  useEffect(() => {
    pagination.reset();
    loadAccounts(false);
  }, [
    orgId,
    searchTerm,
    industryFilter,
    subIndustryFilter,
    sourceFilter,
    fitFilter,
    countryFilter,
  ]);

  return {
    accounts: pagination.state.items,
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

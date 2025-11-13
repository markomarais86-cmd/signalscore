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
  campaignReadyContacts?: number;
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
  campaignReadyFilter?: boolean | null;
  enabled?: boolean;
  mode?: 'realtime' | 'cached';
  integrationConfigId?: string;
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
    campaignReadyFilter = null,
    enabled = true,
    mode = 'cached',
    integrationConfigId,
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
        // Real-time mode: fetch from CRM via edge function
        if (mode === 'realtime' && integrationConfigId) {
          // Check cache first (5 minute TTL)
          const CACHE_KEY_PREFIX = 'crm-accounts-cache';
          const CACHE_TTL = 5 * 60 * 1000;
          
          if (!isLoadingMore) {
            const cacheKey = `${CACHE_KEY_PREFIX}-${orgId}-${JSON.stringify({ searchTerm, industryFilter, countryFilter, fitFilter })}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL) {
                  console.log('Using cached real-time data');
                  pagination.setItems(data.accounts);
                  pagination.setCursor(data.cursor);
                  pagination.setHasMore(data.hasMore);
                  pagination.setTotalCount(data.totalCount);
                  pagination.setLoading(false);
                  return;
                }
              } catch (e) {
                console.error('Cache parse error:', e);
              }
            }
          }

          // Fetch from edge function
          const { data, error } = await supabase.functions.invoke('fetch-crm-accounts', {
            body: {
              org_id: orgId,
              integration_config_id: integrationConfigId,
              filters: {
                searchTerm: searchTerm || undefined,
                industry: industryFilter !== 'all' ? industryFilter : undefined,
                country: countryFilter || undefined,
                fitScore: fitFilter ? parseInt(fitFilter) : undefined,
              },
              pagination: {
                cursor: isLoadingMore ? pagination.state.cursor : null,
                pageSize,
              },
            },
          });

          if (error) throw error;

          const newAccounts = data.accounts || [];
          
          if (isLoadingMore) {
            pagination.appendItems(newAccounts);
          } else {
            pagination.setItems(newAccounts);
            
            // Cache the result
            const cacheKey = `${CACHE_KEY_PREFIX}-${orgId}-${JSON.stringify({ searchTerm, industryFilter, countryFilter, fitFilter })}`;
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: {
                accounts: newAccounts,
                cursor: data.cursor,
                hasMore: data.hasMore,
                totalCount: data.totalCount,
              },
              timestamp: Date.now(),
            }));
          }
          
          pagination.setCursor(data.cursor);
          pagination.setHasMore(data.hasMore);
          pagination.setTotalCount(data.totalCount);
          
          setLastError(null);
          setRetryCount(0);
          pagination.setLoading(false);
          pagination.setLoadingMore(false);
          return;
        }

        // Cached mode: Build query from local DB
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

        // Source filter - handle 'all', 'crm', and 'database'
        if (sourceFilter && sourceFilter !== 'all') {
          if (sourceFilter === 'crm') {
            // Include CRM-synced, manually uploaded, and closed-won accounts
            query = query.in('data_source', ['crm', 'both', 'closed_won']);
          } else if (sourceFilter === 'database') {
            // Only external database accounts
            query = query.eq('data_source', 'database');
          }
        }

        if (countryFilter) {
          query = query.eq('country', countryFilter);
        }

        // Collect account IDs from various filters
        let fitFilterAccountIds: string[] | null = null;
        let campaignReadyAccountIds: string[] | null = null;

        // Fit filter - requires querying scores table
        if (fitFilter && fitFilter !== 'all') {
          let minScore = 0;
          let maxScore = 100;
          
          if (fitFilter === 'high') {
            minScore = 70;
          } else if (fitFilter === 'medium') {
            minScore = 40;
            maxScore = 69;
          } else if (fitFilter === 'low') {
            maxScore = 39;
          }
          
          const { data: matchingScores } = await supabase
            .from('scores')
            .select('account_external_id')
            .eq('org_id', orgId)
            .gte('overall', minScore)
            .lte('overall', maxScore);
          
          if (!matchingScores || matchingScores.length === 0) {
            pagination.setItems([]);
            pagination.setHasMore(false);
            pagination.setTotalCount(0);
            pagination.setLoading(false);
            pagination.setLoadingMore(false);
            return;
          }
          
          fitFilterAccountIds = matchingScores.map(s => s.account_external_id);
        }

        // Campaign ready filter - accounts with high ICP score (≥70) AND campaign-ready contacts
        if (campaignReadyFilter === true) {
          // Step 1: Get accounts with ICP score ≥ 70
          const { data: highFitScores } = await supabase
            .from('scores')
            .select('account_external_id')
            .eq('org_id', orgId)
            .gte('overall', 70);
          
          if (!highFitScores || highFitScores.length === 0) {
            pagination.setItems([]);
            pagination.setHasMore(false);
            pagination.setTotalCount(0);
            pagination.setLoading(false);
            pagination.setLoadingMore(false);
            return;
          }
          
          const highFitAccountIds = highFitScores.map(s => s.account_external_id);
          
          // Step 2: Get accounts that have at least one campaign-ready lead
          const { data: campaignReadyLeads } = await supabase
            .from('Leads')
            .select('account_external_id')
            .eq('org_id', orgId)
            .in('account_external_id', highFitAccountIds)
            .not('email', 'is', null)
            .not('title', 'is', null)
            .not('persona', 'is', null)
            .neq('persona', 'Unknown');
          
          if (!campaignReadyLeads || campaignReadyLeads.length === 0) {
            pagination.setItems([]);
            pagination.setHasMore(false);
            pagination.setTotalCount(0);
            pagination.setLoading(false);
            pagination.setLoadingMore(false);
            return;
          }
          
          campaignReadyAccountIds = [...new Set(campaignReadyLeads.map(l => l.account_external_id))];
        }

        // Compute intersection of all active filters
        let finalAccountIds: string[] | null = null;

        if (fitFilterAccountIds && campaignReadyAccountIds) {
          // Both filters active - intersect them
          const campaignReadySet = new Set(campaignReadyAccountIds);
          finalAccountIds = fitFilterAccountIds.filter(id => campaignReadySet.has(id));
          
          if (finalAccountIds.length === 0) {
            pagination.setItems([]);
            pagination.setHasMore(false);
            pagination.setTotalCount(0);
            pagination.setLoading(false);
            pagination.setLoadingMore(false);
            return;
          }
        } else if (fitFilterAccountIds) {
          finalAccountIds = fitFilterAccountIds;
        } else if (campaignReadyAccountIds) {
          finalAccountIds = campaignReadyAccountIds;
        }

        // Apply the single .in() filter if we have account IDs
        if (finalAccountIds) {
          query = query.in('external_id', finalAccountIds);
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

          // Fetch lead counts per account
          const { data: leadCounts } = await supabase
            .from('Leads')
            .select('account_external_id, email, title, persona')
            .eq('org_id', orgId)
            .in('account_external_id', accountIds);

          // Group lead counts by account
          const contactCountMap: Record<string, number> = {};
          const campaignReadyCountMap: Record<string, number> = {};
          
          leadCounts?.forEach(lead => {
            contactCountMap[lead.account_external_id] = (contactCountMap[lead.account_external_id] || 0) + 1;
            
            // Check if campaign ready
            if (lead.email && lead.title && lead.persona && lead.persona !== 'Unknown') {
              campaignReadyCountMap[lead.account_external_id] = (campaignReadyCountMap[lead.account_external_id] || 0) + 1;
            }
          });

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
              campaignReadyContacts: campaignReadyCountMap[account.external_id] || 0,
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
      campaignReadyFilter,
      mode,
      integrationConfigId,
      pagination,
      toast,
      retryCount,
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
    campaignReadyFilter,
    mode,
    integrationConfigId,
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

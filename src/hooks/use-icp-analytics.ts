import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface ICPAnalytics {
  // Deal metrics
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  totalPipeline: number;
  avgDealSize: number;
  
  // Velocity metrics
  avgSalesCycleDays: number;
  pipelineVelocity: number; // $ per day
  
  // Account coverage
  totalMatchedAccounts: number;
  enrichedAccounts: number;
  enrichmentCoverage: number;
  accountsWithContacts: number;
  contactCoverage: number;
  
  // Conversion funnel
  accountsContacted: number;
  meetingsBooked: number;
  proposalsSent: number;
  contactToMeetingRate: number;
  meetingToProposalRate: number;
}

interface UseICPAnalyticsOptions {
  icpId: string;
}

export function useICPAnalytics({ icpId }: UseICPAnalyticsOptions) {
  const { userProfile } = useAuth();
  const [analytics, setAnalytics] = useState<ICPAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.org_id || !icpId) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch matched accounts for this ICP
        const { data: matchedAccounts, error: accountsError } = await supabase
          .from('scores')
          .select('account_external_id, overall, fit')
          .eq('org_id', userProfile.org_id)
          .eq('icp_id', icpId)
          .gte('fit', 50);

        if (accountsError) throw accountsError;

        const accountIds = matchedAccounts?.map(a => a.account_external_id) || [];
        const totalMatchedAccounts = accountIds.length;

        // Fetch enriched accounts count
        const { count: enrichedCount } = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .in('external_id', accountIds.length > 0 ? accountIds : ['__none__'])
          .not('enriched_at', 'is', null);

        // Fetch accounts with contacts
        const { count: withContactsCount } = await supabase
          .from('Leads')
          .select('account_external_id', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds.length > 0 ? accountIds : ['__none__'])
          .not('email', 'is', null);

        // Fetch deals for matched accounts
        const { data: deals, error: dealsError } = await supabase
          .from('deals')
          .select('id, amount, status, stage, created_at, closed_date')
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds.length > 0 ? accountIds : ['__none__']);

        if (dealsError) throw dealsError;

        // Calculate deal metrics
        const wonDeals = deals?.filter(d => d.status === 'won') || [];
        const lostDeals = deals?.filter(d => d.status === 'lost') || [];
        const openDeals = deals?.filter(d => d.status === 'open') || [];

        const totalWonAmount = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalPipeline = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
        const avgDealSize = wonDeals.length > 0 ? totalWonAmount / wonDeals.length : 0;

        // Calculate sales cycle for won deals
        const salesCycles = wonDeals
          .filter(d => d.created_at && d.closed_date)
          .map(d => {
            const created = new Date(d.created_at);
            const closed = new Date(d.closed_date!);
            return Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          });
        
        const avgSalesCycleDays = salesCycles.length > 0
          ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length
          : 0;

        // Fetch activity metrics (simplified)
        const { count: activitiesCount } = await supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', userProfile.org_id)
          .in('account_external_id', accountIds.length > 0 ? accountIds : ['__none__']);

        const analyticsData: ICPAnalytics = {
          totalDeals: deals?.length || 0,
          wonDeals: wonDeals.length,
          lostDeals: lostDeals.length,
          winRate: (wonDeals.length + lostDeals.length) > 0
            ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
            : 0,
          totalPipeline,
          avgDealSize,
          avgSalesCycleDays,
          pipelineVelocity: avgSalesCycleDays > 0 ? totalPipeline / avgSalesCycleDays : 0,
          totalMatchedAccounts,
          enrichedAccounts: enrichedCount || 0,
          enrichmentCoverage: totalMatchedAccounts > 0
            ? ((enrichedCount || 0) / totalMatchedAccounts) * 100
            : 0,
          accountsWithContacts: withContactsCount || 0,
          contactCoverage: totalMatchedAccounts > 0
            ? ((withContactsCount || 0) / totalMatchedAccounts) * 100
            : 0,
          accountsContacted: activitiesCount || 0,
          meetingsBooked: 0, // Would need activity type filtering
          proposalsSent: 0,
          contactToMeetingRate: 0,
          meetingToProposalRate: 0,
        };

        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Error fetching ICP analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [userProfile?.org_id, icpId]);

  return { analytics, isLoading, error };
}

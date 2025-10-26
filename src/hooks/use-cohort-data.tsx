import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

export interface CohortData {
  cohortMonth: string;
  accountCount: number;
  retentionRates: { [key: string]: number };
  ltv: number;
  conversionRate: number;
}

export interface CohortMetrics {
  cohorts: CohortData[];
  avgLtv: number;
  avgRetention: number;
  topCohort: string;
}

export function useCohortData() {
  const [metrics, setMetrics] = useState<CohortMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();

  const loadCohortMetrics = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get accounts - use score computed_at as proxy for account age
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('account_external_id, computed_at')
        .eq('org_id', userProfile.org_id);

      if (scoresError) throw scoresError;

      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, external_id')
        .eq('org_id', userProfile.org_id);

      if (accountsError) throw accountsError;

      // Map accounts with their first score date
      const accountsWithDates = accounts?.map(acc => {
        const firstScore = scores?.find(s => s.account_external_id === acc.external_id);
        return {
          ...acc,
          created_at: firstScore?.computed_at || new Date().toISOString()
        };
      }) || [];

      if (accountsError) throw accountsError;

      // Get closed won deals
      const { data: deals, error: dealsError } = await supabase
        .from('closed_won_deals')
        .select('account_external_id, deal_value, close_date')
        .eq('org_id', userProfile.org_id);

      if (dealsError) throw dealsError;

      // Group accounts by month
      const cohortMap = new Map<string, CohortData>();
      
      accountsWithDates.forEach(account => {
        const cohortMonth = new Date(account.created_at).toISOString().slice(0, 7);
        if (!cohortMap.has(cohortMonth)) {
          cohortMap.set(cohortMonth, {
            cohortMonth,
            accountCount: 0,
            retentionRates: {},
            ltv: 0,
            conversionRate: 0,
          });
        }
        const cohort = cohortMap.get(cohortMonth)!;
        cohort.accountCount++;
      });

      // Calculate LTV and conversion for each cohort
      deals?.forEach(deal => {
        const account = accountsWithDates.find(a => a.external_id === deal.account_external_id);
        if (account) {
          const cohortMonth = new Date(account.created_at).toISOString().slice(0, 7);
          const cohort = cohortMap.get(cohortMonth);
          if (cohort) {
            cohort.ltv += Number(deal.deal_value);
          }
        }
      });

      // Calculate averages
      const cohorts = Array.from(cohortMap.values()).sort((a, b) => 
        b.cohortMonth.localeCompare(a.cohortMonth)
      );

      cohorts.forEach(cohort => {
        if (cohort.accountCount > 0) {
          cohort.ltv = cohort.ltv / cohort.accountCount;
          const accountsWithDeals = deals?.filter(d => {
            const acc = accountsWithDates.find(a => a.external_id === d.account_external_id);
            return acc && new Date(acc.created_at).toISOString().slice(0, 7) === cohort.cohortMonth;
          }).length || 0;
          cohort.conversionRate = (accountsWithDeals / cohort.accountCount) * 100;
        }
      });

      const avgLtv = cohorts.reduce((sum, c) => sum + c.ltv, 0) / (cohorts.length || 1);
      const avgRetention = cohorts.reduce((sum, c) => sum + c.conversionRate, 0) / (cohorts.length || 1);
      const topCohort = cohorts.reduce((top, c) => c.ltv > top.ltv ? c : top, cohorts[0] || { ltv: 0, cohortMonth: 'N/A' });

      setMetrics({
        cohorts,
        avgLtv,
        avgRetention,
        topCohort: topCohort.cohortMonth,
      });
    } catch (err: any) {
      console.error('Error loading cohort metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.org_id) {
      loadCohortMetrics();
    }
  }, [userProfile?.org_id]);

  return {
    metrics,
    isLoading,
    error,
    refresh: loadCohortMetrics,
  };
}

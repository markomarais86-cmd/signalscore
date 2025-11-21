import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

interface AccountInsights {
  topIndustries: Array<{ name: string; count: number }>;
  topSizes: Array<{ size: number; count: number }>;
  topCountries: Array<{ name: string; count: number }>;
  totalAccounts: number;
  hasData: boolean;
}

export function useAccountInsights() {
  const { userProfile } = useAuth();
  
  return useQuery({
    queryKey: ['account-insights', userProfile?.org_id],
    queryFn: async (): Promise<AccountInsights> => {
      if (!userProfile?.org_id) {
        return {
          topIndustries: [],
          topSizes: [],
          topCountries: [],
          totalAccounts: 0,
          hasData: false
        };
      }

      // Get total accounts
      const { count: totalAccounts } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      if (!totalAccounts || totalAccounts === 0) {
        return {
          topIndustries: [],
          topSizes: [],
          topCountries: [],
          totalAccounts: 0,
          hasData: false
        };
      }

      // Get top industries
      const { data: industriesData } = await supabase
        .from('accounts')
        .select('industry_norm')
        .eq('org_id', userProfile.org_id)
        .not('industry_norm', 'is', null);

      const industriesCount = industriesData?.reduce((acc: Record<string, number>, row) => {
        if (row.industry_norm) {
          acc[row.industry_norm] = (acc[row.industry_norm] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      const topIndustries = Object.entries(industriesCount)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get top company sizes
      const { data: sizesData } = await supabase
        .from('accounts')
        .select('employee_count')
        .eq('org_id', userProfile.org_id)
        .not('employee_count', 'is', null);

      const sizesCount = sizesData?.reduce((acc: Record<number, number>, row) => {
        if (row.employee_count) {
          acc[row.employee_count] = (acc[row.employee_count] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      const topSizes = Object.entries(sizesCount)
        .map(([size, count]) => ({ size: parseInt(size), count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Get top countries
      const { data: countriesData } = await supabase
        .from('accounts')
        .select('country')
        .eq('org_id', userProfile.org_id)
        .not('country', 'is', null);

      const countriesCount = countriesData?.reduce((acc: Record<string, number>, row) => {
        if (row.country) {
          acc[row.country] = (acc[row.country] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      const topCountries = Object.entries(countriesCount)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        topIndustries,
        topSizes,
        topCountries,
        totalAccounts: totalAccounts || 0,
        hasData: true
      };
    },
    enabled: !!userProfile?.org_id,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
}

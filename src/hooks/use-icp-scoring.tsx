import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface ICPProfile {
  id: string;
  name: string;
  industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
}

interface Account {
  id: string;
  external_id: string;
  name: string;
  industry_raw: string;
  employee_count: number;
  revenue_range: string;
  country: string;
}

interface ICPScore {
  account_id: string;
  icp_id: string;
  overall_score: number;
  fit_score: number;
  reasons: {
    industry_match: boolean;
    size_match: boolean;
    revenue_match: boolean;
    geography_match: boolean;
  };
}

export function useICPScoring() {
  const { userProfile } = useAuth();
  const [icpProfiles, setIcpProfiles] = useState<ICPProfile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [scores, setScores] = useState<ICPScore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadData();
    }
  }, [userProfile?.org_id]);

  const loadData = async () => {
    if (!userProfile?.org_id) return;
    
    setLoading(true);
    try {
      // Load ICP profiles
      const { data: icpData, error: icpError } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (icpError) throw icpError;
      console.log('Loaded ICP profiles:', icpData?.length || 0);
      setIcpProfiles(icpData || []);

      // Load accounts - get count first to handle large datasets
      const { count } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      console.log('Total accounts in database:', count || 0);

      // Load all accounts by setting a high limit
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .limit(50000);

      if (accountError) throw accountError;
      console.log('Loaded accounts:', accountData?.length || 0);
      setAccounts(accountData || []);

      // Load existing scores from database
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('id, account_external_id, overall, fit, reasons')
        .eq('org_id', userProfile.org_id);

      if (scoresError) throw scoresError;
      
      console.log('Loaded existing scores:', scoresData?.length || 0);
      
      // Transform database scores to ICPScore format
      const transformedScores: ICPScore[] = (scoresData || []).map(score => ({
        account_id: score.account_external_id,
        icp_id: '', // Will be populated when we have ICP context
        overall_score: score.overall || 0,
        fit_score: score.fit || 0,
        reasons: score.reasons as any || {
          industry_match: false,
          size_match: false,
          revenue_match: false,
          geography_match: false
        }
      }));
      
      setScores(transformedScores);

    } catch (error) {
      console.error('Error loading ICP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateICPScore = (account: Account, icp: ICPProfile): ICPScore => {
    const reasons = {
      industry_match: false,
      size_match: false,
      revenue_match: false,
      geography_match: false
    };

    // Industry match
    if (account.industry_raw && icp.industries.length > 0) {
      reasons.industry_match = icp.industries.some(industry => 
        account.industry_raw.toLowerCase().includes(industry.toLowerCase())
      );
    }

    // Company size match
    if (account.employee_count && icp.company_sizes.length > 0) {
      reasons.size_match = icp.company_sizes.some(size => 
        account.employee_count >= size
      );
    }

    // Revenue match
    if (account.revenue_range && icp.revenue_ranges.length > 0) {
      reasons.revenue_match = icp.revenue_ranges.includes(account.revenue_range);
    }

    // Geography match
    if (account.country && icp.geographies.length > 0) {
      reasons.geography_match = icp.geographies.some(geo => {
        // Simple geography matching - could be enhanced with country-to-region mapping
        return account.country.toLowerCase().includes(geo.toLowerCase()) ||
               geo.toLowerCase().includes(account.country.toLowerCase());
      });
    }

    // Calculate fit score (0-100)
    const matches = Object.values(reasons).filter(Boolean).length;
    const totalCriteria = Object.keys(reasons).length;
    const fit_score = Math.round((matches / totalCriteria) * 100);

    // Overall score considers data completeness too
    const dataCompleteness = [
      account.industry_raw,
      account.employee_count,
      account.revenue_range,
      account.country
    ].filter(Boolean).length / 4;

    const overall_score = Math.round(fit_score * dataCompleteness);

    return {
      account_id: account.id,
      icp_id: icp.id,
      overall_score,
      fit_score,
      reasons
    };
  };

  const scoreAllAccounts = async () => {
    if (!userProfile?.org_id || icpProfiles.length === 0 || accounts.length === 0) return;

    setLoading(true);
    const newScores: ICPScore[] = [];

    try {
      // Score each account against each ICP profile using database function
      for (const account of accounts) {
        for (const icp of icpProfiles) {
          const { data: scoreResult, error } = await supabase
            .rpc('calculate_account_score', {
              p_account_external_id: account.external_id,
              p_icp_id: icp.id,
              p_org_id: userProfile.org_id
            });

          if (error) {
            console.error('Error calculating score:', error);
            continue;
          }

          if (scoreResult) {
            const score: ICPScore = {
              account_id: account.id,
              icp_id: icp.id,
              overall_score: (scoreResult as any).overall || 0,
              fit_score: (scoreResult as any).fit || 0,
              reasons: (scoreResult as any).breakdown || {}
            };
            newScores.push(score);

            // Store score in database with proper conflict resolution
            const { error: upsertError } = await supabase
              .from('scores')
              .upsert({
                org_id: userProfile.org_id,
                account_external_id: account.external_id,
                overall: (scoreResult as any).overall || 0,
                fit: (scoreResult as any).fit || 0,
                intent: (scoreResult as any).intent || 50,
                reachability: (scoreResult as any).reachability || 70,
                reasons: (scoreResult as any).breakdown || {},
                scoring_version: 'icp_v2.0',
                computed_at: new Date().toISOString()
              }, {
                onConflict: 'org_id,account_external_id,scoring_version',
                ignoreDuplicates: false
              });

            if (upsertError) {
              console.error('Error upserting score:', upsertError);
            }
          }
        }
      }

      setScores(newScores);
    } catch (error) {
      console.error('Error in scoreAllAccounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getICPFitAnalysis = () => {
    if (accounts.length === 0) return null;

    const accountsWithHighFit = accounts.filter(account => {
      const bestScore = scores
        .filter(s => s.account_id === account.id)
        .reduce((max, score) => Math.max(max, score.overall_score), 0);
      return bestScore >= 75;
    });

    const accountsWithMediumFit = accounts.filter(account => {
      const bestScore = scores
        .filter(s => s.account_id === account.id)
        .reduce((max, score) => Math.max(max, score.overall_score), 0);
      return bestScore >= 50 && bestScore < 75;
    });

    const accountsWithLowFit = accounts.filter(account => {
      const bestScore = scores
        .filter(s => s.account_id === account.id)
        .reduce((max, score) => Math.max(max, score.overall_score), 0);
      return bestScore < 50;
    });

    return {
      total: accounts.length,
      highFit: accountsWithHighFit.length,
      mediumFit: accountsWithMediumFit.length,
      lowFit: accountsWithLowFit.length,
      highFitPercentage: Math.round((accountsWithHighFit.length / accounts.length) * 100),
      mediumFitPercentage: Math.round((accountsWithMediumFit.length / accounts.length) * 100),
      lowFitPercentage: Math.round((accountsWithLowFit.length / accounts.length) * 100)
    };
  };

  const getDataQuality = () => {
    if (accounts.length === 0) return null;

    const completeness = {
      industry: accounts.filter(a => a.industry_raw).length,
      employeeCount: accounts.filter(a => a.employee_count).length,
      revenue: accounts.filter(a => a.revenue_range).length,
      country: accounts.filter(a => a.country).length
    };

    const total = accounts.length;

    return {
      total,
      completeness: {
        industry: Math.round((completeness.industry / total) * 100),
        employeeCount: Math.round((completeness.employeeCount / total) * 100),
        revenue: Math.round((completeness.revenue / total) * 100),
        country: Math.round((completeness.country / total) * 100)
      },
      overallCompleteness: Math.round(
        (Object.values(completeness).reduce((sum, count) => sum + count, 0) / (total * 4)) * 100
      )
    };
  };

  return {
    icpProfiles,
    accounts,
    scores,
    loading,
    scoreAllAccounts,
    getICPFitAnalysis,
    getDataQuality,
    reload: loadData
  };
}
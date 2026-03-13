import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDataOrgId } from '@/hooks/use-data-org';
import { icpLogger, scoringLogger } from '@/lib/logger';
import type { ScoreSnapshot, ICPScoringReasons, CalculateAccountScoreResult } from '@/types/supabase-rpc';

interface ICPProfile {
  id: string;
  name: string;
  industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
}

interface ICPScore {
  account_id: string;
  icp_id: string;
  overall_score: number;
  fit_score: number;
  reasons: ICPScoringReasons;
}

const DEFAULT_REASONS: ICPScoringReasons = {
  industry_match: false,
  size_match: false,
  revenue_match: false,
  geography_match: false,
};

/**
 * Reads pre-computed ICP scores from the `scores` table.
 * Accounts are loaded paginated (max 1000) for the summary view.
 * Full scoring happens server-side via the `score-accounts` edge function.
 */
export function useICPScoring() {
  const { dataOrgId, effectiveOrgId } = useDataOrgId();
  const [icpProfiles, setIcpProfiles] = useState<ICPProfile[]>([]);
  const [scores, setScores] = useState<ICPScore[]>([]);
  const [totalAccountCount, setTotalAccountCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (effectiveOrgId && dataOrgId) {
      loadData();
    }
  }, [effectiveOrgId, dataOrgId]);

  const loadData = async () => {
    if (!effectiveOrgId || !dataOrgId) return;
    
    setLoading(true);
    try {
      // Load ICP profiles from child org
      const { data: icpData, error: icpError } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', effectiveOrgId);

      if (icpError) throw icpError;
      icpLogger.debug('Loaded ICP profiles:', icpData?.length || 0);
      setIcpProfiles(icpData || []);

      // Get total account count from data org (don't load all accounts!)
      const { count } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', dataOrgId);

      setTotalAccountCount(count || 0);
      icpLogger.debug('Total accounts in database:', count || 0);

      // Load pre-computed scores from child org (scores table)
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('id, account_external_id, overall, fit, reasons')
        .eq('org_id', effectiveOrgId)
        .limit(1000);

      if (scoresError) throw scoresError;
      
      scoringLogger.debug('Loaded existing scores:', scoresData?.length || 0);
      
      const transformedScores: ICPScore[] = (scoresData || []).map(score => ({
        account_id: score.account_external_id,
        icp_id: '',
        overall_score: score.overall || 0,
        fit_score: score.fit || 0,
        reasons: (score.reasons as unknown as ICPScoringReasons) || DEFAULT_REASONS,
      }));
      
      setScores(transformedScores);
    } catch (error) {
      console.error('Error loading ICP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const scoreAllAccounts = async () => {
    if (!effectiveOrgId || !dataOrgId || icpProfiles.length === 0) return;

    setLoading(true);
    try {
      // Trigger server-side scoring via edge function
      const { data, error } = await supabase.functions.invoke('score-accounts', {
        body: {
          org_id: effectiveOrgId,
          data_org_id: dataOrgId,
        }
      });

      if (error) {
        scoringLogger.error('Error triggering bulk scoring:', error);
        throw error;
      }

      scoringLogger.info('Bulk scoring triggered:', data);
      // Reload scores after a delay to let the job process
      setTimeout(loadData, 5000);
    } catch (error) {
      scoringLogger.error('Error in scoreAllAccounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getICPFitAnalysis = () => {
    if (scores.length === 0 && totalAccountCount === 0) return null;

    const highFit = scores.filter(s => s.overall_score >= 75).length;
    const mediumFit = scores.filter(s => s.overall_score >= 50 && s.overall_score < 75).length;
    const lowFit = scores.filter(s => s.overall_score < 50).length;
    const total = totalAccountCount || scores.length;

    return {
      total,
      highFit,
      mediumFit,
      lowFit,
      highFitPercentage: total > 0 ? Math.round((highFit / total) * 100) : 0,
      mediumFitPercentage: total > 0 ? Math.round((mediumFit / total) * 100) : 0,
      lowFitPercentage: total > 0 ? Math.round((lowFit / total) * 100) : 0,
    };
  };

  const getDataQuality = () => {
    // Data quality is now based on score coverage rather than loading all accounts
    if (totalAccountCount === 0) return null;

    const scoredCount = scores.length;

    return {
      total: totalAccountCount,
      completeness: {
        industry: 0, // Would need a dedicated RPC
        employeeCount: 0,
        revenue: 0,
        country: 0,
      },
      overallCompleteness: totalAccountCount > 0
        ? Math.round((scoredCount / totalAccountCount) * 100)
        : 0,
    };
  };

  return {
    icpProfiles,
    accounts: [], // No longer loading all accounts client-side
    scores,
    loading,
    scoreAllAccounts,
    getICPFitAnalysis,
    getDataQuality,
    reload: loadData,
  };
}

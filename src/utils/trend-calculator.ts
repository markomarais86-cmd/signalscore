import { supabase } from "@/integrations/supabase/client";

export interface TrendData {
  scoringProgress: number;
  completeness: number;
  highFitAccounts: number;
  campaignReady: number;
  mediumFitAccounts?: number;
  lowFitAccounts?: number;
  highFitPercentage?: number;
  mediumFitPercentage?: number;
  lowFitPercentage?: number;
}

export interface WeeklyTrendData extends TrendData {
  period: '7d' | '30d';
}

export async function calculateTrends(orgId: string, currentMetrics: any, period: '7d' | '30d' = '30d'): Promise<TrendData> {
  try {
    const daysAgo = period === '7d' ? 7 : 30;
    const historicalDate = new Date();
    historicalDate.setDate(historicalDate.getDate() - daysAgo);

    const { data: historicalData } = await supabase
      .from('data_quality_history')
      .select('*')
      .eq('org_id', orgId)
      .lte('created_at', historicalDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!historicalData) {
      return {
        scoringProgress: 0,
        completeness: 0,
        highFitAccounts: 0,
        campaignReady: 0,
        mediumFitAccounts: 0,
        lowFitAccounts: 0,
        highFitPercentage: 0,
        mediumFitPercentage: 0,
        lowFitPercentage: 0,
      };
    }

    // Calculate deltas
    const historicalScoringProgress = historicalData.total_accounts > 0
      ? (historicalData.scored_accounts / historicalData.total_accounts) * 100
      : 0;

    const currentScoringProgress = currentMetrics.scoringProgress || 0;
    const scoringProgressDelta = currentScoringProgress - historicalScoringProgress;

    const completenessDelta = (currentMetrics.completenessScore || 0) - (historicalData.overall_completeness || 0);
    
    const highFitDelta = (currentMetrics.highFitAccounts || 0) - (historicalData.high_fit_accounts || 0);
    
    // New: Calculate fit-level trends with percentages
    const currentTotal = currentMetrics.totalAccounts || 1;
    const historicalTotal = historicalData.total_accounts || 1;
    
    const currentHighFit = currentMetrics.highFitAccounts || 0;
    const currentMediumFit = currentMetrics.mediumFitAccounts || 0;
    const currentLowFit = currentMetrics.lowFitAccounts || 0;
    
    const historicalHighFit = historicalData.high_fit_accounts || 0;
    const historicalMediumFit = historicalData.medium_fit_accounts || 0;
    const historicalLowFit = historicalData.low_fit_accounts || 0;
    
    const mediumFitDelta = currentMediumFit - historicalMediumFit;
    const lowFitDelta = currentLowFit - historicalLowFit;
    
    // Calculate percentage changes
    const currentHighFitPct = (currentHighFit / currentTotal) * 100;
    const currentMediumFitPct = (currentMediumFit / currentTotal) * 100;
    const currentLowFitPct = (currentLowFit / currentTotal) * 100;
    
    const historicalHighFitPct = (historicalHighFit / historicalTotal) * 100;
    const historicalMediumFitPct = (historicalMediumFit / historicalTotal) * 100;
    const historicalLowFitPct = (historicalLowFit / historicalTotal) * 100;
    
    return {
      scoringProgress: Number(scoringProgressDelta.toFixed(1)),
      completeness: Number(completenessDelta.toFixed(1)),
      highFitAccounts: highFitDelta,
      campaignReady: 0,
      mediumFitAccounts: mediumFitDelta,
      lowFitAccounts: lowFitDelta,
      highFitPercentage: Number((currentHighFitPct - historicalHighFitPct).toFixed(1)),
      mediumFitPercentage: Number((currentMediumFitPct - historicalMediumFitPct).toFixed(1)),
      lowFitPercentage: Number((currentLowFitPct - historicalLowFitPct).toFixed(1)),
    };
  } catch (error) {
    console.error('Error calculating trends:', error);
    return {
      scoringProgress: 0,
      completeness: 0,
      highFitAccounts: 0,
      campaignReady: 0,
      mediumFitAccounts: 0,
      lowFitAccounts: 0,
      highFitPercentage: 0,
      mediumFitPercentage: 0,
      lowFitPercentage: 0,
    };
  }
}

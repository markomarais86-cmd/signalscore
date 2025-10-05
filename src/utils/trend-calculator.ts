import { supabase } from "@/integrations/supabase/client";

export interface TrendData {
  scoringProgress: number;
  completeness: number;
  highFitAccounts: number;
  campaignReady: number;
}

export async function calculateTrends(orgId: string, currentMetrics: any): Promise<TrendData> {
  try {
    // Get historical snapshot from 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: historicalData } = await supabase
      .from('data_quality_history')
      .select('*')
      .eq('org_id', orgId)
      .lte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!historicalData) {
      // No historical data, return zero trends
      return {
        scoringProgress: 0,
        completeness: 0,
        highFitAccounts: 0,
        campaignReady: 0
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
    
    // Campaign ready is a count, not percentage
    const campaignReadyDelta = 0; // Would need historical campaign ready data

    return {
      scoringProgress: Number(scoringProgressDelta.toFixed(1)),
      completeness: Number(completenessDelta.toFixed(1)),
      highFitAccounts: highFitDelta,
      campaignReady: campaignReadyDelta
    };
  } catch (error) {
    console.error('Error calculating trends:', error);
    return {
      scoringProgress: 0,
      completeness: 0,
      highFitAccounts: 0,
      campaignReady: 0
    };
  }
}

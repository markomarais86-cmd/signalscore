import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendMetrics {
  scoreTrends: {
    overall: TrendPoint[];
    fit: TrendPoint[];
    intent: TrendPoint[];
    reachability: TrendPoint[];
  };
  dataQualityTrends: TrendPoint[];
  icpMatchRateTrends: TrendPoint[];
  pipelineVelocityTrends: TrendPoint[];
}

export function useTrendData(days: number = 90) {
  const [metrics, setMetrics] = useState<TrendMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();

  const loadTrendData = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get score history
      const { data: scoreHistory, error: scoreError } = await supabase
        .from('score_history')
        .select('computed_at, new_score')
        .eq('org_id', userProfile.org_id)
        .gte('computed_at', startDate.toISOString())
        .order('computed_at', { ascending: true });

      if (scoreError) throw scoreError;

      // Get data quality history
      const { data: qualityHistory, error: qualityError } = await supabase
        .from('data_quality_history')
        .select('created_at, overall_completeness, high_fit_accounts, total_accounts')
        .eq('org_id', userProfile.org_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (qualityError) throw qualityError;

      // Get pipeline stages for velocity
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('pipeline_stages')
        .select('entered_at, exited_at, stage')
        .eq('org_id', userProfile.org_id)
        .gte('entered_at', startDate.toISOString())
        .order('entered_at', { ascending: true });

      if (pipelineError) throw pipelineError;

      // Process score trends
      const scoreTrends = {
        overall: [] as TrendPoint[],
        fit: [] as TrendPoint[],
        intent: [] as TrendPoint[],
        reachability: [] as TrendPoint[],
      };

      const scoresByDate = new Map<string, { overall: number[], fit: number[], intent: number[], reachability: number[] }>();
      
      scoreHistory?.forEach(record => {
        const date = new Date(record.computed_at).toISOString().slice(0, 10);
        if (!scoresByDate.has(date)) {
          scoresByDate.set(date, { overall: [], fit: [], intent: [], reachability: [] });
        }
        const scores = scoresByDate.get(date)!;
        if (record.new_score && typeof record.new_score === 'object') {
          const score = record.new_score as any;
          if (score.overall) scores.overall.push(Number(score.overall));
          if (score.fit) scores.fit.push(Number(score.fit));
          if (score.intent) scores.intent.push(Number(score.intent));
          if (score.reachability) scores.reachability.push(Number(score.reachability));
        }
      });

      scoresByDate.forEach((scores, date) => {
        if (scores.overall.length > 0) {
          scoreTrends.overall.push({ date, value: scores.overall.reduce((a, b) => a + b, 0) / scores.overall.length });
        }
        if (scores.fit.length > 0) {
          scoreTrends.fit.push({ date, value: scores.fit.reduce((a, b) => a + b, 0) / scores.fit.length });
        }
        if (scores.intent.length > 0) {
          scoreTrends.intent.push({ date, value: scores.intent.reduce((a, b) => a + b, 0) / scores.intent.length });
        }
        if (scores.reachability.length > 0) {
          scoreTrends.reachability.push({ date, value: scores.reachability.reduce((a, b) => a + b, 0) / scores.reachability.length });
        }
      });

      // Process data quality trends
      const dataQualityTrends: TrendPoint[] = qualityHistory?.map(record => ({
        date: new Date(record.created_at).toISOString().slice(0, 10),
        value: Number(record.overall_completeness) || 0,
      })) || [];

      // Process ICP match rate trends
      const icpMatchRateTrends: TrendPoint[] = qualityHistory?.map(record => ({
        date: new Date(record.created_at).toISOString().slice(0, 10),
        value: record.total_accounts > 0 
          ? (record.high_fit_accounts / record.total_accounts) * 100 
          : 0,
      })) || [];

      // Process pipeline velocity trends (avg days to close)
      const velocityByDate = new Map<string, number[]>();
      
      pipelineData?.forEach(record => {
        if (record.exited_at && record.stage === 'closed_won') {
          const date = new Date(record.entered_at).toISOString().slice(0, 10);
          const daysToClose = (new Date(record.exited_at).getTime() - new Date(record.entered_at).getTime()) / (1000 * 60 * 60 * 24);
          if (!velocityByDate.has(date)) {
            velocityByDate.set(date, []);
          }
          velocityByDate.get(date)!.push(daysToClose);
        }
      });

      const pipelineVelocityTrends: TrendPoint[] = Array.from(velocityByDate.entries()).map(([date, days]) => ({
        date,
        value: days.reduce((a, b) => a + b, 0) / days.length,
      }));

      setMetrics({
        scoreTrends,
        dataQualityTrends,
        icpMatchRateTrends,
        pipelineVelocityTrends,
      });
    } catch (err: any) {
      console.error('Error loading trend data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.org_id) {
      loadTrendData();
    }
  }, [userProfile?.org_id, days]);

  return {
    metrics,
    isLoading,
    error,
    refresh: loadTrendData,
  };
}

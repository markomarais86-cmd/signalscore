import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface Benchmark {
  id: string;
  org_id: string;
  metric_type: string;
  stage: string;
  benchmark_value: number;
  industry: string;
  created_at: string;
  updated_at: string;
}

// Default benchmarks if org hasn't configured any
const DEFAULT_PIPELINE_BENCHMARKS: Record<string, number> = {
  dial: 100,
  connect: 25,
  meeting: 40,
  opportunity: 50,
  closed_won: 30,
};

const DEFAULT_CAPITAL_BENCHMARKS: Record<string, number> = {
  pipeline_multiplier: 3.0,
  revenue_multiplier: 2.0,
  cac_payback_months: 15,
};

export function useBenchmarks(metricType?: string) {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: benchmarks, isLoading, isPending, error, refetch } = useQuery({
    queryKey: ['org-benchmarks', userProfile?.org_id, metricType],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      
      let query = supabase
        .from('org_benchmarks')
        .select('*')
        .eq('org_id', userProfile.org_id);
      
      if (metricType) {
        query = query.eq('metric_type', metricType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as Benchmark[];
    },
    enabled: !!userProfile?.org_id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get pipeline benchmarks as a record
  const getPipelineBenchmarks = (): Record<string, number> => {
    if (!benchmarks?.length) return DEFAULT_PIPELINE_BENCHMARKS;
    
    const pipelineBenchmarks = benchmarks.filter(b => b.metric_type === 'pipeline_conversion');
    if (pipelineBenchmarks.length === 0) return DEFAULT_PIPELINE_BENCHMARKS;
    
    return pipelineBenchmarks.reduce((acc, b) => {
      acc[b.stage] = b.benchmark_value;
      return acc;
    }, {} as Record<string, number>);
  };

  // Get capital benchmarks as a record
  const getCapitalBenchmarks = (): Record<string, number> => {
    if (!benchmarks?.length) return DEFAULT_CAPITAL_BENCHMARKS;
    
    const capitalBenchmarks = benchmarks.filter(b => b.metric_type === 'capital_efficiency');
    if (capitalBenchmarks.length === 0) return DEFAULT_CAPITAL_BENCHMARKS;
    
    return capitalBenchmarks.reduce((acc, b) => {
      acc[b.stage] = b.benchmark_value;
      return acc;
    }, {} as Record<string, number>);
  };

  // Mutation to update a benchmark
  const updateBenchmark = useMutation({
    mutationFn: async ({ stage, value, metricType: mt }: { stage: string; value: number; metricType: string }) => {
      if (!userProfile?.org_id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('org_benchmarks')
        .upsert({
          org_id: userProfile.org_id,
          metric_type: mt,
          stage,
          benchmark_value: value,
          industry: '',
        }, {
          onConflict: 'org_id,metric_type,stage,industry',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-benchmarks'] });
    },
  });

  // Mutation to seed default benchmarks
  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!userProfile?.org_id) throw new Error('No organization');
      
      const { error } = await supabase.rpc('seed_default_benchmarks', {
        p_org_id: userProfile.org_id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-benchmarks'] });
    },
  });

  // Delete a benchmark (resets to default)
  const deleteBenchmark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('org_benchmarks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-benchmarks'] });
    },
  });

  return {
    benchmarks: benchmarks || [],
    pipelineBenchmarks: getPipelineBenchmarks(),
    capitalBenchmarks: getCapitalBenchmarks(),
    isLoading,
    isPending,
    error: error?.message || null,
    refetch,
    updateBenchmark,
    seedDefaults,
    deleteBenchmark,
    hasCustomBenchmarks: (benchmarks?.length || 0) > 0,
  };
}

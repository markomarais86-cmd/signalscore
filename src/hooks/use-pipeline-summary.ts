import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export interface PipelineSummary {
  id: string;
  summary_type: string;
  summary_text: string;
  key_insights: string[];
  metrics_snapshot: Record<string, number | string>;
  recommended_actions: string[];
  risks: string[];
  opportunities: string[];
  generated_at: string;
  created_at: string;
}

interface UsePipelineSummaryOptions {
  summaryType?: 'daily' | 'weekly' | 'monthly';
  enabled?: boolean;
}

export function usePipelineSummary(options: UsePipelineSummaryOptions = {}) {
  const { userProfile } = useAuth();
  const { summaryType = 'daily', enabled = true } = options;
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['pipelineSummary', orgId, summaryType],
    queryFn: async (): Promise<PipelineSummary | null> => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('pipeline_summaries')
        .select('*')
        .eq('org_id', orgId)
        .eq('summary_type', summaryType)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          key_insights: Array.isArray(data.key_insights) ? data.key_insights : [],
          metrics_snapshot: typeof data.metrics_snapshot === 'object' ? data.metrics_snapshot as Record<string, number | string> : {},
          recommended_actions: Array.isArray(data.recommended_actions) ? data.recommended_actions : [],
          risks: Array.isArray(data.risks) ? data.risks : [],
          opportunities: Array.isArray(data.opportunities) ? data.opportunities : [],
        } as PipelineSummary;
      }
      
      return null;
    },
    enabled: enabled && !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useGeneratePipelineSummary() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (summaryType: string = 'daily') => {
      const { data, error } = await supabase.functions.invoke('generate-pipeline-summary', {
        body: {
          orgId: userProfile?.org_id,
          summaryType,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelineSummary'] });
      toast({
        title: 'Summary Generated',
        description: 'New pipeline summary has been generated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

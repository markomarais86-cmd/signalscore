import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export interface RepPerformance {
  id: string;
  user_id: string;
  user_name: string | null;
  period_start: string;
  period_end: string;
  deals_won: number;
  deals_lost: number;
  win_rate: number;
  total_revenue: number;
  avg_deal_size: number;
  avg_sales_cycle_days: number;
  calls_made: number;
  emails_sent: number;
  meetings_held: number;
  talk_ratio: number | null;
  sentiment_avg: number | null;
  strengths: string[];
  areas_for_improvement: string[];
  created_at: string;
}

export interface CoachingRecommendation {
  id: string;
  user_id: string;
  topic: string;
  recommendation: string;
  category: string | null;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  evidence: Record<string, unknown> | null;
  best_practice_source: string | null;
  example_call_id: string | null;
  completed_at: string | null;
  created_at: string;
}

interface UseRepPerformanceOptions {
  userId?: string;
  enabled?: boolean;
}

export function useRepPerformance(options: UseRepPerformanceOptions = {}) {
  const { userProfile } = useAuth();
  const { userId, enabled = true } = options;
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['repPerformance', orgId, userId],
    queryFn: async (): Promise<RepPerformance[]> => {
      if (!orgId) return [];

      let query = supabase
        .from('rep_performance')
        .select('*')
        .eq('org_id', orgId)
        .order('period_end', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        strengths: Array.isArray(item.strengths) ? item.strengths : [],
        areas_for_improvement: Array.isArray(item.areas_for_improvement) ? item.areas_for_improvement : [],
      })) as RepPerformance[];
    },
    enabled: enabled && !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoachingRecommendations(options: { userId?: string; status?: string } = {}) {
  const { userProfile } = useAuth();
  const { userId, status } = options;
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['coachingRecommendations', orgId, userId, status],
    queryFn: async (): Promise<CoachingRecommendation[]> => {
      if (!orgId) return [];

      let query = supabase
        .from('coaching_recommendations')
        .select('*')
        .eq('org_id', orgId)
        .order('priority', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return (data || []) as CoachingRecommendation[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateRecommendationStatus() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recommendationId, status }: { recommendationId: string; status: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('coaching_recommendations')
        .update(updateData)
        .eq('id', recommendationId)
        .eq('org_id', userProfile?.org_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachingRecommendations'] });
      toast({
        title: 'Status Updated',
        description: 'Recommendation status has been updated.',
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

export function useGenerateCoachingInsights() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId?: string) => {
      const { data, error } = await supabase.functions.invoke('generate-coaching-insights', {
        body: {
          orgId: userProfile?.org_id,
          userId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachingRecommendations'] });
      queryClient.invalidateQueries({ queryKey: ['repPerformance'] });
      toast({
        title: 'Coaching Insights Generated',
        description: 'New coaching recommendations have been generated.',
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export interface NextBestAction {
  id: string;
  account_external_id: string | null;
  lead_id: number | null;
  deal_id: string | null;
  action_type: string;
  action_title: string;
  action_description: string | null;
  priority_score: number;
  reasoning: string | null;
  suggested_script: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  outcome: string | null;
  account_name?: string | null;
  lead_name?: string | null;
}

interface UseNextBestActionsOptions {
  status?: 'pending' | 'completed' | 'dismissed' | 'expired';
  limit?: number;
  enabled?: boolean;
}

export function useNextBestActions(options: UseNextBestActionsOptions = {}) {
  const { userProfile } = useAuth();
  const { status = 'pending', limit = 20, enabled = true } = options;
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['nextBestActions', orgId, status, limit],
    queryFn: async (): Promise<NextBestAction[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('next_best_actions')
        .select(`
          *,
          accounts:account_external_id (name),
          Leads:lead_id (first_name, last_name)
        `)
        .eq('org_id', orgId)
        .eq('status', status)
        .order('priority_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        account_name: item.accounts?.name || null,
        lead_name: item.Leads ? `${item.Leads.first_name || ''} ${item.Leads.last_name || ''}`.trim() : null,
      }));
    },
    enabled: enabled && !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCompleteAction() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ actionId, outcome }: { actionId: string; outcome: string }) => {
      const { data, error } = await supabase.functions.invoke('complete-nba-action', {
        body: {
          orgId: userProfile?.org_id,
          actionId,
          outcome,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextBestActions'] });
      toast({
        title: 'Action Completed',
        description: 'The action has been marked as complete.',
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

export function useDismissAction() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason?: string }) => {
      const { error } = await supabase
        .from('next_best_actions')
        .update({
          status: 'dismissed',
          outcome: reason || 'Dismissed by user',
          completed_at: new Date().toISOString(),
          completed_by: userProfile?.user_id,
        })
        .eq('id', actionId)
        .eq('org_id', userProfile?.org_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextBestActions'] });
      toast({
        title: 'Action Dismissed',
        description: 'The action has been dismissed.',
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

export function useGenerateActions() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (accountExternalId?: string) => {
      const { data, error } = await supabase.functions.invoke('generate-next-best-action', {
        body: {
          orgId: userProfile?.org_id,
          accountExternalId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextBestActions'] });
      toast({
        title: 'Actions Generated',
        description: 'New recommended actions have been generated.',
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export const DEAL_STAGES = [
  { key: 'qualified', label: 'Qualified', probability: 20, color: 'bg-blue-500' },
  { key: 'demo', label: 'Demo', probability: 40, color: 'bg-indigo-500' },
  { key: 'proposal', label: 'Proposal', probability: 60, color: 'bg-violet-500' },
  { key: 'negotiation', label: 'Negotiation', probability: 80, color: 'bg-amber-500' },
  { key: 'closed_won', label: 'Closed Won', probability: 100, color: 'bg-green-500' },
  { key: 'closed_lost', label: 'Closed Lost', probability: 0, color: 'bg-red-500' },
] as const;

export const LOSS_CATEGORIES = [
  { key: 'budget', label: 'Budget / Price' },
  { key: 'timing', label: 'Timing / Not Ready' },
  { key: 'competition', label: 'Lost to Competition' },
  { key: 'no_decision', label: 'No Decision Made' },
  { key: 'product_fit', label: 'Product Fit' },
  { key: 'champion_left', label: 'Champion Left' },
  { key: 'other', label: 'Other' },
] as const;

export interface Deal {
  id: string;
  org_id: string;
  name: string;
  amount: number | null;
  stage: string;
  status: string;
  expected_close_date: string | null;
  closed_date: string | null;
  loss_reason: string | null;
  loss_category: string | null;
  win_reason: string | null;
  owner_name: string | null;
  owner_id: string | null;
  account_external_id: string | null;
  marketing_lead_id: string | null;
  attribution_utm: Record<string, string> | null;
  attribution_click_ids: Record<string, string> | null;
  attribution_funnel_variant: string | null;
  source: string | null;
  probability: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface StageHistory {
  id: string;
  deal_id: string;
  stage: string;
  entered_at: string;
  exited_at: string | null;
}

export function useOpportunities(stage?: string) {
  const { effectiveOrgId: orgId } = useEffectiveOrg();

  return useQuery({
    queryKey: ['opportunities', orgId, stage],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('deals')
        .select('*')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false });

      if (stage) {
        query = query.eq('stage', stage);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Deal[];
    },
    enabled: !!orgId,
  });
}

export function useDealStageHistory(dealId: string | null) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['dealStageHistory', dealId],
    queryFn: async () => {
      if (!orgId || !dealId) return [];
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', dealId)
        .order('entered_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StageHistory[];
    },
    enabled: !!orgId && !!dealId,
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, stage, winReason, lossCategory, lossReason }: {
      dealId: string;
      stage: string;
      winReason?: string;
      lossCategory?: string;
      lossReason?: string;
    }) => {
      const update: Record<string, any> = { stage };
      if (stage === 'closed_won' && winReason) update.win_reason = winReason;
      if (stage === 'closed_lost') {
        if (lossCategory) update.loss_category = lossCategory;
        if (lossReason) update.loss_reason = lossReason;
      }
      // Set probability based on stage
      const stageConfig = DEAL_STAGES.find(s => s.key === stage);
      if (stageConfig) update.probability = stageConfig.probability;

      const { error } = await supabase.from('deals').update(update).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['dealStageHistory'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal stage updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update deal: ${err.message}`);
    },
  });
}

export function useCreateDeal() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deal: {
      name: string;
      amount?: number;
      stage?: string;
      expected_close_date?: string;
      owner_name?: string;
      marketing_lead_id?: string;
      attribution_utm?: Record<string, string>;
      attribution_click_ids?: Record<string, string>;
      attribution_funnel_variant?: string;
      source?: string;
    }) => {
      if (!userProfile?.org_id) throw new Error('No organization');
      const { error } = await supabase.from('deals').insert({
        org_id: userProfile.org_id,
        name: deal.name,
        amount: deal.amount || null,
        stage: deal.stage || 'qualified',
        status: 'open',
        expected_close_date: deal.expected_close_date || null,
        owner_name: deal.owner_name || null,
        marketing_lead_id: deal.marketing_lead_id || null,
        attribution_utm: deal.attribution_utm || {},
        attribution_click_ids: deal.attribution_click_ids || {},
        attribution_funnel_variant: deal.attribution_funnel_variant || null,
        source: deal.source || null,
        probability: 20,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('Deal created');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create deal: ${err.message}`);
    },
  });
}

export function useRevenueAttribution() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ['revenueAttribution', orgId],
    queryFn: async () => {
      if (!orgId) return { bySource: [], byUtmCampaign: [], byVariant: [] };

      // Get all won deals with attribution data
      const { data: wonDeals, error } = await supabase
        .from('deals')
        .select('amount, source, attribution_utm, attribution_click_ids, attribution_funnel_variant')
        .eq('org_id', orgId)
        .eq('status', 'won');

      if (error) throw error;
      const deals = wonDeals || [];

      // Group by source
      const sourceMap = new Map<string, { count: number; value: number }>();
      deals.forEach(d => {
        const src = d.source || 'Unknown';
        const existing = sourceMap.get(src) || { count: 0, value: 0 };
        existing.count++;
        existing.value += Number(d.amount) || 0;
        sourceMap.set(src, existing);
      });

      // Group by UTM campaign
      const campaignMap = new Map<string, { count: number; value: number }>();
      deals.forEach(d => {
        const utm = d.attribution_utm as Record<string, string> | null;
        const campaign = utm?.utm_campaign || 'No Campaign';
        const existing = campaignMap.get(campaign) || { count: 0, value: 0 };
        existing.count++;
        existing.value += Number(d.amount) || 0;
        campaignMap.set(campaign, existing);
      });

      // Group by funnel variant
      const variantMap = new Map<string, { count: number; value: number }>();
      deals.forEach(d => {
        const variant = d.attribution_funnel_variant || 'No Variant';
        const existing = variantMap.get(variant) || { count: 0, value: 0 };
        existing.count++;
        existing.value += Number(d.amount) || 0;
        variantMap.set(variant, existing);
      });

      const toArray = (map: Map<string, { count: number; value: number }>) =>
        Array.from(map.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.value - a.value);

      return {
        bySource: toArray(sourceMap),
        byUtmCampaign: toArray(campaignMap),
        byVariant: toArray(variantMap),
        totalWonValue: deals.reduce((s, d) => s + (Number(d.amount) || 0), 0),
        totalWonCount: deals.length,
      };
    },
    enabled: !!orgId,
  });
}

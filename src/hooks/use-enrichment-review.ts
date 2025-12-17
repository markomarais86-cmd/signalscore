import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

export interface PendingEnrichment {
  id: string;
  account_external_id: string;
  account_name: string | null;
  provider: string;
  enrichment_type: string;
  data_before: Record<string, any> | null;
  data_after: Record<string, any> | null;
  fields_enriched: string[] | null;
  confidence: number | null;
  created_at: string;
  status: string;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  confidence: number;
}

export type FeedbackDecision = 'accepted' | 'rejected' | 'modified';

export function useEnrichmentReview() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending AI enrichments that need review
  const { data: pendingEnrichments, isLoading, refetch } = useQuery({
    queryKey: ['pending-enrichments', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];

      // Get enrichments from AI providers that haven't been reviewed
      const { data: enrichments, error } = await supabase
        .from('enrichment_history')
        .select(`
          id,
          account_external_id,
          provider,
          enrichment_type,
          data_before,
          data_after,
          fields_enriched,
          created_at,
          status
        `)
        .eq('org_id', userProfile.org_id)
        .in('provider', ['ai', 'openai', 'perplexity', 'gemini', 'free-ai'])
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get account names
      const accountIds = [...new Set(enrichments?.map(e => e.account_external_id) || [])];
      const { data: accounts } = await supabase
        .from('accounts')
        .select('external_id, name, enrichment_confidence')
        .eq('org_id', userProfile.org_id)
        .in('external_id', accountIds);

      const accountMap = new Map(accounts?.map(a => [a.external_id, a]) || []);

      return enrichments?.map(e => ({
        ...e,
        account_name: accountMap.get(e.account_external_id)?.name || e.account_external_id,
        confidence: accountMap.get(e.account_external_id)?.enrichment_confidence || null,
      })) as PendingEnrichment[];
    },
    enabled: !!userProfile?.org_id,
  });

  // Submit feedback for an enrichment
  const submitFeedback = useMutation({
    mutationFn: async ({
      enrichmentId,
      accountExternalId,
      decision,
      fieldChanges,
      feedbackNotes,
    }: {
      enrichmentId: string;
      accountExternalId: string;
      decision: FeedbackDecision;
      fieldChanges: FieldChange[];
      feedbackNotes?: string;
    }) => {
      if (!userProfile?.org_id) throw new Error('No org');

      // Record feedback
      const { error: feedbackError } = await supabase
        .from('ai_agent_feedback')
        .insert({
          org_id: userProfile.org_id,
          account_id: accountExternalId,
          decision_type: 'enrichment_review',
          outcome: decision,
          outcome_at: new Date().toISOString(),
          feedback_notes: feedbackNotes,
          confidence_score: fieldChanges[0]?.confidence || null,
          context_data: {
            enrichment_id: enrichmentId,
            fields_reviewed: fieldChanges.map(f => f.field),
            changes_applied: decision !== 'rejected',
          },
        });

      if (feedbackError) throw feedbackError;

      // If accepted or modified, update the account
      if (decision === 'accepted' || decision === 'modified') {
        const updateData: Record<string, any> = {};
        
        for (const change of fieldChanges) {
          if (decision === 'accepted') {
            updateData[change.field] = change.newValue;
          }
          // For modified, the newValue is already the user's edited value
          if (decision === 'modified') {
            updateData[change.field] = change.newValue;
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('org_id', userProfile.org_id)
            .eq('external_id', accountExternalId);

          if (updateError) throw updateError;
        }
      }

      // Update enrichment status
      const { error: statusError } = await supabase
        .from('enrichment_history')
        .update({ status: decision === 'rejected' ? 'rejected' : 'completed' })
        .eq('id', enrichmentId);

      if (statusError) throw statusError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-enrichments'] });
      toast({
        title: 'Feedback submitted',
        description: 'Your review has been recorded.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to submit feedback.',
        variant: 'destructive',
      });
    },
  });

  // Bulk accept high-confidence enrichments
  const bulkAccept = useMutation({
    mutationFn: async (enrichmentIds: string[]) => {
      if (!userProfile?.org_id) throw new Error('No org');

      for (const id of enrichmentIds) {
        const enrichment = pendingEnrichments?.find(e => e.id === id);
        if (!enrichment) continue;

        const fieldChanges: FieldChange[] = (enrichment.fields_enriched || []).map(field => ({
          field,
          oldValue: enrichment.data_before?.[field],
          newValue: enrichment.data_after?.[field],
          confidence: enrichment.confidence || 0,
        }));

        await submitFeedback.mutateAsync({
          enrichmentId: id,
          accountExternalId: enrichment.account_external_id,
          decision: 'accepted',
          fieldChanges,
        });
      }
    },
  });

  return {
    pendingEnrichments: pendingEnrichments || [],
    isLoading,
    refetch,
    submitFeedback,
    bulkAccept,
    pendingCount: pendingEnrichments?.length || 0,
  };
}

// Helper to extract field changes from enrichment data
export function extractFieldChanges(enrichment: PendingEnrichment): FieldChange[] {
  const changes: FieldChange[] = [];
  const fields = enrichment.fields_enriched || [];

  for (const field of fields) {
    const oldValue = enrichment.data_before?.[field];
    const newValue = enrichment.data_after?.[field];

    if (oldValue !== newValue) {
      changes.push({
        field,
        oldValue,
        newValue,
        confidence: enrichment.confidence || 0.5,
      });
    }
  }

  return changes;
}

// Field display names
export const fieldDisplayNames: Record<string, string> = {
  employee_count: 'Employee Count',
  revenue_range: 'Revenue Range',
  industry_norm: 'Industry',
  sub_industry: 'Sub-Industry',
  tech_stack: 'Tech Stack',
  total_raised_usd: 'Total Funding',
  last_funding_round: 'Last Funding Round',
  last_funding_date: 'Last Funding Date',
  founded_year: 'Founded Year',
  business_model: 'Business Model',
  hq_city: 'HQ City',
  hq_state: 'HQ State',
  country: 'Country',
  linkedin_url: 'LinkedIn',
  twitter_url: 'Twitter',
};

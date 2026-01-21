import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EnrichmentConfig {
  skipPaidProviders?: boolean;
  maxCost?: number;
  verifyEmail?: boolean;
  includeWebScrape?: boolean;
}

export interface EnrichmentSummary {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  remaining: number;
  totalCost: number;
  avgConfidence: number;
}

export interface SourceBreakdown {
  [provider: string]: {
    attempted: number;
    enriched: number;
    cost: number;
  };
}

export interface UnifiedEnrichmentResult {
  success: boolean;
  job_id: string;
  status: 'processing' | 'completed' | 'paused' | 'failed';
  summary: EnrichmentSummary;
  source_breakdown: SourceBreakdown;
  error?: string;
}

interface UseUnifiedEnrichmentOptions {
  onProgress?: (summary: EnrichmentSummary) => void;
  onComplete?: (result: UnifiedEnrichmentResult) => void;
  onError?: (error: string) => void;
}

export function useUnifiedEnrichment(options: UseUnifiedEnrichmentOptions = {}) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState<EnrichmentSummary | null>(null);
  const [result, setResult] = useState<UnifiedEnrichmentResult | null>(null);
  const { toast } = useToast();

  const enrichAccounts = useCallback(async (
    orgId: string,
    records: Array<{
      external_id: string;
      name?: string;
      domain?: string;
      industry_norm?: string;
      industry_raw?: string;
      employee_count?: number;
      revenue_range?: string;
      country?: string;
      state_province?: string;
      city?: string;
    }>,
    config?: EnrichmentConfig
  ): Promise<UnifiedEnrichmentResult | null> => {
    setIsEnriching(true);
    setProgress(null);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-unified', {
        body: {
          org_id: orgId,
          record_type: 'account',
          records,
          config: config || {},
        },
      });

      if (error) throw error;

      const enrichmentResult = data as UnifiedEnrichmentResult;
      setResult(enrichmentResult);
      setProgress(enrichmentResult.summary);

      if (enrichmentResult.success) {
        options.onComplete?.(enrichmentResult);
        toast({
          title: 'Enrichment Complete',
          description: `Enriched ${enrichmentResult.summary.enriched} of ${enrichmentResult.summary.total} accounts`,
        });
      }

      return enrichmentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Enrichment failed';
      options.onError?.(errorMessage);
      toast({
        title: 'Enrichment Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsEnriching(false);
    }
  }, [options, toast]);

  const enrichLeads = useCallback(async (
    orgId: string,
    records: Array<{
      id: number;
      first_name?: string;
      last_name?: string;
      name?: string;
      email?: string;
      phone?: string;
      mobile?: string;
      title?: string;
      linkedin_url?: string;
      company?: string;
      domain?: string;
      website?: string;
    }>,
    config?: EnrichmentConfig
  ): Promise<UnifiedEnrichmentResult | null> => {
    setIsEnriching(true);
    setProgress(null);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-unified', {
        body: {
          org_id: orgId,
          record_type: 'lead',
          records,
          config: config || {},
        },
      });

      if (error) throw error;

      const enrichmentResult = data as UnifiedEnrichmentResult;
      setResult(enrichmentResult);
      setProgress(enrichmentResult.summary);

      if (enrichmentResult.success) {
        options.onComplete?.(enrichmentResult);
        toast({
          title: 'Enrichment Complete',
          description: `Enriched ${enrichmentResult.summary.enriched} of ${enrichmentResult.summary.total} leads`,
        });
      }

      return enrichmentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Enrichment failed';
      options.onError?.(errorMessage);
      toast({
        title: 'Enrichment Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsEnriching(false);
    }
  }, [options, toast]);

  const reset = useCallback(() => {
    setIsEnriching(false);
    setProgress(null);
    setResult(null);
  }, []);

  return {
    isEnriching,
    progress,
    result,
    enrichAccounts,
    enrichLeads,
    reset,
  };
}

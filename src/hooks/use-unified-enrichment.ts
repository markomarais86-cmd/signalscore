import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EnrichmentConfig {
  skipPaidProviders?: boolean;
  maxCost?: number;
  verifyEmail?: boolean;
  includeWebScrape?: boolean;
  discoverPhone?: boolean;
  
  // Full-field enrichment options (NEW)
  aggregateProviders?: boolean;      // Call all AI providers and merge results (default: true)
  preferredProvider?: string;        // Try this provider first: 'perplexity' | 'anthropic' | 'xai' | 'lovable' | 'openai' | 'abacus'
  forceAllStages?: boolean;          // Run PDL/Apollo even if some data exists (default: false)
  fieldsToEnrich?: string[];         // Specific fields to target (empty = all 20+ fields)
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
      const CHUNK_SIZE = 100;
      const chunks: typeof records[] = [];
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        chunks.push(records.slice(i, i + CHUNK_SIZE));
      }

      const aggregated: EnrichmentSummary = {
        total: records.length,
        processed: 0,
        enriched: 0,
        failed: 0,
        remaining: records.length,
        totalCost: 0,
        avgConfidence: 0,
      };
      let lastResult: UnifiedEnrichmentResult | null = null;
      let totalConfidenceSum = 0;

      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('enrich-unified', {
          body: {
            org_id: orgId,
            record_type: 'account',
            records: chunk,
            config: config || {},
          },
        });

        if (error) throw error;

        const chunkResult = data as UnifiedEnrichmentResult;
        lastResult = chunkResult;

        aggregated.processed += chunkResult.summary.processed;
        aggregated.enriched += chunkResult.summary.enriched;
        aggregated.failed += chunkResult.summary.failed;
        aggregated.remaining = aggregated.total - aggregated.processed;
        aggregated.totalCost += chunkResult.summary.totalCost;
        totalConfidenceSum += chunkResult.summary.avgConfidence * chunkResult.summary.processed;
        aggregated.avgConfidence = aggregated.processed > 0
          ? totalConfidenceSum / aggregated.processed
          : 0;

        setProgress({ ...aggregated });
        options.onProgress?.(aggregated);
      }

      const finalResult: UnifiedEnrichmentResult = {
        success: true,
        job_id: lastResult?.job_id || '',
        status: 'completed',
        summary: aggregated,
        source_breakdown: lastResult?.source_breakdown || {},
      };
      setResult(finalResult);

      options.onComplete?.(finalResult);
      toast({
        title: 'Enrichment Complete',
        description: `Enriched ${aggregated.enriched} of ${aggregated.total} accounts`,
      });

      return finalResult;
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
      const CHUNK_SIZE = 100;
      const chunks: typeof records[] = [];
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        chunks.push(records.slice(i, i + CHUNK_SIZE));
      }

      const aggregated: EnrichmentSummary = {
        total: records.length,
        processed: 0,
        enriched: 0,
        failed: 0,
        remaining: records.length,
        totalCost: 0,
        avgConfidence: 0,
      };
      let lastResult: UnifiedEnrichmentResult | null = null;
      let totalConfidenceSum = 0;

      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('enrich-unified', {
          body: {
            org_id: orgId,
            record_type: 'lead',
            records: chunk,
            config: config || {},
          },
        });

        if (error) throw error;

        const chunkResult = data as UnifiedEnrichmentResult;
        lastResult = chunkResult;

        aggregated.processed += chunkResult.summary.processed;
        aggregated.enriched += chunkResult.summary.enriched;
        aggregated.failed += chunkResult.summary.failed;
        aggregated.remaining = aggregated.total - aggregated.processed;
        aggregated.totalCost += chunkResult.summary.totalCost;
        totalConfidenceSum += chunkResult.summary.avgConfidence * chunkResult.summary.processed;
        aggregated.avgConfidence = aggregated.processed > 0
          ? totalConfidenceSum / aggregated.processed
          : 0;

        setProgress({ ...aggregated });
        options.onProgress?.(aggregated);
      }

      const finalResult: UnifiedEnrichmentResult = {
        success: true,
        job_id: lastResult?.job_id || '',
        status: 'completed',
        summary: aggregated,
        source_breakdown: lastResult?.source_breakdown || {},
      };
      setResult(finalResult);

      options.onComplete?.(finalResult);
      toast({
        title: 'Enrichment Complete',
        description: `Enriched ${aggregated.enriched} of ${aggregated.total} leads`,
      });

      return finalResult;
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

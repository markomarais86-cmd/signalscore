import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SourceBreakdown {
  internal_matches?: number;
  apollo_enriched?: number;
  pdl_enriched?: number;
  ai_enriched?: number;
  multi_agent_enriched?: number;
  failed?: number;
}

export interface EnrichmentProgress {
  id: string;
  status: string;
  progress_percentage: number;
  processed_records: number;
  total_records: number;
  enriched_records: number;
  failed_records: number;
  current_batch: number;
  total_batches: number;
  estimated_completion_at: string | null;
  started_at: string | null;
  can_pause: boolean;
  paused_at: string | null;
  error_message: string | null;
  last_heartbeat: string | null;
  source_breakdown: SourceBreakdown | null;
}

export function useEnrichmentProgress(jobId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['enrichment-progress', jobId],
    queryFn: async (): Promise<EnrichmentProgress | null> => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      if (!data) return null;
      
      // Map database fields to EnrichmentProgress interface
      const totalRecords = data.total_records || 0;
      const processedRecords = data.processed_records || 0;
      const progressPercentage = totalRecords > 0 
        ? Math.round((processedRecords / totalRecords) * 100) 
        : 0;
      
      return {
        id: data.id,
        status: data.status || 'pending',
        progress_percentage: progressPercentage,
        processed_records: processedRecords,
        total_records: totalRecords,
        // Use rows_completed/rows_failed which the edge function updates
        enriched_records: data.rows_completed || data.enriched_records || 0,
        failed_records: data.rows_failed || data.failed_records || 0,
        current_batch: data.current_batch || 0,
        total_batches: data.total_batches || 0,
        estimated_completion_at: null, // Calculated on the fly if needed
        started_at: data.started_at,
        can_pause: data.status === 'processing',
        paused_at: data.paused_at,
        error_message: data.error_message,
        last_heartbeat: data.last_heartbeat,
        source_breakdown: (data.source_breakdown as SourceBreakdown) || null
      };
    },
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      // Stop polling if job is completed or failed
      const data = query.state.data;
      if (!data || ['completed', 'failed', 'cancelled'].includes(data.status)) {
        return false;
      }
      // Poll every 2 seconds for running jobs
      return 2000;
    },
  });
}

export async function pauseEnrichmentJob(jobId: string) {
  // Direct update since we may not have the RPC
  const { error } = await supabase
    .from('enrichment_jobs')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) throw error;
  return true;
}

export async function resumeEnrichmentJob(jobId: string) {
  // Update job status and invoke resume function
  const { error: updateError } = await supabase
    .from('enrichment_jobs')
    .update({
      status: 'processing',
      paused_at: null,
      last_heartbeat: new Date().toISOString()
    })
    .eq('id', jobId);

  if (updateError) throw updateError;

  // Try to invoke the resume function to restart processing
  try {
    await supabase.functions.invoke('resume-enrichment-job', {
      body: { job_id: jobId }
    });
  } catch (e) {
    console.warn('Resume function not available, job status updated:', e);
  }
  
  return true;
}

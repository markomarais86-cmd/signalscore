import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EnrichmentProgress {
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
}

export function useEnrichmentProgress(jobId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['enrichment-progress', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
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
  const { data, error } = await supabase.rpc('pause_enrichment_job', {
    p_job_id: jobId,
  });

  if (error) throw error;
  return data;
}

export async function resumeEnrichmentJob(jobId: string) {
  const { data, error } = await supabase.rpc('resume_enrichment_job', {
    p_job_id: jobId,
  });

  if (error) throw error;
  return data;
}

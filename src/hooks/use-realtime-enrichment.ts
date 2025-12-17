import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface EnrichmentJob {
  id: string;
  org_id: string;
  provider: string;
  job_type: string;
  status: string;
  progress_percentage: number | null;
  processed_records: number;
  total_records: number;
  enriched_records: number;
  failed_records: number;
  current_batch: number | null;
  total_batches: number | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  error_message: string | null;
  last_heartbeat: string | null;
  credits_used?: number;
  credits_remaining?: number;
  estimated_completion_at?: string | null;
  can_pause?: boolean;
}

interface UseRealtimeEnrichmentOptions {
  orgId: string | null;
  enabled?: boolean;
  onStatusChange?: (job: EnrichmentJob, previousStatus: string) => void;
  onComplete?: (job: EnrichmentJob) => void;
  onError?: (job: EnrichmentJob) => void;
}

export function useRealtimeEnrichment({
  orgId,
  enabled = true,
  onStatusChange,
  onComplete,
  onError,
}: UseRealtimeEnrichmentOptions) {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  // Fetch initial jobs
  const fetchJobs = useCallback(async () => {
    if (!orgId) return;

    const { data, error } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['pending', 'processing', 'paused'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setJobs(data as EnrichmentJob[]);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !enabled) return;

    // Initial fetch
    fetchJobs();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`enrichment-jobs-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const newJob = payload.new as EnrichmentJob;
          const oldJob = payload.old as EnrichmentJob | undefined;

          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [newJob, ...prev.slice(0, 9)]);
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((job) => (job.id === newJob.id ? newJob : job))
            );

            // Trigger callbacks
            if (oldJob && oldJob.status !== newJob.status) {
              onStatusChange?.(newJob, oldJob.status);

              if (newJob.status === 'completed') {
                onComplete?.(newJob);
                // Invalidate related queries
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
                queryClient.invalidateQueries({ queryKey: ['leads'] });
              } else if (newJob.status === 'failed') {
                onError?.(newJob);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((job) => job.id !== oldJob?.id));
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        console.log(`[Realtime] Enrichment jobs subscription: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [orgId, enabled, fetchJobs, onStatusChange, onComplete, onError, queryClient]);

  // Get active job (most recent processing/pending)
  const activeJob = jobs.find(
    (job) => job.status === 'processing' || job.status === 'pending'
  );

  // Get paused jobs
  const pausedJobs = jobs.filter((job) => job.status === 'paused');

  return {
    jobs,
    activeJob,
    pausedJobs,
    isConnected,
    refetch: fetchJobs,
  };
}

// Hook for subscribing to a specific job
export function useRealtimeJobProgress(jobId: string | null) {
  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    // Initial fetch
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!error && data) {
        setJob(data as EnrichmentJob);
      }
    };

    fetchJob();

    // Subscribe to this specific job
    const channel = supabase
      .channel(`enrichment-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as EnrichmentJob);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [jobId]);

  const progress = job
    ? {
        percentage: job.progress_percentage ?? 0,
        processed: job.processed_records ?? 0,
        total: job.total_records ?? 0,
        enriched: job.enriched_records ?? 0,
        failed: job.failed_records ?? 0,
        status: job.status,
        isActive: ['pending', 'processing'].includes(job.status),
        isPaused: job.status === 'paused',
        isComplete: job.status === 'completed',
        isFailed: job.status === 'failed',
      }
    : null;

  return {
    job,
    progress,
    isConnected,
  };
}

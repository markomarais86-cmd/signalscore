import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, CheckCircle2, XCircle, AlertCircle, Pause, Play, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeEnrichment, type EnrichmentJob } from "@/hooks/use-realtime-enrichment";
import { pauseEnrichmentJob, resumeEnrichmentJob } from "@/hooks/use-enrichment-progress";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { friendlyErrorMessage } from "@/lib/friendly-errors";

interface OrgCredits {
  total: number;
  used: number;
  remaining: number;
}

export function EnrichmentJobMonitor() {
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [orgCredits, setOrgCredits] = useState<OrgCredits | null>(null);
  const [pausingJobs, setPausingJobs] = useState<Set<string>>(new Set());
  const [resumingJobs, setResumingJobs] = useState<Set<string>>(new Set());
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
  const [startingJobs, setStartingJobs] = useState<Set<string>>(new Set());
  const { userProfile } = useAuth();

  // Use realtime enrichment hook for live updates
  const { 
    jobs: realtimeJobs, 
    refetch 
  } = useRealtimeEnrichment({
    orgId: userProfile?.org_id || null,
    enabled: !!userProfile?.org_id,
    onStatusChange: (job, oldStatus) => {
      if (job.status === 'completed' && oldStatus === 'processing') {
        toast.success(`Enrichment job completed`, {
          description: `${job.enriched_records} records enriched`
        });
      }
    },
    onError: (job) => {
      toast.error(`Enrichment job failed`, {
        description: job.error_message || 'Unknown error'
      });
    }
  });

  useEffect(() => {
    loadCredits();
    // Set loading to false after initial connection
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [userProfile?.org_id]);

  // Filter to active jobs only
  const activeJobs = realtimeJobs.filter(j => 
    ['pending', 'processing', 'paused', 'failed'].includes(j.status || '')
  );

  const loadCredits = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_org_enrichment_credits', { org_uuid: userProfile.org_id });

      if (!error && data && data.length > 0) {
        setOrgCredits(data[0]);
      }
    } catch (error) {
      console.error("Error loading credits:", error);
    }
  };

  const cleanupStuckJobs = async () => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_stuck_enrichment_jobs');
      
      if (error) throw error;
      
      const result = data as { cleaned_up: number; jobs: any[] };
      if (result.cleaned_up > 0) {
        toast.success(`Cleaned up ${result.cleaned_up} stuck job(s)`);
        refetch();
      } else {
        toast.info('No stuck jobs found to clean up');
      }
    } catch (error: any) {
      console.error('Error cleaning up stuck jobs:', error);
      toast.error('Failed to clean up stuck jobs');
    } finally {
      setCleaningUp(false);
    }
  };

  const calculateETR = (job: EnrichmentJob): string => {
    if (job.processed_records === 0 || job.status !== 'processing' || !job.started_at) {
      return 'Calculating...';
    }
    
    const elapsed = Date.now() - new Date(job.started_at).getTime();
    const rate = job.processed_records / (elapsed / 1000); // records per second
    const remaining = job.total_records - job.processed_records;
    const etrSeconds = remaining / rate;
    
    if (etrSeconds < 60) return `~${Math.round(etrSeconds)} seconds`;
    if (etrSeconds < 3600) return `~${Math.round(etrSeconds / 60)} minutes`;
    return `~${(etrSeconds / 3600).toFixed(1)} hours`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getProgress = (job: EnrichmentJob): number => {
    if (job.progress_percentage !== undefined && job.progress_percentage !== null) {
      return job.progress_percentage;
    }
    if (job.total_records === 0) return 0;
    return (job.processed_records / job.total_records) * 100;
  };

  const handlePause = async (jobId: string) => {
    setPausingJobs(prev => new Set(prev).add(jobId));
    try {
      await pauseEnrichmentJob(jobId);
      toast.success('Enrichment job paused');
      refetch();
    } catch (error) {
      toast.error('Failed to pause job');
      console.error('Pause error:', error);
    } finally {
      setPausingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleResume = async (jobId: string) => {
    setResumingJobs(prev => new Set(prev).add(jobId));
    try {
      await resumeEnrichmentJob(jobId);
      toast.success('Enrichment job resumed');
      refetch();
    } catch (error) {
      toast.error('Failed to resume job');
      console.error('Resume error:', error);
    } finally {
      setResumingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
    });
    }
  };

  const handleRetryFailed = async (jobId: string) => {
    setRetryingJobs(prev => new Set(prev).add(jobId));
    try {
      // Reset failed rows to pending
      const { error: resetError } = await supabase
        .from('enrichment_rows')
        .update({ status: 'pending', retry_count: 0, error_message: null })
        .eq('job_id', jobId)
        .eq('status', 'failed');

      if (resetError) throw resetError;

      // Update job status to processing
      const { error: updateError } = await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'processing', 
          error_message: null,
          started_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Trigger resume function
      await resumeEnrichmentJob(jobId);
      
      toast.success('Retrying failed enrichment rows');
      refetch();
    } catch (error) {
      toast.error('Failed to retry job');
      console.error('Retry error:', error);
    } finally {
      setRetryingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleStartJob = async (jobId: string) => {
    setStartingJobs(prev => new Set(prev).add(jobId));
    try {
      // Update job status to processing
      const { error: updateError } = await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'processing', 
          started_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Invoke the enrichment function
      const { error } = await supabase.functions.invoke('enrich-unified', {
        body: { jobId, batchSize: 100 }
      });

      if (error) throw error;

      toast.success('Enrichment job started');
      refetch();
    } catch (error) {
      toast.error('Failed to start job');
      console.error('Start error:', error);
    } finally {
      setStartingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeJobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Data Updates
          </CardTitle>
          <CardDescription>
            No updates currently in progress
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Data Updates
            </CardTitle>
            <CardDescription>
              Track your company data updates
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobs.map((job) => (
          <div key={job.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(job.status)}
                  <span className="font-medium capitalize">
                    {job.provider} - {job.job_type.replace(/_/g, ' ')}
                  </span>
                  <Badge variant={job.status === "processing" ? "default" : job.status === "paused" ? "outline" : "secondary"}>
                    {job.status}
                  </Badge>
                  {job.paused_at && (
                    <Badge variant="outline" className="gap-1">
                      <Pause className="h-3 w-3" />
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Started: {new Date(job.started_at).toLocaleString()}
                </div>
                {job.total_batches && job.total_batches > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Batch {job.current_batch || 0} of {job.total_batches}
                  </div>
                )}
              </div>
              <div className="text-right text-sm space-y-1">
                <div className="font-medium">
                  {job.processed_records.toLocaleString()} / {job.total_records.toLocaleString()}
                </div>
                <div className="text-muted-foreground">
                  {getProgress(job).toFixed(1)}%
                </div>
                {job.status === 'processing' && job.estimated_completion_at && (
                  <div className="text-muted-foreground flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(job.estimated_completion_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Progress value={getProgress(job)} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>✓ {job.enriched_records.toLocaleString()} enriched</span>
                <span>✗ {job.failed_records.toLocaleString()} failed</span>
              </div>
            </div>

            {job.credits_used !== undefined && (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Credits used: {job.credits_used.toLocaleString()} | 
                Remaining: {job.credits_remaining?.toLocaleString() || '—'}
              </div>
            )}

            {/* Pause/Resume Controls */}
            {job.can_pause && job.status === 'processing' && (
              <Button
                onClick={() => handlePause(job.id)}
                disabled={pausingJobs.has(job.id)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {pausingJobs.has(job.id) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pausing...
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Job
                  </>
                )}
              </Button>
            )}

            {/* Retry Failed Button */}
            {job.status === 'failed' && (
              <Button
                onClick={() => handleRetryFailed(job.id)}
                disabled={retryingJobs.has(job.id)}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                {retryingJobs.has(job.id) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry Failed Rows ({job.failed_records})
                  </>
                )}
              </Button>
            )}

            {/* Start Pending Job Button */}
            {job.status === 'pending' && (
              <Button
                onClick={() => handleStartJob(job.id)}
                disabled={startingJobs.has(job.id)}
                variant="default"
                size="sm"
                className="w-full"
              >
                {startingJobs.has(job.id) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Enrichment ({job.total_records.toLocaleString()} records)
                  </>
                )}
              </Button>
            )}

            {job.status === 'paused' && (
              <Button
                onClick={() => handleResume(job.id)}
                disabled={resumingJobs.has(job.id)}
                variant="default"
                size="sm"
                className="w-full"
              >
                {resumingJobs.has(job.id) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Job
                  </>
                )}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

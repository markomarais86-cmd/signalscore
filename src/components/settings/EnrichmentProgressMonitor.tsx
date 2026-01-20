import { useState, useEffect, useRef } from 'react';
import { useEnrichmentProgress, pauseEnrichmentJob, resumeEnrichmentJob } from '@/hooks/use-enrichment-progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, X, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface EnrichmentProgressMonitorProps {
  jobId: string;
  onClose?: () => void;
  onComplete?: (job: any) => void;
}

export function EnrichmentProgressMonitor({ jobId, onClose, onComplete }: EnrichmentProgressMonitorProps) {
  const { data: progress, isLoading } = useEnrichmentProgress(jobId, true);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const completedRef = useRef(false);

  // Call onComplete when job finishes
  useEffect(() => {
    if (progress && !completedRef.current) {
      if (progress.status === 'completed') {
        completedRef.current = true;
        const enrichedCount = progress.enriched_records || progress.processed_records || 0;
        toast.success(`Enrichment completed: ${enrichedCount} records enriched`);
        onComplete?.(progress);
      } else if (progress.status === 'failed') {
        completedRef.current = true;
        toast.error(`Enrichment failed: ${progress.error_message || 'Unknown error'}`);
        onComplete?.(progress);
      }
    }
  }, [progress, onComplete]);

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await pauseEnrichmentJob(jobId);
      toast.success('Enrichment job paused');
    } catch (error) {
      toast.error('Failed to pause job');
      console.error('Pause error:', error);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await resumeEnrichmentJob(jobId);
      toast.success('Enrichment job resumed');
    } catch (error) {
      toast.error('Failed to resume job');
      console.error('Resume error:', error);
    } finally {
      setIsResuming(false);
    }
  };

  if (isLoading || !progress) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading job progress...</span>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = () => {
    switch (progress.status) {
      case 'completed':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      case 'processing':
      case 'running':
        return 'secondary' as const;
      case 'paused':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Enrichment Job Progress
              <Badge variant={getStatusVariant()} className="gap-1">
                {getStatusIcon()}
                {progress.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              Job ID: {jobId.slice(0, 8)}...
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.processed_records.toLocaleString()} / {progress.total_records.toLocaleString()} records
            </span>
            <span className="text-muted-foreground">
              {progress.progress_percentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={progress.progress_percentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Enriched</p>
            <p className="text-2xl font-semibold text-green-600">
              {progress.enriched_records.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-semibold text-destructive">
              {progress.failed_records.toLocaleString()}
            </p>
          </div>
          {progress.total_batches > 0 && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current Batch</p>
                <p className="text-2xl font-semibold">
                  {progress.current_batch} / {progress.total_batches}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Time Estimates */}
        {progress.estimated_completion_at && progress.status === 'running' && (
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Estimated completion:</span>
              <span className="font-medium">
                {formatDistanceToNow(new Date(progress.estimated_completion_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {progress.can_pause && (progress.status === 'running' || progress.status === 'processing') && (
          <Button
            onClick={handlePause}
            disabled={isPausing}
            variant="outline"
            className="w-full"
          >
            {isPausing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Pause className="mr-2 h-4 w-4" />
            )}
            Pause Job
          </Button>
        )}

        {progress.status === 'paused' && (
          <Button
            onClick={handleResume}
            disabled={isResuming}
            variant="default"
            className="w-full"
          >
            {isResuming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Resume Job
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

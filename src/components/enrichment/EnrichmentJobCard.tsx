import { useState, useMemo } from 'react';
import { EnrichmentJob } from '@/hooks/use-realtime-enrichment';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Zap, 
  CheckCircle2, 
  XCircle,
  Loader2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

interface EnrichmentJobCardProps {
  job: EnrichmentJob;
  onRefresh: () => Promise<void>;
}

const providerLabels: Record<string, string> = {
  apollo: 'Apollo',
  pdl: 'PDL',
  ai_free: 'AI Free',
  smart_enrich: 'Smart Enrich',
  clearbit: 'Clearbit',
};

const providerColors: Record<string, string> = {
  apollo: 'bg-blue-500/10 text-blue-700 border-blue-200',
  pdl: 'bg-purple-500/10 text-purple-700 border-purple-200',
  ai_free: 'bg-green-500/10 text-green-700 border-green-200',
  smart_enrich: 'bg-orange-500/10 text-orange-700 border-orange-200',
  clearbit: 'bg-teal-500/10 text-teal-700 border-teal-200',
};

export function EnrichmentJobCard({ job, onRefresh }: EnrichmentJobCardProps) {
  const [isActionPending, setIsActionPending] = useState(false);

  const progress = useMemo(() => {
    if (!job.total_records || job.total_records === 0) return 0;
    return Math.min(100, Math.round((job.processed_records / job.total_records) * 100));
  }, [job.processed_records, job.total_records]);

  const etr = useMemo(() => {
    if (!job.started_at || job.processed_records === 0) return 'Calculating...';
    
    const startTime = new Date(job.started_at).getTime();
    const now = Date.now();
    const elapsedMs = now - startTime;
    
    if (elapsedMs <= 0) return 'Calculating...';
    
    const ratePerMs = job.processed_records / elapsedMs;
    const remaining = job.total_records - job.processed_records;
    const etrMs = remaining / ratePerMs;
    
    if (etrMs < 60000) return `~${Math.max(1, Math.ceil(etrMs / 1000))}s`;
    if (etrMs < 3600000) return `~${Math.ceil(etrMs / 60000)}m`;
    return `~${(etrMs / 3600000).toFixed(1)}h`;
  }, [job.started_at, job.processed_records, job.total_records]);

  const processingRate = useMemo(() => {
    if (!job.started_at || job.processed_records === 0) return null;
    
    const startTime = new Date(job.started_at).getTime();
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    
    if (elapsedMinutes <= 0) return null;
    
    const rate = job.processed_records / elapsedMinutes;
    return Math.round(rate);
  }, [job.started_at, job.processed_records]);

  const successRate = useMemo(() => {
    if (job.processed_records === 0) return 0;
    return Math.round((job.enriched_records / job.processed_records) * 100);
  }, [job.enriched_records, job.processed_records]);

  const handlePause = async () => {
    setIsActionPending(true);
    try {
      const { error } = await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'paused', 
          paused_at: new Date().toISOString() 
        })
        .eq('id', job.id);
      
      if (error) throw error;
      toast.success('Job paused');
      await onRefresh();
    } catch (error) {
      toast.error('Failed to pause job');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleResume = async () => {
    setIsActionPending(true);
    try {
      const { error } = await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'processing', 
          paused_at: null 
        })
        .eq('id', job.id);
      
      if (error) throw error;

      // Use new orchestrator for ai_free jobs, fallback to old functions for others
      const functionName = job.provider === 'ai_free' ? 'enrich-free-orchestrator' : 'smart-enrich';
      const body = job.provider === 'ai_free' 
        ? { job_id: job.id, org_id: job.org_id }
        : { jobId: job.id, resumeFromCheckpoint: true };
      
      await supabase.functions.invoke(functionName, { body });
      
      toast.success('Job resumed');
      await onRefresh();
    } catch (error) {
      toast.error('Failed to resume job');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRetry = async () => {
    setIsActionPending(true);
    try {
      const { error } = await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'processing', 
          error_message: null,
          started_at: new Date().toISOString(),
          cursor: null // Reset cursor for fresh start
        })
        .eq('id', job.id);
      
      if (error) throw error;

      // Use new orchestrator for ai_free jobs
      const functionName = job.provider === 'ai_free' ? 'enrich-free-orchestrator' : 'smart-enrich';
      const body = job.provider === 'ai_free' 
        ? { job_id: job.id, org_id: job.org_id }
        : { jobId: job.id };
      
      await supabase.functions.invoke(functionName, { body });
      
      toast.success('Job restarted');
      await onRefresh();
    } catch (error) {
      toast.error('Failed to restart job');
    } finally {
      setIsActionPending(false);
    }
  };

  const statusBadge = () => {
    switch (job.status) {
      case 'processing':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200 flex items-center gap-1">
            <Pause className="h-3 w-3" />
            Paused
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-700 border-green-200 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{job.status}</Badge>;
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="py-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={providerColors[job.provider] || 'bg-muted'}
              >
                {providerLabels[job.provider] || job.provider}
              </Badge>
              {statusBadge()}
            </div>
            
            <div className="flex items-center gap-2">
              {job.status === 'processing' && job.can_pause !== false && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePause}
                  disabled={isActionPending}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              )}
              {job.status === 'paused' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResume}
                  disabled={isActionPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              )}
              {job.status === 'failed' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  disabled={isActionPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {job.processed_records.toLocaleString()} / {job.total_records.toLocaleString()} records
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {job.enriched_records.toLocaleString()} enriched
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-4 w-4" />
                {job.failed_records.toLocaleString()} failed
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-muted-foreground">
              {(job.status === 'processing' || job.status === 'pending') && (
                <>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    ETR: {etr}
                  </span>
                  {processingRate && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      {processingRate}/min
                    </span>
                  )}
                </>
              )}
              <span className="flex items-center gap-1">
                {successRate >= 80 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : successRate >= 60 ? (
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                {successRate}% success
              </span>
            </div>
          </div>

          {/* Error Message */}
          {job.error_message && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
              {job.error_message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

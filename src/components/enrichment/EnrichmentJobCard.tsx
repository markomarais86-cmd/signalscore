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

// Customer-friendly provider labels
const providerLabels: Record<string, string> = {
  apollo: 'Premium',
  pdl: 'Premium',
  ai_free: 'AI Research',
  smart_enrich: 'AI Research',
  launch_pulse: 'AI Research',
};

const providerColors: Record<string, string> = {
  apollo: 'bg-primary/10 text-primary border-primary/20',
  pdl: 'bg-primary/10 text-primary border-primary/20',
  ai_free: 'bg-green-500/10 text-green-700 border-green-200',
  smart_enrich: 'bg-green-500/10 text-green-700 border-green-200',
  launch_pulse: 'bg-green-500/10 text-green-700 border-green-200',
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

      // Use unified enrichment for all job types
      await supabase.functions.invoke('enrich-unified', { 
        body: {
          org_id: job.org_id,
          job_id: job.id,
          record_type: job.job_type === 'leads' ? 'lead' : 'account',
          records: [],
          config: { skipPaidProviders: job.provider === 'ai_free' }
        }
      });
      
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

      // Use unified enrichment for all job types
      await supabase.functions.invoke('enrich-unified', { 
        body: {
          org_id: job.org_id,
          job_id: job.id,
          record_type: job.job_type === 'leads' ? 'lead' : 'account',
          records: [],
          config: { skipPaidProviders: job.provider === 'ai_free' }
        }
      });
      
      toast.success('Job restarted');
      await onRefresh();
    } catch (error) {
      toast.error('Failed to restart job');
    } finally {
      setIsActionPending(false);
    }
  };

  // Customer-friendly status labels
  const statusBadge = () => {
    switch (job.status) {
      case 'processing':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Working...
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Queued
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
            Done
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Could not complete
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

          {/* Progress Bar - Simplified */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {job.processed_records.toLocaleString()} of {job.total_records.toLocaleString()} companies
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stats Row - Distinguishes newly enriched vs already complete */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {job.enriched_records > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {job.enriched_records.toLocaleString()} newly enriched
                </span>
              )}
              {job.processed_records > 0 && job.enriched_records === 0 && job.failed_records === 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {job.processed_records.toLocaleString()} already complete
                </span>
              )}
              {job.processed_records > job.enriched_records + job.failed_records && job.enriched_records > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Zap className="h-4 w-4" />
                  {(job.processed_records - job.enriched_records - job.failed_records).toLocaleString()} already complete
                </span>
              )}
              {job.failed_records > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  {job.failed_records.toLocaleString()} not found
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-muted-foreground">
              {(job.status === 'processing' || job.status === 'pending') && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {etr}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

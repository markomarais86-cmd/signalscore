import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  TrendingUp, 
  RefreshCw,
  X,
  ChevronDown,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichmentLogger as log } from "@/lib/logger";
import { TIMING, ENRICHMENT } from "@/lib/constants";
import { InsightCard, type ProactiveInsight } from "./InsightCard";

interface AgentActivity {
  agent_name: string;
  action: string;
  count: number;
  timestamp: string;
}

interface EnrichmentProgress {
  jobId: string;
  status: string;
  processed: number;
  total: number;
  enriched: number;
  lastProgressUpdate?: string;
  isStalled?: boolean;
}

interface ProactiveInsightsWidgetProps {
  orgId: string;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
}

export function ProactiveInsightsWidget({ orgId, onAction }: ProactiveInsightsWidgetProps) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(true);
  
  // Enrichment progress state
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);
  
  // Refs to avoid stale closures in setTimeout callbacks
  const enrichmentProgressRef = useRef<EnrichmentProgress | null>(null);
  const isStartingEnrichmentRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    enrichmentProgressRef.current = enrichmentProgress;
  }, [enrichmentProgress]);
  
  useEffect(() => {
    isStartingEnrichmentRef.current = isStartingEnrichment;
  }, [isStartingEnrichment]);

  const fetchInsights = useCallback(async () => {
    if (!orgId) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-proactive-insights', {
        body: { org_id: orgId }
      });

      if (error) throw error;

      setInsights(data?.insights || []);
      setAgentActivity(data?.agent_activity || []);
    } catch (err) {
      log.error('Failed to fetch proactive insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  // Check for active enrichment jobs on mount
  const checkActiveEnrichmentJob = useCallback(async () => {
    if (!orgId) return;
    
    // First check for active jobs (pending/processing)
    const { data: activeJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message')
      .eq('org_id', orgId)
      .eq('provider', 'ai_free')
      .in('status', ['pending', 'processing'])
      .gt('total_records', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (activeJob) {
      const lastUpdate = activeJob.last_progress_update ? new Date(activeJob.last_progress_update) : null;
      const isStalled = activeJob.status === 'processing' && lastUpdate && 
        (new Date().getTime() - lastUpdate.getTime() > TIMING.JOB_STALL_THRESHOLD);
      
      setEnrichmentProgress({
        jobId: activeJob.id,
        status: activeJob.status,
        processed: activeJob.processed_records || 0,
        total: activeJob.total_records || 0,
        enriched: activeJob.enriched_records || 0,
        lastProgressUpdate: activeJob.last_progress_update,
        isStalled
      });
      return;
    }
    
    // Also check for paused jobs that need auto-resume
    const { data: pausedJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message')
      .eq('org_id', orgId)
      .eq('provider', 'ai_free')
      .eq('status', 'paused')
      .gt('total_records', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (pausedJob) {
      const needsAutoResume = pausedJob.error_message?.includes('Auto-paused') || 
                              pausedJob.error_message?.includes('stalled');
      
      setEnrichmentProgress({
        jobId: pausedJob.id,
        status: pausedJob.status,
        processed: pausedJob.processed_records || 0,
        total: pausedJob.total_records || 0,
        enriched: pausedJob.enriched_records || 0,
        lastProgressUpdate: pausedJob.last_progress_update,
        isStalled: needsAutoResume
      });
    }
  }, [orgId]);

  // Resume a stalled job
  const resumeStalledJob = async () => {
    if (!enrichmentProgress?.jobId) return;
    
    setIsStartingEnrichment(true);
    try {
      // First pause the job (required for resume to work)
      await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'paused', 
          paused_at: new Date().toISOString(),
          can_pause: true
        })
        .eq('id', enrichmentProgress.jobId);
      
      // Update local state
      setEnrichmentProgress(prev => prev ? { ...prev, status: 'paused', isStalled: false } : null);
      
      // Call resume function
      const { error } = await supabase.functions.invoke('enrich-ai-only', {
        body: { 
          jobId: enrichmentProgress.jobId, 
          resumeFromCheckpoint: true,
          batchSize: enrichmentProgress.total
        }
      });
      
      if (error) throw error;
      
      toast.success('Resuming enrichment job...', {
        description: `Continuing from ${enrichmentProgress.processed} processed records`
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resume job';
      toast.error(message);
    } finally {
      setIsStartingEnrichment(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    checkActiveEnrichmentJob();
    
    const interval = setInterval(fetchInsights, TIMING.INSIGHTS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchInsights, checkActiveEnrichmentJob]);

  // Poll for enrichment progress when active
  useEffect(() => {
    if (!enrichmentProgress?.jobId) return;
    
    const currentJobId = enrichmentProgress.jobId;
    
    const pollProgress = async () => {
      const { data: status } = await supabase
        .from('enrichment_jobs')
        .select('status, enriched_records, processed_records, total_records, last_progress_update, error_message')
        .eq('id', currentJobId)
        .single();
      
      if (status) {
        if (['completed', 'completed_with_errors', 'completed_with_failures'].includes(status.status)) {
          setEnrichmentProgress(null);
          toast.success(`Enrichment complete! ${status.enriched_records} accounts enriched`);
          fetchInsights();
        } else if (['failed', 'cancelled'].includes(status.status)) {
          setEnrichmentProgress(null);
          toast.error('Enrichment failed');
        } else if (status.status === 'paused' && status.error_message?.includes('Auto-paused')) {
          log.info('Job auto-paused, triggering auto-resume...');
          
          setEnrichmentProgress(prev => prev ? { 
            ...prev, 
            status: 'paused', 
            isStalled: false,
            processed: status.processed_records || prev.processed,
            enriched: status.enriched_records || prev.enriched,
          } : null);
          
          // Auto-resume after a short delay
          setTimeout(async () => {
            try {
              const { data: freshJob } = await supabase
                .from('enrichment_jobs')
                .select('total_records')
                .eq('id', currentJobId)
                .single();
              
              const totalRecords = freshJob?.total_records || status.total_records || ENRICHMENT.DEFAULT_BATCH_SIZE;
              
              log.info(`Auto-resuming job ${currentJobId}...`);
              const { error } = await supabase.functions.invoke('enrich-ai-only', {
                body: { 
                  jobId: currentJobId, 
                  resumeFromCheckpoint: true,
                  batchSize: totalRecords
                }
              });
              if (error) log.error('Auto-resume failed:', error);
            } catch (err) {
              log.error('Auto-resume error:', err);
            }
          }, TIMING.AUTO_RESUME_DELAY);
        } else {
          const lastUpdate = status.last_progress_update ? new Date(status.last_progress_update) : null;
          const isStalled = status.status === 'processing' && lastUpdate && 
            (new Date().getTime() - lastUpdate.getTime() > TIMING.JOB_STALL_THRESHOLD);
          
          const isPausedAndResumable = status.status === 'paused';
          
          setEnrichmentProgress({
            jobId: currentJobId,
            status: status.status,
            processed: status.processed_records || 0,
            total: status.total_records || 0,
            enriched: status.enriched_records || 0,
            lastProgressUpdate: status.last_progress_update,
            isStalled: isStalled || isPausedAndResumable
          });
          
          if (isStalled && !isStartingEnrichmentRef.current && status.status === 'processing') {
            log.info('Job stalled, triggering auto-resume...');
            resumeStalledJob();
          }
        }
      }
    };
    
    const interval = setInterval(pollProgress, TIMING.ENRICHMENT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enrichmentProgress?.jobId, fetchInsights]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInsights();
    toast.success('Refreshing insights...');
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleAction = async (action: string, params?: Record<string, unknown>) => {
    if (action === 'enrich_ai_free' && !isStartingEnrichment) {
      if (enrichmentProgress && enrichmentProgress.status === 'paused') {
        log.info('Resuming existing paused job...');
        toast.info('Resuming existing enrichment job...', {
          description: `Continuing from ${enrichmentProgress.processed}/${enrichmentProgress.total} processed`
        });
        resumeStalledJob();
        return;
      }
      
      if (enrichmentProgress && ['pending', 'processing'].includes(enrichmentProgress.status)) {
        toast.info('Enrichment already in progress', {
          description: `${enrichmentProgress.processed}/${enrichmentProgress.total} processed`
        });
        return;
      }
      
      setIsStartingEnrichment(true);
      try {
        const batchSize = (params?.batch_size as number) || ENRICHMENT.DEFAULT_BATCH_SIZE;
        
        const { data: job, error: jobError } = await supabase
          .from('enrichment_jobs')
          .insert({
            org_id: orgId,
            provider: 'ai_free',
            job_type: 'accounts',
            status: 'pending',
            total_records: batchSize
          })
          .select()
          .single();
        
        if (jobError) throw jobError;
        
        setEnrichmentProgress({
          jobId: job.id,
          status: 'pending',
          processed: 0,
          total: batchSize,
          enriched: 0
        });
        
        const { error } = await supabase.functions.invoke('enrich-ai-only', {
          body: { jobId: job.id, batchSize }
        });
        
        if (error) throw error;
        
        toast.success('AI Enrichment started!', {
          description: `Processing up to ${batchSize} accounts...`
        });
      } catch (err: unknown) {
        setEnrichmentProgress(null);
        const message = err instanceof Error ? err.message : 'Failed to start enrichment';
        toast.error(message);
      } finally {
        setIsStartingEnrichment(false);
      }
      return;
    }
    
    if (onAction) {
      onAction(action, params);
    } else {
      toast.info(`Action: ${action}`);
    }
  };

  const visibleInsights = insights.filter(i => !dismissedIds.has(i.id));

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const progressPercent = enrichmentProgress && enrichmentProgress.total > 0
    ? Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100)
    : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Insights</CardTitle>
                {visibleInsights.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {visibleInsights.length}
                  </Badge>
                )}
                {enrichmentProgress && (
                  <Badge className={`ml-1 ${
                    enrichmentProgress.status === 'paused'
                      ? 'bg-amber-500/20 text-amber-600'
                      : enrichmentProgress.isStalled 
                      ? 'bg-destructive/20 text-destructive' 
                      : 'bg-primary/20 text-primary animate-pulse'
                  }`}>
                    {enrichmentProgress.status === 'paused' 
                      ? '⏸️ Paused' 
                      : enrichmentProgress.isStalled 
                      ? '⚠️ Stalled' 
                      : 'Enriching...'}
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Active Enrichment Progress Banner */}
            {enrichmentProgress && (
              <div className={`p-3 rounded-lg border ${
                enrichmentProgress.status === 'paused'
                  ? 'bg-amber-500/5 border-amber-500/30' 
                  : enrichmentProgress.isStalled
                  ? 'bg-destructive/5 border-destructive/30'
                  : 'bg-primary/5 border-primary/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {enrichmentProgress.status === 'paused' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : enrichmentProgress.isStalled ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <span className="font-medium text-sm">
                      {enrichmentProgress.status === 'paused'
                        ? 'Enrichment Paused'
                        : enrichmentProgress.isStalled 
                        ? 'Enrichment Stalled' 
                        : 'AI Enrichment in Progress'}
                    </span>
                    {enrichmentProgress.status === 'paused' && (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                        {enrichmentProgress.total - enrichmentProgress.processed} remaining
                      </Badge>
                    )}
                    {enrichmentProgress.isStalled && enrichmentProgress.status !== 'paused' && (
                      <Badge variant="outline" className="text-destructive border-destructive/50">
                        No progress for 5+ min
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {enrichmentProgress.enriched} enriched
                  </Badge>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{enrichmentProgress.processed} / {enrichmentProgress.total} processed</span>
                  <span>{progressPercent}%</span>
                </div>
                {(enrichmentProgress.status === 'paused' || enrichmentProgress.isStalled) && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={resumeStalledJob}
                      disabled={isStartingEnrichment}
                      className="h-7 text-xs"
                    >
                      {isStartingEnrichment ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Resuming...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resume Job
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {enrichmentProgress.status === 'paused' 
                        ? 'Click to continue processing'
                        : 'Edge function may have timed out'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Agent Activity Summary */}
            {agentActivity.length > 0 && (
              <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Agent Activity Today</span>
                </div>
                <div className="space-y-1">
                  {agentActivity.slice(0, 3).map((activity, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center justify-between">
                      <span>{activity.agent_name}: {activity.action}</span>
                      <Badge variant="secondary" className="text-xs">{activity.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {visibleInsights.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No actionable insights right now</p>
                <p className="text-xs mt-1">Check back later or refresh to update</p>
              </div>
            ) : (
              visibleInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onAction={handleAction}
                  onDismiss={handleDismiss}
                  isEnrichmentActive={!!enrichmentProgress}
                  isStartingEnrichment={isStartingEnrichment}
                />
              ))
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleAction('enrich')}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Enrich Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleAction('agent_status')}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Agent Status
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

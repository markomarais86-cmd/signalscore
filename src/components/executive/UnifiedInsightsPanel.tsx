import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  Zap, 
  Target, 
  TrendingUp, 
  X, 
  RefreshCw,
  Sparkles,
  Download,
  ChevronDown,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { EnrichmentModal } from "./EnrichmentModal";
import { DataCompletenessCard } from "@/components/insights/DataCompletenessCard";
import { enrichmentLogger as log } from "@/lib/logger";
import { TIMING, ENRICHMENT } from "@/lib/constants";

import { RiskItem, RiskSeverity } from "@/utils/risk-detector";

export interface Insight {
  id?: string;
  type: string;
  category?: 'revenue' | 'firmographic' | 'signal' | 'efficiency' | 'quality' | 'growth' | 'persona';
  title: string;
  description: string;
  impact: string;
  why?: string;
  action?: string;
  route?: string;
  filter?: Record<string, any>;
  priority?: number | 'high' | 'medium' | 'low';
  confidence?: number;
  relatedSegments?: string[];
  relatedRisk?: string;
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

interface UnifiedInsightsPanelProps {
  risks: RiskItem[];
  insights: Insight[];
  orgId?: string;
  onRefresh?: () => void;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
  campaignReadyCount?: number;
  completenessScore?: number;
  totalScored?: number;
}

type UnifiedItem = {
  id: string;
  type: 'risk' | 'insight';
  priority: number;
  severity?: RiskSeverity;
  category?: string;
  title: string;
  description: string;
  impact: string;
  count?: number;
  action?: string;
  route?: string;
  filter?: Record<string, any>;
  relatedRisk?: string;
  source: RiskItem | Insight;
};

export function UnifiedInsightsPanel({
  risks,
  insights,
  orgId,
  onRefresh,
  onAction,
  campaignReadyCount = 0,
  completenessScore = 0,
  totalScored = 0
}: UnifiedInsightsPanelProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false);
  const [selectedEnrichmentFields, setSelectedEnrichmentFields] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  
  // Enrichment progress state
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);
  
  // Refs to avoid stale closures
  const enrichmentProgressRef = useRef<EnrichmentProgress | null>(null);
  const isStartingEnrichmentRef = useRef(false);
  
  useEffect(() => {
    enrichmentProgressRef.current = enrichmentProgress;
  }, [enrichmentProgress]);
  
  useEffect(() => {
    isStartingEnrichmentRef.current = isStartingEnrichment;
  }, [isStartingEnrichment]);

  const effectiveOrgId = orgId || userProfile?.org_id;

  // Check for active enrichment jobs on mount
  const checkActiveEnrichmentJob = useCallback(async () => {
    if (!effectiveOrgId) return;
    
    const { data: activeJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message')
      .eq('org_id', effectiveOrgId)
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
    
    // Check for paused jobs that need auto-resume
    const { data: pausedJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message')
      .eq('org_id', effectiveOrgId)
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
  }, [effectiveOrgId]);

  // Resume a stalled job
  const resumeStalledJob = async () => {
    if (!enrichmentProgress?.jobId) return;
    
    setIsStartingEnrichment(true);
    try {
      await supabase
        .from('enrichment_jobs')
        .update({ 
          status: 'paused', 
          paused_at: new Date().toISOString(),
          can_pause: true
        })
        .eq('id', enrichmentProgress.jobId);
      
      setEnrichmentProgress(prev => prev ? { ...prev, status: 'paused', isStalled: false } : null);
      
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
    checkActiveEnrichmentJob();
  }, [checkActiveEnrichmentJob]);

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
          onRefresh?.();
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
  }, [enrichmentProgress?.jobId, onRefresh]);

  // Merge and prioritize all items
  const unifiedItems: UnifiedItem[] = [
    ...risks.map(risk => ({
      id: risk.id,
      type: 'risk' as const,
      priority: risk.severity === 'critical' || risk.severity === 'high' ? 10 
        : risk.severity === 'medium' ? 7 
        : 4,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      impact: risk.impact,
      count: risk.count,
      action: risk.fix?.action,
      route: undefined,
      filter: risk.filter,
      source: risk
    })),
    ...insights.map(insight => {
      let priority = 5;
      if (insight.priority === 'high' || (typeof insight.priority === 'number' && insight.priority >= 80)) {
        priority = 8;
      } else if (insight.priority === 'low' || (typeof insight.priority === 'number' && insight.priority <= 40)) {
        priority = 3;
      }
      return {
        id: insight.id || `insight-${Math.random()}`,
        type: 'insight' as const,
        priority,
        category: insight.category,
        title: insight.title,
        description: insight.why || insight.description,
        impact: insight.impact,
        action: insight.action,
        route: insight.route,
        filter: insight.filter,
        relatedRisk: insight.relatedRisk,
        source: insight
      };
    })
  ].filter(item => !dismissedIds.has(item.id));

  const urgent = unifiedItems.filter(item => item.priority >= 8).sort((a, b) => b.priority - a.priority);
  const quickWins = unifiedItems.filter(item => item.priority >= 5 && item.priority < 8).sort((a, b) => b.priority - a.priority);
  const strategic = unifiedItems.filter(item => item.priority < 5).sort((a, b) => b.priority - a.priority);

  const handleDismiss = async (item: UnifiedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!userProfile?.org_id) {
      toast.error('Unable to dismiss');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      if (item.type === 'insight') {
        const { error } = await supabase
          .from('dismissed_recommendations')
          .insert({
            org_id: userProfile.org_id,
            user_id: user.id,
            recommendation_id: item.id,
            recommendation_type: item.category || 'insight',
          });

        if (error) throw error;
      }

      setDismissedIds(prev => new Set([...prev, item.id]));
      toast.success('Item dismissed');
    } catch (error: any) {
      console.error('Error dismissing item:', error);
      toast.error('Failed to dismiss');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      toast.success('Insights refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleItemClick = (item: UnifiedItem) => {
    if (item.route) {
      const url = new URL(item.route, window.location.origin);
      if (item.filter) {
        Object.entries(item.filter).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
      }
      navigate(url.pathname + url.search);
    } else if (item.type === 'risk' && item.action === 'enrich') {
      setSelectedEnrichmentFields(['contacts']);
      setEnrichmentModalOpen(true);
    }
  };

  const handleEnrichAction = async (action: string, params?: Record<string, unknown>) => {
    if (action === 'enrich_ai_free' && !isStartingEnrichment && effectiveOrgId) {
      if (enrichmentProgress && enrichmentProgress.status === 'paused') {
        toast.info('Resuming existing enrichment job...');
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
            org_id: effectiveOrgId,
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
    
    // Pass to parent handler
    onAction?.(action, params);
  };

  const getIcon = (item: UnifiedItem) => {
    if (item.type === 'risk') {
      return AlertTriangle;
    }
    switch (item.category) {
      case 'revenue': return TrendingUp;
      case 'signal': return Zap;
      default: return Target;
    }
  };

  const getColorClass = (item: UnifiedItem) => {
    if (item.type === 'risk') {
      switch (item.severity) {
        case 'critical':
        case 'high':
          return 'border-executive-red/30 bg-executive-red/5 hover:bg-executive-red/10';
        case 'medium':
        case 'low':
          return 'border-executive-amber/30 bg-executive-amber/5 hover:bg-executive-amber/10';
        default: return 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10';
      }
    }
    switch (item.category) {
      case 'revenue': return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
      case 'signal': return 'border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10';
      default: return 'border-primary/40 bg-primary/5 hover:bg-primary/10';
    }
  };

  const renderItemCard = (item: UnifiedItem) => {
    const Icon = getIcon(item);
    const colorClass = getColorClass(item);

    return (
      <div
        key={item.id}
        className={cn(
          "relative border-2 rounded-lg p-4 transition-all cursor-pointer group",
          colorClass
        )}
        onClick={() => handleItemClick(item)}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => handleDismiss(item, e)}
        >
          <X className="h-3 w-3" />
        </Button>

        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-background/80">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
              {item.type === 'risk' && item.severity && (
                <Badge 
                  variant={
                    item.severity === 'critical' || item.severity === 'high' 
                      ? 'destructive' 
                      : 'outline'
                  }
                  className="text-xs"
                >
                  {item.severity}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.description}
            </p>
            {item.relatedRisk && (
              <p className="text-xs text-primary mt-1">
                ↳ Related to: {item.relatedRisk}
              </p>
            )}
          </div>
          {item.count && (
            <div className="text-right shrink-0">
              <div className="text-xl font-bold">{item.count.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">affected</div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="text-xs font-medium text-primary">
            Impact: {item.impact}
          </div>
          {item.action && (
            <Button 
              size="sm" 
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item);
              }}
            >
              {item.action}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const progressPercent = enrichmentProgress && enrichmentProgress.total > 0
    ? Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100)
    : 0;

  const totalItems = urgent.length + quickWins.length + strategic.length;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Smart Insights & Actions</CardTitle>
                {totalItems > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {totalItems}
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
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefresh();
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
          <CardDescription>
            AI-driven recommendations and risk mitigation prioritized by impact
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
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

            {/* Data Completeness Summary */}
            {effectiveOrgId && <DataCompletenessCard orgId={effectiveOrgId} />}

            {/* Insights Tabs */}
            <Tabs defaultValue="urgent" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="urgent" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Urgent ({urgent.length})
                </TabsTrigger>
                <TabsTrigger value="quick-wins" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Wins ({quickWins.length})
                </TabsTrigger>
                <TabsTrigger value="strategic" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Strategic ({strategic.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="urgent" className="space-y-3">
                {urgent.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {urgent.map(renderItemCard)}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-executive-green" />
                    <p className="text-sm font-medium">No urgent items</p>
                    <p className="text-xs mt-1">All critical issues resolved</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="quick-wins" className="space-y-3">
                {quickWins.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {quickWins.map(renderItemCard)}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">No quick wins available</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="strategic" className="space-y-3">
                {strategic.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {strategic.map(renderItemCard)}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">No strategic items</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Quick Actions */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {totalScored === 0 && (
                  <Button 
                    onClick={() => navigate('/icp-manager')} 
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Define ICP
                  </Button>
                )}
                {campaignReadyCount > 0 && (
                  <Button 
                    onClick={() => navigate('/accounts?campaign_ready=true')} 
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {campaignReadyCount} Campaign-Ready
                  </Button>
                )}
                <Button 
                  onClick={() => handleEnrichAction('enrich_ai_free')} 
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={isStartingEnrichment || (enrichmentProgress !== null && ['pending', 'processing'].includes(enrichmentProgress.status))}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {enrichmentProgress ? 'Enriching...' : 'Enrich Data'}
                </Button>
                <Button 
                  onClick={() => navigate('/data-upload')} 
                  variant="outline"
                  size="sm"
                  className="justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Upload Data
                </Button>
              </div>
            </div>

            <EnrichmentModal
              open={enrichmentModalOpen}
              onOpenChange={setEnrichmentModalOpen}
              targetFields={selectedEnrichmentFields}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
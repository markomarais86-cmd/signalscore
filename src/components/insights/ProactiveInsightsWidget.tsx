import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw,
  X,
  ChevronDown,
  Zap,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProactiveInsight {
  id: string;
  type: 'critical' | 'opportunity' | 'info' | 'agent_activity';
  title: string;
  description: string;
  metric?: number;
  actions: {
    label: string;
    action: string;
    params?: Record<string, any>;
  }[];
  dismissible: boolean;
}

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
}

interface ProactiveInsightsWidgetProps {
  orgId: string;
  onAction?: (action: string, params?: Record<string, any>) => void;
}

export function ProactiveInsightsWidget({ orgId, onAction }: ProactiveInsightsWidgetProps) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(true);
  const [pipelineStats, setPipelineStats] = useState<{
    qualified: number;
    follow_up: number;
    meeting_ready: number;
  } | null>(null);
  
  // Enrichment progress state
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!orgId) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-proactive-insights', {
        body: { org_id: orgId }
      });

      if (error) throw error;

      setInsights(data?.insights || []);
      setAgentActivity(data?.agent_activity || []);
      setPipelineStats(data?.pipeline_stats || null);
    } catch (err) {
      console.error('Failed to fetch proactive insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  // Check for active enrichment jobs on mount
  const checkActiveEnrichmentJob = useCallback(async () => {
    if (!orgId) return;
    
    const { data: activeJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records')
      .eq('org_id', orgId)
      .eq('provider', 'ai_free')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (activeJob) {
      setEnrichmentProgress({
        jobId: activeJob.id,
        status: activeJob.status,
        processed: activeJob.processed_records || 0,
        total: activeJob.total_records || 0,
        enriched: activeJob.enriched_records || 0
      });
    }
  }, [orgId]);

  useEffect(() => {
    fetchInsights();
    checkActiveEnrichmentJob();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchInsights, checkActiveEnrichmentJob]);

  // Poll for enrichment progress when active
  useEffect(() => {
    if (!enrichmentProgress?.jobId) return;
    
    const pollProgress = async () => {
      const { data: status } = await supabase
        .from('enrichment_jobs')
        .select('status, enriched_records, processed_records, total_records')
        .eq('id', enrichmentProgress.jobId)
        .single();
      
      if (status) {
        if (status.status === 'completed' || status.status === 'failed') {
          setEnrichmentProgress(null);
          if (status.status === 'completed') {
            toast.success(`Enrichment complete! ${status.enriched_records} accounts enriched`);
            // Auto-refresh insights to update the count
            fetchInsights();
          } else {
            toast.error('Enrichment failed');
          }
        } else {
          setEnrichmentProgress({
            jobId: enrichmentProgress.jobId,
            status: status.status,
            processed: status.processed_records || 0,
            total: status.total_records || 0,
            enriched: status.enriched_records || 0
          });
        }
      }
    };
    
    const interval = setInterval(pollProgress, 2000);
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

  // Enhanced action handler that tracks enrichment progress
  const handleAction = async (action: string, params?: Record<string, any>) => {
    // Handle enrichment actions internally to track progress
    if (action === 'enrich_ai_free' && !enrichmentProgress && !isStartingEnrichment) {
      setIsStartingEnrichment(true);
      try {
        const batchSize = params?.batch_size || 500;
        
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
        
        // Set progress immediately
        setEnrichmentProgress({
          jobId: job.id,
          status: 'pending',
          processed: 0,
          total: batchSize,
          enriched: 0
        });
        
        // Invoke the enrichment function
        const { error } = await supabase.functions.invoke('enrich-ai-only', {
          body: { jobId: job.id, batchSize }
        });
        
        if (error) throw error;
        
        toast.success('AI Enrichment started!', {
          description: `Processing up to ${batchSize} accounts...`
        });
      } catch (err: any) {
        setEnrichmentProgress(null);
        toast.error(err.message || 'Failed to start enrichment');
      } finally {
        setIsStartingEnrichment(false);
      }
      return;
    }
    
    // Pass other actions to parent handler
    if (onAction) {
      onAction(action, params);
    } else {
      toast.info(`Action: ${action}`);
    }
  };

  const getTypeIcon = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'opportunity':
        return <Target className="h-4 w-4 text-primary" />;
      case 'agent_activity':
        return <Zap className="h-4 w-4 text-amber-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'critical':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'opportunity':
        return <Badge className="bg-primary/10 text-primary">Opportunity</Badge>;
      case 'agent_activity':
        return <Badge className="bg-amber-500/10 text-amber-600">Agent Activity</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  // Render enrichment action button with progress
  const renderEnrichmentButton = (insight: ProactiveInsight, actionItem: { label: string; action: string; params?: Record<string, any> }, idx: number) => {
    const isEnrichAction = actionItem.action === 'enrich_ai_free';
    const isActive = isEnrichAction && enrichmentProgress;
    const isStarting = isEnrichAction && isStartingEnrichment;
    
    if (isActive && enrichmentProgress) {
      const progressPercent = enrichmentProgress.total > 0 
        ? Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100) 
        : 0;
      
      return (
        <div key={idx} className="w-full space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enriching...
            </span>
            <span className="text-muted-foreground">
              {enrichmentProgress.enriched} enriched • {progressPercent}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      );
    }
    
    return (
      <Button
        key={idx}
        variant={idx === 0 ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        disabled={isStarting}
        onClick={() => handleAction(actionItem.action, actionItem.params)}
      >
        {isStarting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Starting...
          </>
        ) : (
          actionItem.label
        )}
      </Button>
    );
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
                  <Badge className="ml-1 bg-primary/20 text-primary animate-pulse">
                    Enriching...
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
              <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium text-sm">AI Enrichment in Progress</span>
                  </div>
                  <Badge variant="secondary">
                    {enrichmentProgress.enriched} enriched
                  </Badge>
                </div>
                <Progress 
                  value={enrichmentProgress.total > 0 
                    ? Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100) 
                    : 0} 
                  className="h-2" 
                />
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{enrichmentProgress.processed} / {enrichmentProgress.total} processed</span>
                  <span>
                    {enrichmentProgress.total > 0 
                      ? Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100) 
                      : 0}%
                  </span>
                </div>
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
                <div
                  key={insight.id}
                  className={`p-3 rounded-lg border transition-all ${
                    insight.type === 'critical' 
                      ? 'bg-destructive/5 border-destructive/20' 
                      : insight.type === 'opportunity'
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getTypeIcon(insight.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getTypeBadge(insight.type)}
                          {insight.metric !== undefined && !enrichmentProgress && (
                            <span className="font-bold text-lg">{insight.metric.toLocaleString()}</span>
                          )}
                          {insight.metric !== undefined && enrichmentProgress && insight.id === 'needs_enrichment' && (
                            <span className="font-bold text-lg text-muted-foreground">
                              ~{Math.max(0, insight.metric - enrichmentProgress.enriched).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm mt-1">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                        
                        {insight.actions.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {insight.actions.map((actionItem, idx) => 
                              renderEnrichmentButton(insight, actionItem, idx)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {insight.dismissible && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                        onClick={() => handleDismiss(insight.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
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

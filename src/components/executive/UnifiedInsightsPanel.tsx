import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Sparkles, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { EnrichmentModal } from "./EnrichmentModal";
import { WorkflowConfirmDialog } from "./WorkflowConfirmDialog";
import { DataCompletenessCard } from "@/components/insights/DataCompletenessCard";
import { enrichmentLogger as log } from "@/lib/logger";
import { TIMING, ENRICHMENT } from "@/lib/constants";
import { RiskItem } from "@/utils/risk-detector";

import type { EnrichmentProgress, UnifiedItem } from "./insights/types";
import { EnrichmentProgressBanner } from "./insights/EnrichmentProgressBanner";
import { InsightsTabs } from "./insights/InsightsTabs";
import { QuickActions } from "./insights/QuickActions";

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

// --- Helpers ---

function mapNextActionToLabel(nextAction?: string): string | undefined {
  if (!nextAction) return undefined;
  const map: Record<string, string> = {
    build_campaign: 'Prepare Campaign',
    enrich_data: 'Enrich Data',
    score_accounts: 'Score Accounts',
    view_accounts: 'View Accounts',
    contact_leads: 'Find Contacts',
    export_csv: 'Export Data',
    review_accounts: 'Review Accounts',
  };
  return map[nextAction] || nextAction.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function mapNextActionToRoute(nextAction?: string): string | undefined {
  if (!nextAction) return undefined;
  const map: Record<string, string> = {
    score_accounts: '/accounts',
    view_accounts: '/accounts',
    review_accounts: '/accounts',
    export_csv: '/accounts',
    enrich_contacts: '/accounts',
    enrich_data: '/accounts',
    build_campaign: '/accounts',
    contact_leads: '/accounts',
    search_accounts: '/accounts',
  };
  return map[nextAction];
}

function inferWorkflowType(actionText: string): string | null {
  const lower = actionText.toLowerCase();
  if (/find.*contact|contact|leads/.test(lower)) return 'build_target_list';
  if (/penetrate|expand|target|build.*list|whitespace/.test(lower)) return 'build_target_list';
  if (/enrich|fill|complete|missing/.test(lower)) return 'enrich_data';
  if (/score|calculate|rescore/.test(lower)) return 'score_accounts';
  if (/optimize|refine|improve.*icp|tune/.test(lower)) return 'optimize_icp';
  if (/campaign|outreach|prepare|launch/.test(lower)) return 'prepare_campaign';
  if (/audit|quality|clean|standardize|duplicate/.test(lower)) return 'audit_data_quality';
  return null;
}

function buildUnifiedItems(risks: RiskItem[], insights: Insight[], dismissedIds: Set<string>): UnifiedItem[] {
  return [
    ...risks.map(risk => ({
      id: risk.id,
      type: 'risk' as const,
      priority: risk.severity === 'critical' || risk.severity === 'high' ? 10 : risk.severity === 'medium' ? 7 : 4,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      impact: risk.impact,
      count: risk.count,
      action: risk.fix?.label || (risk.fix?.action === 'enrich' ? 'Enrich Data' : risk.fix?.action === 'navigate' ? 'View Details' : undefined),
      route: undefined,
      filter: risk.filter,
      source: risk,
    })),
    ...insights.map(insight => {
      let priority = 5;
      if (insight.priority === 'high' || (typeof insight.priority === 'number' && insight.priority >= 80)) priority = 8;
      else if (insight.priority === 'low' || (typeof insight.priority === 'number' && insight.priority <= 40)) priority = 3;
      return {
        id: insight.id || `insight-${Math.random()}`,
        type: 'insight' as const,
        priority,
        category: insight.category,
        title: insight.title,
        description: insight.why || insight.description,
        impact: insight.impact,
        action: insight.action || mapNextActionToLabel((insight as any).nextAction),
        route: insight.route || mapNextActionToRoute((insight as any).nextAction),
        filter: insight.filter,
        relatedRisk: insight.relatedRisk,
        source: insight,
      };
    }),
  ].filter(item => !dismissedIds.has(item.id));
}

// --- Main Component ---

export function UnifiedInsightsPanel({
  risks,
  insights,
  orgId,
  onRefresh,
  onAction,
  campaignReadyCount = 0,
  totalScored = 0,
}: UnifiedInsightsPanelProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false);
  const [selectedEnrichmentFields, setSelectedEnrichmentFields] = useState<string[]>([]);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string | null>(null);
  const [workflowContext, setWorkflowContext] = useState<Record<string, unknown>>({});
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem('unified-insights-panel-open');
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('unified-insights-panel-open', String(isOpen));
  }, [isOpen]);

  // Enrichment state
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);
  const isStartingEnrichmentRef = useRef(false);

  useEffect(() => { isStartingEnrichmentRef.current = isStartingEnrichment; }, [isStartingEnrichment]);

  const effectiveOrgId = orgId || userProfile?.org_id;

  // --- Enrichment job management ---

  const checkActiveEnrichmentJob = useCallback(async () => {
    if (!effectiveOrgId) return;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: activeJobs } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message, created_at')
      .eq('org_id', effectiveOrgId)
      .eq('provider', 'ai_free')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(5);

    const validActiveJob = activeJobs?.find(job => {
      if ((job.processed_records || 0) > 0) return true;
      return new Date(job.created_at) > new Date(fiveMinutesAgo);
    });

    if (validActiveJob) {
      const lastUpdate = validActiveJob.last_progress_update ? new Date(validActiveJob.last_progress_update) : null;
      const isStalled = validActiveJob.status === 'processing' && lastUpdate &&
        (new Date().getTime() - lastUpdate.getTime() > TIMING.JOB_STALL_THRESHOLD);
      setEnrichmentProgress({
        jobId: validActiveJob.id,
        status: validActiveJob.status,
        processed: validActiveJob.processed_records || 0,
        total: validActiveJob.total_records || 0,
        enriched: validActiveJob.enriched_records || 0,
        lastProgressUpdate: validActiveJob.last_progress_update,
        isStalled,
      });
      return;
    }

    const { data: pausedJob } = await supabase
      .from('enrichment_jobs')
      .select('id, status, processed_records, total_records, enriched_records, last_progress_update, error_message')
      .eq('org_id', effectiveOrgId)
      .eq('provider', 'ai_free')
      .eq('status', 'paused')
      .gt('total_records', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pausedJob) {
      const needsAutoResume = pausedJob.error_message?.includes('Auto-paused') || pausedJob.error_message?.includes('stalled');
      setEnrichmentProgress({
        jobId: pausedJob.id, status: pausedJob.status,
        processed: pausedJob.processed_records || 0, total: pausedJob.total_records || 0,
        enriched: pausedJob.enriched_records || 0, lastProgressUpdate: pausedJob.last_progress_update,
        isStalled: needsAutoResume,
      });
    }
  }, [effectiveOrgId]);

  const resumeStalledJob = async () => {
    if (!enrichmentProgress?.jobId) return;
    setIsStartingEnrichment(true);
    try {
      await supabase.from('enrichment_jobs').update({
        status: 'paused', paused_at: new Date().toISOString(), can_pause: true,
      }).eq('id', enrichmentProgress.jobId);
      setEnrichmentProgress(prev => prev ? { ...prev, status: 'paused', isStalled: false } : null);
      const { error } = await supabase.functions.invoke('enrich-unified', {
        body: { jobId: enrichmentProgress.jobId, resumeFromCheckpoint: true, batchSize: enrichmentProgress.total },
      });
      if (error) throw error;
      toast.success('Resuming enrichment job...', { description: `Continuing from ${enrichmentProgress.processed} processed records` });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume job');
    } finally {
      setIsStartingEnrichment(false);
    }
  };

  useEffect(() => { checkActiveEnrichmentJob(); }, [checkActiveEnrichmentJob]);

  // Auto-load insights
  useEffect(() => {
    if (insights.length === 0 && risks.length === 0 && onRefresh && !isRefreshing) {
      setIsInsightsLoading(true);
      onRefresh();
      const timeout = setTimeout(() => setIsInsightsLoading(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    if (insights.length > 0 || risks.length > 0) setIsInsightsLoading(false);
  }, [insights.length, risks.length]);

  // Poll enrichment progress
  useEffect(() => {
    if (!enrichmentProgress?.jobId) return;
    const currentJobId = enrichmentProgress.jobId;

    const pollProgress = async () => {
      const { data: status } = await supabase
        .from('enrichment_jobs')
        .select('status, enriched_records, processed_records, total_records, last_progress_update, error_message')
        .eq('id', currentJobId)
        .single();

      if (!status) return;

      if (['completed', 'completed_with_errors', 'completed_with_failures'].includes(status.status)) {
        setEnrichmentProgress(null);
        toast.success(`Enrichment complete! ${status.enriched_records} accounts enriched`);
        onRefresh?.();
      } else if (['failed', 'cancelled'].includes(status.status)) {
        setEnrichmentProgress(null);
        toast.error('Enrichment failed');
      } else if (status.status === 'paused' && status.error_message?.includes('Auto-paused')) {
        log.info('Job auto-paused, triggering auto-resume...');
        setEnrichmentProgress(prev => prev ? { ...prev, status: 'paused', isStalled: false, processed: status.processed_records || prev.processed, enriched: status.enriched_records || prev.enriched } : null);
        setTimeout(async () => {
          try {
            const { data: freshJob } = await supabase.from('enrichment_jobs').select('total_records').eq('id', currentJobId).single();
            const totalRecords = freshJob?.total_records || status.total_records || ENRICHMENT.DEFAULT_BATCH_SIZE;
            log.info(`Auto-resuming job ${currentJobId}...`);
            const { error } = await supabase.functions.invoke('enrich-unified', { body: { jobId: currentJobId, resumeFromCheckpoint: true, batchSize: totalRecords } });
            if (error) log.error('Auto-resume failed:', error);
          } catch (err) { log.error('Auto-resume error:', err); }
        }, TIMING.AUTO_RESUME_DELAY);
      } else {
        const lastUpdate = status.last_progress_update ? new Date(status.last_progress_update) : null;
        const isStalled = status.status === 'processing' && lastUpdate && (new Date().getTime() - lastUpdate.getTime() > TIMING.JOB_STALL_THRESHOLD);
        setEnrichmentProgress({
          jobId: currentJobId, status: status.status,
          processed: status.processed_records || 0, total: status.total_records || 0,
          enriched: status.enriched_records || 0, lastProgressUpdate: status.last_progress_update,
          isStalled: isStalled || status.status === 'paused',
        });
        if (isStalled && !isStartingEnrichmentRef.current && status.status === 'processing') {
          log.info('Job stalled, triggering auto-resume...');
          resumeStalledJob();
        }
      }
    };

    const interval = setInterval(pollProgress, TIMING.ENRICHMENT_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enrichmentProgress?.jobId, onRefresh]);

  // --- Handlers ---

  const handleItemClick = (item: UnifiedItem) => {
    if (item.type === 'risk') {
      const risk = item.source as RiskItem;
      if (risk.fix?.action === 'navigate' && risk.fix.target) { navigate(risk.fix.target); return; }
      if (risk.fix?.action === 'enrich') { setSelectedEnrichmentFields(risk.fix.fields || ['all']); setEnrichmentModalOpen(true); return; }
    }
    if (item.route) {
      const url = new URL(item.route, window.location.origin);
      if (item.filter) Object.entries(item.filter).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      navigate(url.pathname + url.search);
      return;
    }
    if (item.action) {
      const actionLower = item.action.toLowerCase();
      if (/enrich/i.test(actionLower)) { handleEnrichAction('enrich_ai_free'); return; }
      if (/score|calculate|rescore/i.test(actionLower)) { navigate('/accounts?action=score'); return; }
      if (/find.*contact|contact|leads/i.test(actionLower)) { navigate('/accounts?action=find_contacts'); return; }
      const wfType = inferWorkflowType(item.action);
      if (wfType && effectiveOrgId) {
        setSelectedWorkflowType(wfType);
        setWorkflowContext({ insightId: item.id, title: item.title, filter: item.filter });
        setWorkflowDialogOpen(true);
        return;
      }
    }
    navigate('/accounts');
  };

  const handleDismiss = async (item: UnifiedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile?.org_id) { toast.error('Unable to dismiss'); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('User not authenticated'); return; }
      if (item.type === 'insight') {
        const { error } = await supabase.from('dismissed_recommendations').insert({
          org_id: userProfile.org_id, user_id: user.id,
          recommendation_id: item.id, recommendation_type: item.category || 'insight',
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
    try { await onRefresh?.(); toast.success('Insights refreshed'); }
    catch { toast.error('Failed to refresh'); }
    finally { setIsRefreshing(false); }
  };

  const handleEnrichAction = async (action: string, params?: Record<string, unknown>) => {
    if (action === 'enrich_ai_free' && !isStartingEnrichment && effectiveOrgId) {
      if (enrichmentProgress && enrichmentProgress.status === 'paused') { toast.info('Resuming existing enrichment job...'); resumeStalledJob(); return; }
      if (enrichmentProgress && ['pending', 'processing'].includes(enrichmentProgress.status)) { toast.info('Enrichment already in progress', { description: `${enrichmentProgress.processed}/${enrichmentProgress.total} processed` }); return; }
      setIsStartingEnrichment(true);
      try {
        const batchSize = (params?.batch_size as number) || ENRICHMENT.DEFAULT_BATCH_SIZE;
        const { data: job, error: jobError } = await supabase.from('enrichment_jobs').insert({ org_id: effectiveOrgId, provider: 'ai_free', job_type: 'accounts', status: 'pending', total_records: batchSize }).select().single();
        if (jobError) throw jobError;
        setEnrichmentProgress({ jobId: job.id, status: 'pending', processed: 0, total: batchSize, enriched: 0 });
        const { error } = await supabase.functions.invoke('enrich-unified', { body: { jobId: job.id, batchSize } });
        if (error) throw error;
        toast.success('AI Enrichment started!', { description: `Processing up to ${batchSize} accounts...` });
      } catch (err: unknown) {
        setEnrichmentProgress(null);
        toast.error(err instanceof Error ? err.message : 'Failed to start enrichment');
      } finally { setIsStartingEnrichment(false); }
      return;
    }
    onAction?.(action, params);
  };

  // --- Build items ---

  const unifiedItems = buildUnifiedItems(risks, insights, dismissedIds);
  const urgent = unifiedItems.filter(i => i.priority >= 8).sort((a, b) => b.priority - a.priority);
  const quickWins = unifiedItems.filter(i => i.priority >= 5 && i.priority < 8).sort((a, b) => b.priority - a.priority);
  const strategic = unifiedItems.filter(i => i.priority < 5).sort((a, b) => b.priority - a.priority);
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
                {totalItems > 0 && <Badge variant="secondary" className="ml-1">{totalItems}</Badge>}
                {enrichmentProgress && (
                  <Badge className={`ml-1 ${
                    enrichmentProgress.status === 'paused' ? 'bg-status-warning/20 text-status-warning'
                    : enrichmentProgress.isStalled ? 'bg-destructive/20 text-destructive'
                    : 'bg-primary/20 text-primary animate-pulse'
                  }`}>
                    {enrichmentProgress.status === 'paused' ? '⏸️ Paused' : enrichmentProgress.isStalled ? '⚠️ Stalled' : 'Enriching...'}
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
          <CardDescription>AI-driven recommendations and risk mitigation prioritized by impact</CardDescription>
          {!isOpen && totalItems > 0 && (
            <p className="text-xs text-primary mt-1 animate-pulse">↑ Click to expand and view {totalItems} insight{totalItems > 1 ? 's' : ''}</p>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0 max-h-[500px] overflow-y-auto">
            {enrichmentProgress && (
              <EnrichmentProgressBanner
                progress={enrichmentProgress}
                isStartingEnrichment={isStartingEnrichment}
                onResume={resumeStalledJob}
              />
            )}

            {effectiveOrgId && <DataCompletenessCard orgId={effectiveOrgId} />}

            <InsightsTabs
              urgent={urgent}
              quickWins={quickWins}
              strategic={strategic}
              isLoading={isInsightsLoading}
              onDismiss={handleDismiss}
              onClick={handleItemClick}
              inferWorkflowType={inferWorkflowType}
            />

            <QuickActions
              totalScored={totalScored}
              campaignReadyCount={campaignReadyCount}
              isStartingEnrichment={isStartingEnrichment}
              enrichmentProgress={enrichmentProgress}
              onEnrichAction={handleEnrichAction}
            />

            <EnrichmentModal open={enrichmentModalOpen} onOpenChange={setEnrichmentModalOpen} targetFields={selectedEnrichmentFields} />

            {effectiveOrgId && (
              <WorkflowConfirmDialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen} workflowType={selectedWorkflowType} orgId={effectiveOrgId} context={workflowContext} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

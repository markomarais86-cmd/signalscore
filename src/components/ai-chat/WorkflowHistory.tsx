import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, RotateCcw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowProgress, WorkflowData } from './WorkflowProgress';

interface WorkflowSummary {
  id: string;
  workflow_type: string;
  workflow_name: string;
  status: WorkflowData['status'];
  current_step: number;
  total_steps: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface WorkflowHistoryProps {
  orgId?: string;
  onRerunWorkflow?: (workflowType: string, parameters: Record<string, any>) => void;
  maxItems?: number;
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: 'text-[hsl(var(--status-success))]', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Failed' },
  running: { icon: Loader2, color: 'text-primary', label: 'Running' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled' },
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function WorkflowHistoryItem({ 
  workflow, 
  onExpand, 
  isExpanded,
  onRerun,
}: { 
  workflow: WorkflowSummary; 
  onExpand: () => void;
  isExpanded: boolean;
  onRerun?: () => void;
}) {
  const statusConfig = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.pending;
  const Icon = statusConfig.icon;
  const progress = workflow.total_steps > 0 
    ? Math.round((workflow.current_step / workflow.total_steps) * 100)
    : 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onExpand}
        className={cn(
          'w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors',
          isExpanded && 'bg-muted/30'
        )}
      >
        <Icon 
          className={cn(
            'w-4 h-4 flex-shrink-0',
            statusConfig.color,
            workflow.status === 'running' && 'animate-spin'
          )} 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{workflow.workflow_name}</span>
            <span className="text-xs text-muted-foreground">
              {workflow.current_step}/{workflow.total_steps}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{formatRelativeTime(workflow.started_at)}</span>
            <span className={statusConfig.color}>{statusConfig.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRerun && workflow.status !== 'running' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRerun();
              }}
              title="Re-run workflow"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 border-t bg-muted/20">
          <WorkflowProgress
            workflow={{
              id: workflow.id,
              type: workflow.workflow_type,
              name: workflow.workflow_name,
              status: workflow.status,
              current_step: workflow.current_step,
              total_steps: workflow.total_steps,
              progress_percentage: progress,
              steps: [], // We don't have full step data in the summary
              started_at: workflow.started_at || undefined,
              completed_at: workflow.completed_at || undefined,
              error_message: workflow.error_message || undefined,
            }}
            compact
          />
        </div>
      )}
    </div>
  );
}

export function WorkflowHistory({ orgId, onRerunWorkflow, maxItems = 10 }: WorkflowHistoryProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkflows() {
      if (!orgId) {
        // Try to get org_id from user profile
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('user_id', session.user.id)
          .single();

        if (!profile?.org_id) {
          setIsLoading(false);
          return;
        }

        orgId = profile.org_id;
      }

      try {
        const { data, error } = await supabase
          .from('ai_workflows')
          .select('id, workflow_type, workflow_name, status, current_step, total_steps, started_at, completed_at, error_message')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(maxItems);

        if (error) throw error;

        setWorkflows((data || []) as WorkflowSummary[]);
      } catch (err) {
        console.error('Failed to load workflows:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workflows');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkflows();
  }, [orgId, maxItems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No workflow history yet</p>
        <p className="text-xs mt-1">Run a workflow to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-sm font-medium">Recent Workflows</h4>
        <span className="text-xs text-muted-foreground">{workflows.length} workflows</span>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-2">
          {workflows.map((workflow) => (
            <WorkflowHistoryItem
              key={workflow.id}
              workflow={workflow}
              isExpanded={expandedId === workflow.id}
              onExpand={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
              onRerun={onRerunWorkflow ? () => onRerunWorkflow(workflow.workflow_type, {}) : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Compact version for chat panel
export function WorkflowHistoryCompact({ 
  onSelectWorkflow 
}: { 
  onSelectWorkflow?: (workflowType: string) => void;
}) {
  const availableWorkflows = [
    { type: 'build_target_list', name: 'Build Target List', description: 'Search → Analyze → Recommend' },
    { type: 'audit_data_quality', name: 'Data Quality Audit', description: 'Check data completeness' },
    { type: 'prepare_campaign', name: 'Prepare Campaign', description: 'Find campaign-ready contacts' },
    { type: 'optimize_icp', name: 'Optimize ICP', description: 'Improve your ICP criteria' },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Available Workflows:</p>
      <div className="grid gap-2">
        {availableWorkflows.map((workflow) => (
          <Button
            key={workflow.type}
            variant="outline"
            size="sm"
            className="h-auto py-2 px-3 justify-start text-left"
            onClick={() => onSelectWorkflow?.(workflow.type)}
          >
            <Play className="w-3 h-3 mr-2 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium">{workflow.name}</div>
              <div className="text-[10px] text-muted-foreground">{workflow.description}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}

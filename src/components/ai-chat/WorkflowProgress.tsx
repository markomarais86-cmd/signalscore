import { CheckCircle, Circle, Loader2, XCircle, SkipForward, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface WorkflowStep {
  id: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface WorkflowData {
  id: string;
  type: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step: number;
  total_steps: number;
  progress_percentage: number;
  steps: WorkflowStep[];
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface WorkflowProgressProps {
  workflow: WorkflowData;
  onCancel?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

const STEP_ICONS = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  skipped: SkipForward,
};

const STEP_COLORS = {
  pending: 'text-muted-foreground',
  running: 'text-primary',
  completed: 'text-[hsl(var(--status-success))]',
  failed: 'text-destructive',
  skipped: 'text-muted-foreground/60',
};

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const duration = end - start;
  
  if (duration < 1000) return '<1s';
  if (duration < 60000) return `${Math.round(duration / 1000)}s`;
  return `${Math.round(duration / 60000)}m`;
}

export function WorkflowProgress({ workflow, onCancel, onRetry, compact = false }: WorkflowProgressProps) {
  const isRunning = workflow.status === 'running';
  const isCompleted = workflow.status === 'completed';
  const isFailed = workflow.status === 'failed';

  if (compact) {
    return (
      <div className="bg-muted/50 border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {isCompleted && <CheckCircle className="w-4 h-4 text-[hsl(var(--status-success))]" />}
            {isFailed && <XCircle className="w-4 h-4 text-destructive" />}
            <span className="text-sm font-medium">{workflow.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {workflow.current_step}/{workflow.total_steps} steps
          </span>
        </div>
        <Progress value={workflow.progress_percentage} className="h-1.5" />
        {isFailed && workflow.error_message && (
          <p className="text-xs text-destructive mt-2">{workflow.error_message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm">{workflow.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">{workflow.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{workflow.progress_percentage}%</span>
          {isRunning && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {isFailed && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={workflow.progress_percentage} className="h-2 mb-4" />

      {/* Steps */}
      <div className="space-y-2">
        {workflow.steps.map((step, index) => {
          const Icon = STEP_ICONS[step.status];
          const colorClass = STEP_COLORS[step.status];
          const isActive = step.status === 'running';

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-md text-sm',
                isActive && 'bg-primary/5 border border-primary/20'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  colorClass,
                  step.status === 'running' && 'animate-spin'
                )}
              />
              <span className={cn('flex-1', step.status === 'skipped' && 'line-through opacity-60')}>
                Step {index + 1}: {step.action.replace(/_/g, ' ')}
              </span>
              {(step.started_at || step.completed_at) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(step.started_at, step.completed_at)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {isFailed && workflow.error_message && (
        <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs text-destructive">{workflow.error_message}</p>
        </div>
      )}

      {/* Duration */}
      {workflow.started_at && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Started: {new Date(workflow.started_at).toLocaleTimeString()}</span>
          {workflow.completed_at && (
            <span>Duration: {formatDuration(workflow.started_at, workflow.completed_at)}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Mini progress indicator for chat messages
export function WorkflowProgressMini({ 
  name, 
  currentStep, 
  totalSteps, 
  status 
}: { 
  name: string; 
  currentStep: number; 
  totalSteps: number; 
  status: WorkflowData['status'];
}) {
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <div className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
      {status === 'completed' && <CheckCircle className="w-3 h-3 text-[hsl(var(--status-success))]" />}
      {status === 'failed' && <XCircle className="w-3 h-3 text-destructive" />}
      <span className="truncate max-w-[120px]">{name}</span>
      <span className="text-muted-foreground">{currentStep}/{totalSteps}</span>
      <Progress value={progress} className="w-12 h-1" />
    </div>
  );
}

import { useAgentRunProgress } from "@/hooks/use-agent-realtime";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, Clock, Zap } from "lucide-react";

interface AgentRunProgressProps {
  runId: string;
  agentName?: string;
  compact?: boolean;
}

export function AgentRunProgress({ runId, agentName, compact = false }: AgentRunProgressProps) {
  const { run, isLoading } = useAgentRunProgress(runId);

  if (isLoading || !run) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const progress = run.progress_percentage || 0;
  const isRunning = run.status === "running";
  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";

  const getStatusIcon = () => {
    if (isRunning) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (isCompleted) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (isFailed) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = () => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      running: { variant: "default", label: "Running" },
      completed: { variant: "secondary", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
      pending: { variant: "secondary", label: "Pending" },
    };
    const config = variants[run.status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        {isRunning && (
          <Progress value={progress} className="h-1.5 w-16" />
        )}
        <span className="text-xs text-muted-foreground">
          {isRunning ? `${progress}%` : run.status}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">{agentName || "Agent Run"}</span>
        </div>
        {getStatusBadge()}
      </div>

      {isRunning && (
        <>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {run.current_step || "Processing..."}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
        </>
      )}

      {run.live_metrics && Object.keys(run.live_metrics).length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(run.live_metrics).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}:
              </span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {(run.records_processed !== null || run.records_affected !== null) && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {run.records_processed !== null && (
            <span>Processed: {run.records_processed}</span>
          )}
          {run.records_affected !== null && (
            <span>Affected: {run.records_affected}</span>
          )}
        </div>
      )}

      {isFailed && run.error_message && (
        <div className="p-2 rounded bg-destructive/10 text-destructive text-sm">
          {run.error_message}
        </div>
      )}
    </div>
  );
}

// Component for showing multiple active runs
export function ActiveAgentRuns() {
  const { activeRuns, isConnected } = useAgentRealtimeContext();

  if (activeRuns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Active Runs</h3>
        {isConnected && (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>
      {activeRuns.map((run) => (
        <AgentRunProgress key={run.id} runId={run.id} compact />
      ))}
    </div>
  );
}

// Hook context for sharing realtime data
import { createContext, useContext, ReactNode } from "react";
import { useAgentRealtime } from "@/hooks/use-agent-realtime";

type AgentRealtimeContextType = ReturnType<typeof useAgentRealtime>;

const AgentRealtimeContext = createContext<AgentRealtimeContextType | null>(null);

export function AgentRealtimeProvider({ children }: { children: ReactNode }) {
  const realtimeData = useAgentRealtime();
  
  return (
    <AgentRealtimeContext.Provider value={realtimeData}>
      {children}
    </AgentRealtimeContext.Provider>
  );
}

export function useAgentRealtimeContext() {
  const context = useContext(AgentRealtimeContext);
  if (!context) {
    throw new Error("useAgentRealtimeContext must be used within AgentRealtimeProvider");
  }
  return context;
}

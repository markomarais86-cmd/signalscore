import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Clock, CheckCircle, XCircle, Activity, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { agentLogger } from "@/lib/logger";
import { toastError } from "@/lib/friendly-errors";

interface Agent {
  id: string;
  name: string;
  agent_type: string;
  status: string;
  schedule: string;
  last_run_at: string | null;
  next_run_at: string | null;
  description: string | null;
}

interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  records_processed: number;
  records_affected: number;
  started_at: string;
  completed_at: string | null;
}

export function AgentControlPanel() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  // Only show data-focused agents (exclude lead_qualification, follow_up, meeting_scheduler)
  const DATA_AGENT_TYPES = ["data_enrichment"];

  const { data: agents, isLoading } = useQuery({
    queryKey: ["ai-agents", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .in("agent_type", DATA_AGENT_TYPES)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!userProfile?.org_id,
  });

  const { data: recentRuns } = useQuery({
    queryKey: ["ai-agent-runs", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as AgentRun[];
    },
    enabled: !!userProfile?.org_id,
  });

  const toggleAgent = useMutation({
    mutationFn: async ({ agentId, enabled }: { agentId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ status: enabled ? "active" : "paused" })
        .eq("id", agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agent status updated");
    },
    onError: (error) => {
      toast.error(toastError(error, 'Failed to update agent'));
    },
  });

  const runAgent = useMutation({
    mutationFn: async (agentId: string) => {
      agentLogger.info('Running agent:', agentId);
      
      const { data, error } = await supabase.functions.invoke('run-agent', {
        body: { agent_id: agentId, manual: true },
      });

      if (error) {
        agentLogger.error('Agent run error:', error);
        throw new Error(error.message || 'Failed to run agent');
      }

      if (!data?.success) {
        agentLogger.error('Agent run failed:', data);
        throw new Error(data?.error || 'Agent execution failed');
      }

      agentLogger.info('Agent run successful:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-runs'] });
      
      const message = data?.result?.message || 'Agent run started successfully';
      const processed = data?.result?.records_processed;
      const affected = data?.result?.records_affected;
      
      if (processed !== undefined && affected !== undefined) {
        toast.success(`${message} - Processed: ${processed}, Affected: ${affected}`);
      } else {
        toast.success(message);
      }
    },
    onError: (error: Error) => {
      agentLogger.error('Agent run mutation error:', error);
      toast.error(toastError(error, 'Failed to run agent'), {
        description: 'Please try again or contact support if the issue persists.',
      });
    },
  });

  const getAgentIcon = (type: string) => {
    const iconProps = { className: "h-5 w-5" };
    switch (type) {
      case "lead_qualification":
        return <Bot {...iconProps} />;
      case "follow_up":
        return <Activity {...iconProps} />;
      case "meeting_scheduler":
        return <Clock {...iconProps} />;
      case "data_enrichment":
        return <CheckCircle {...iconProps} />;
      default:
        return <Bot {...iconProps} />;
    }
  };

  if (isLoading) {
    return <div>Loading agents...</div>;
  }

  if (!agents || agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No AI Agents Found</CardTitle>
          <CardDescription>
            AI agents should be automatically created for your organization. If you're seeing this message,
            there may have been an issue during setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Please contact support or check your database migrations to ensure agents are properly seeded.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {agents?.map((agent) => {
          const agentRuns = recentRuns?.filter((run) => run.agent_id === agent.id) || [];
          const successRate =
            agentRuns.length > 0
              ? (agentRuns.filter((r) => r.status === "completed").length / agentRuns.length) * 100
              : 0;

          return (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  {getAgentIcon(agent.agent_type)}
                  <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAgent.mutate(agent.id)}
                    disabled={agent.status !== 'active' || runAgent.isPending}
                  >
                    {runAgent.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </>
                    )}
                  </Button>
                  <Switch
                    checked={agent.status === "active"}
                    onCheckedChange={(enabled) =>
                      toggleAgent.mutate({ agentId: agent.id, enabled })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{agent.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                      {agent.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {successRate.toFixed(0)}% success
                    </span>
                  </div>
                  {agent.last_run_at && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}
                    </p>
                  )}
                  {agent.next_run_at && agent.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      Next run: {formatDistanceToNow(new Date(agent.next_run_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {recentRuns && recentRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last {Math.min(recentRuns.length, 5)} agent runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns?.slice(0, 5).map((run) => {
                const agent = agents?.find((a) => a.id === run.agent_id);
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {run.status === "completed" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : run.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{agent?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                      {run.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Clock, CheckCircle, XCircle, Activity, Play, TrendingUp, Sparkles, RefreshCw, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { agentLogger } from "@/lib/logger";
import { ProactiveAgentSuggestions, AgentHealthIndicator, AgentRealtimeProvider } from "@/components/agents";
import { useAgentRealtime } from "@/hooks/use-agent-realtime";

interface Agent {
  id: string;
  name: string;
  agent_type: string;
  status: string;
  schedule: string;
  last_run_at: string | null;
  next_run_at: string | null;
  description: string | null;
  enabled: boolean;
}

interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  records_processed: number;
  records_affected: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export default function AIAgents() {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const queryClient = useQueryClient();
  const { isConnected, registeredAgents } = useAgentRealtime();

  const { data: agents, isLoading: agentsLoading, refetch } = useQuery({
    queryKey: ["ai-agents", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization found");
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!effectiveOrgId,
  });

  const { data: recentRuns, isLoading: runsLoading } = useQuery({
    queryKey: ["ai-agent-runs", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization found");
      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as AgentRun[];
    },
    enabled: !!effectiveOrgId,
    refetchInterval: 10000,
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
      toast.error(`Failed to update agent: ${error.message}`);
    },
  });

  const runAgent = useMutation({
    mutationFn: async (agentId: string) => {
      agentLogger.info('Running agent:', agentId);
      const { data, error } = await supabase.functions.invoke('run-agent', {
        body: { agent_id: agentId, manual: true },
      });
      if (error) throw new Error(error.message || 'Failed to run agent');
      if (!data?.success) throw new Error(data?.error || 'Agent execution failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-runs'] });
      const message = data?.result?.message || 'Agent run started successfully';
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(`Failed to run agent: ${error.message}`);
    },
  });

  // Calculate summary stats
  const totalRuns = recentRuns?.length || 0;
  const successfulRuns = recentRuns?.filter(r => r.status === 'completed').length || 0;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
  const totalRecordsProcessed = recentRuns?.reduce((sum, run) => sum + (run.records_processed || 0), 0) || 0;
  const activeAgents = agents?.filter(a => a.status === 'active').length || 0;

  const isLoading = agentsLoading || runsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            AI Agents
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated data enrichment and quality management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <Badge variant="outline" className="text-green-600 border-green-500/30">
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Proactive AI Suggestions */}
      <ProactiveAgentSuggestions />

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold">{activeAgents}/{agents?.length || 0}</p>
              </div>
              <Bot className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Runs</p>
                <p className="text-2xl font-bold">{totalRuns}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Records Processed</p>
                <p className="text-2xl font-bold">{totalRecordsProcessed.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Agents</h2>
        
        {(!agents || agents.length === 0) ? (
          <Card className="p-8 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No AI Agents Configured</h3>
            <p className="text-sm text-muted-foreground">
              AI agents will be automatically created for your organization.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const agentRuns = recentRuns?.filter((run) => run.agent_id === agent.id) || [];
              const lastRun = agentRuns[0];
              const agentSuccessRate = agentRuns.length > 0
                ? Math.round((agentRuns.filter((r) => r.status === "completed").length / agentRuns.length) * 100)
                : 0;

              return (
                <Card key={agent.id} className={`transition-all ${agent.status === 'active' ? 'border-primary/30' : 'opacity-75'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agent.status === 'active' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Sparkles className={`h-5 w-5 ${agent.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <CardDescription className="text-xs">{agent.agent_type.replace(/_/g, ' ')}</CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={agent.status === "active"}
                        onCheckedChange={(enabled) => toggleAgent.mutate({ agentId: agent.id, enabled })}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {agent.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                          {agent.status}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{agentSuccessRate}% success</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runAgent.mutate(agent.id)}
                        disabled={agent.status !== 'active' || runAgent.isPending}
                      >
                        {runAgent.isPending ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span className="ml-1.5">Run</span>
                      </Button>
                    </div>

                    {agent.last_run_at && (
                      <p className="text-xs text-muted-foreground">
                        Last run: {formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {recentRuns && recentRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Last {Math.min(recentRuns.length, 10)} agent runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns.slice(0, 10).map((run) => {
                const agent = agents?.find((a) => a.id === run.agent_id);
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {run.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : run.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{agent?.name || "Unknown Agent"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <span className="font-medium">{run.records_affected || 0}</span>
                        <span className="text-muted-foreground">/{run.records_processed || 0}</span>
                      </div>
                      <Badge 
                        variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {run.status}
                      </Badge>
                    </div>
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
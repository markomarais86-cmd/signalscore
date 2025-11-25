import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, TrendingUp, Activity } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

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

interface Agent {
  id: string;
  name: string;
  agent_type: string;
}

export function AgentRunHistory() {
  const { userProfile } = useAuth();

  const { data: agents } = useQuery({
    queryKey: ["ai-agents", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, agent_type")
        .eq("org_id", userProfile.org_id);

      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!userProfile?.org_id,
  });

  const { data: runs, isLoading } = useQuery({
    queryKey: ["ai-agent-runs-history", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AgentRun[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return <div>Loading run history...</div>;
  }

  // Calculate success rate by agent
  const successRateData = agents?.map((agent) => {
    const agentRuns = runs?.filter((run) => run.agent_id === agent.id) || [];
    const completedRuns = agentRuns.filter((r) => r.status === "completed").length;
    const successRate = agentRuns.length > 0 ? (completedRuns / agentRuns.length) * 100 : 0;

    return {
      name: agent.name.replace(" Agent", ""),
      successRate: Math.round(successRate),
      total: agentRuns.length,
    };
  }) || [];

  // Calculate daily run volume
  const dailyRunData = runs?.reduce((acc, run) => {
    const date = format(new Date(run.started_at), "MMM dd");
    const existing = acc.find((d) => d.date === date);
    if (existing) {
      existing.runs += 1;
      if (run.status === "completed") existing.successful += 1;
    } else {
      acc.push({
        date,
        runs: 1,
        successful: run.status === "completed" ? 1 : 0,
      });
    }
    return acc;
  }, [] as { date: string; runs: number; successful: number }[]).slice(-14) || [];

  const totalTimeSaved = runs?.reduce((total, run) => {
    if (run.status === "completed") {
      // Estimate 5 minutes saved per affected record
      return total + (run.records_affected || 0) * 5;
    }
    return total;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs?.length
                ? Math.round((runs.filter((r) => r.status === "completed").length / runs.length) * 100)
                : 0}
              %
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs?.reduce((sum, run) => sum + (run.records_processed || 0), 0).toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalTimeSaved / 60)} hrs</div>
            <p className="text-xs text-muted-foreground">Estimated</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Success Rate by Agent</CardTitle>
            <CardDescription>Percentage of successful runs per agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="successRate" fill="hsl(var(--primary))" name="Success Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Run Volume</CardTitle>
            <CardDescription>Agent execution trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyRunData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="runs" stroke="hsl(var(--primary))" name="Total Runs" />
                <Line type="monotone" dataKey="successful" stroke="hsl(142, 76%, 36%)" name="Successful" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Runs</CardTitle>
          <CardDescription>Last 50 agent executions with detailed status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {runs?.slice(0, 50).map((run) => {
              const agent = agents?.find((a) => a.id === run.agent_id);
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {run.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{agent?.name || "Unknown Agent"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                      </p>
                      {run.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate">{run.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {run.records_affected}/{run.records_processed}
                      </p>
                      <p className="text-xs text-muted-foreground">affected</p>
                    </div>
                    <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                      {run.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

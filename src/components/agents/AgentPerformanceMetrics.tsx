import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export function AgentPerformanceMetrics() {
  const { userProfile } = useAuth();

  const { data: performanceData } = useQuery({
    queryKey: ["agent-performance", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      // Get all agents
      const { data: agents } = await supabase
        .from("ai_agents")
        .select("id, name, agent_type")
        .eq("org_id", userProfile.org_id);

      if (!agents) return null;

      // Get performance metrics for each agent
      const agentMetrics = await Promise.all(
        agents.map(async (agent) => {
          const { data: runs } = await supabase
            .from("ai_agent_runs")
            .select("*")
            .eq("agent_id", agent.id)
            .order("started_at", { ascending: false })
            .limit(30);

          const totalRuns = runs?.length || 0;
          const successfulRuns = runs?.filter(r => r.status === "completed").length || 0;
          const totalProcessed = runs?.reduce((sum, r) => sum + (r.records_processed || 0), 0) || 0;
          const totalAffected = runs?.reduce((sum, r) => sum + (r.records_affected || 0), 0) || 0;

          return {
            name: agent.name,
            type: agent.agent_type,
            successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
            totalRuns,
            recordsProcessed: totalProcessed,
            recordsAffected: totalAffected,
            runs: runs || []
          };
        })
      );

      return agentMetrics;
    },
    enabled: !!userProfile?.org_id,
  });

  if (!performanceData) {
    return <div>Loading performance metrics...</div>;
  }

  const successRateData = performanceData.map(agent => ({
    name: agent.name.replace(" Agent", ""),
    successRate: agent.successRate,
    totalRuns: agent.totalRuns
  }));

  const impactData = performanceData.map(agent => ({
    name: agent.name.replace(" Agent", ""),
    processed: agent.recordsProcessed,
    affected: agent.recordsAffected
  }));

  const totalTimeSaved = performanceData.reduce((sum, agent) => {
    // Estimate 5 minutes saved per affected record
    return sum + (agent.recordsAffected * 5);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.reduce((sum, a) => sum + a.totalRuns, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold">
                {(performanceData.reduce((sum, a) => sum + a.successRate, 0) / performanceData.length).toFixed(0)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Records Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">
                {performanceData.reduce((sum, a) => sum + a.recordsAffected, 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">
                {(totalTimeSaved / 60).toFixed(0)}h
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Success Rates</CardTitle>
          <CardDescription>Percentage of successful agent runs</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={successRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="successRate" fill="hsl(var(--primary))" name="Success Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Impact</CardTitle>
          <CardDescription>Records processed vs records affected by each agent</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={impactData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="processed" fill="hsl(var(--muted))" name="Processed" />
              <Bar dataKey="affected" fill="hsl(var(--primary))" name="Affected" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

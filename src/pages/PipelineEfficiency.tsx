import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePipelineData } from "@/hooks/use-pipeline-data";
import { useBenchmarks } from "@/hooks/use-benchmarks";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { formatNumber } from "@/utils/format-numbers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Target, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function PipelineEfficiency() {
  const { metrics, isLoading, isPending, error } = usePipelineData();
  const { pipelineBenchmarks, isLoading: benchmarksLoading, isPending: benchmarksPending, hasCustomBenchmarks } = useBenchmarks('pipeline_conversion');

  if (isLoading || benchmarksLoading) return <LoadingState message="Loading pipeline efficiency data..." fullScreen />;

  if (error) {
    return (
      <Layout>
        <div className="p-8">
          <EmptyState
            title="Error Loading Pipeline Data"
            description={error}
          />
        </div>
      </Layout>
    );
  }

  if (!metrics || metrics.totalLeads === 0) {
    return (
      <Layout>
        <div className="p-8">
          <EmptyState
            title="No Pipeline Data Yet"
            description="Start tracking pipeline stages to see efficiency metrics and conversion rates."
          />
        </div>
      </Layout>
    );
  }

  const stageColors = {
    dial: "hsl(var(--chart-1))",
    connect: "hsl(var(--chart-2))",
    meeting: "hsl(var(--chart-3))",
    opportunity: "hsl(var(--chart-4))",
    closed_won: "hsl(var(--primary))",
  };

  const isRefreshing = isPending || benchmarksPending;

  return (
    <Layout>
      <div className={cn("p-8 space-y-8", isRefreshing && "opacity-70 transition-opacity")}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pipeline Efficiency</h1>
            <p className="text-muted-foreground mt-2">
              Analyze conversion rates and identify bottlenecks in your sales funnel
            </p>
          </div>
          <Link to="/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              {hasCustomBenchmarks ? 'Edit Benchmarks' : 'Configure Benchmarks'}
            </Button>
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metrics.totalLeads)}</div>
              <p className="text-xs text-muted-foreground mt-1">In pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Conversion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.overallConversion.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Dial to Close</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(metrics.avgCycleTime)}h</div>
              <p className="text-xs text-muted-foreground mt-1">Per stage</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Won</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.stages.find(s => s.stage === "closed_won")?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total deals</p>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Lead progression through pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={metrics.stages}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="stage" 
                  className="text-xs"
                  tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {metrics.stages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stageColors[entry.stage as keyof typeof stageColors]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion Rates & Benchmarks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Stage Performance</CardTitle>
                <CardDescription>
                  Conversion rates vs. {hasCustomBenchmarks ? 'your custom' : 'industry'} benchmarks
                </CardDescription>
              </div>
              {!hasCustomBenchmarks && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Using default benchmarks
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.stages.map((stage, idx) => {
                if (idx === 0) return null; // Skip first stage
                const benchmark = pipelineBenchmarks[stage.stage] || 30;
                const isBelowBenchmark = stage.conversionRate < benchmark;

                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{stage.stage.replace('_', ' ')}</span>
                        {isBelowBenchmark ? (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm font-medium",
                          isBelowBenchmark ? "text-destructive" : "text-primary"
                        )}>
                          {stage.conversionRate.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (Benchmark: {benchmark}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          isBelowBenchmark ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${Math.min(stage.conversionRate, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stage.count} leads</span>
                      <span>Avg: {Math.round(stage.avgDuration)}h in stage</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

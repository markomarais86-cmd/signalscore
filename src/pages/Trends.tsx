import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrendData } from '@/hooks/use-trend-data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Trends() {
  const [period, setPeriod] = useState<number>(90);
  const { metrics, isLoading, refresh } = useTrendData(period);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trend Analysis</h1>
            <p className="text-muted-foreground mt-2">
              Visualize performance trends across all metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="180">Last 6 Months</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={refresh}>
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Score Trends */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Score Trends</CardTitle>
                  <CardDescription>Overall, Fit, Intent, Reachability over time</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics?.scoreTrends.overall.map((point, idx) => ({
                  date: formatDate(point.date),
                  overall: point.value,
                  fit: metrics.scoreTrends.fit[idx]?.value || 0,
                  intent: metrics.scoreTrends.intent[idx]?.value || 0,
                  reachability: metrics.scoreTrends.reachability[idx]?.value || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="overall" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="fit" stroke="hsl(var(--chart-1))" />
                  <Line type="monotone" dataKey="intent" stroke="hsl(var(--chart-2))" />
                  <Line type="monotone" dataKey="reachability" stroke="hsl(var(--chart-3))" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Data Quality Trends */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Data Quality Trends</CardTitle>
                  <CardDescription>Overall completeness percentage</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics?.dataQualityTrends.map(point => ({
                  date: formatDate(point.date),
                  completeness: point.value,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completeness" 
                    stroke="hsl(var(--chart-4))" 
                    strokeWidth={2}
                    name="Completeness %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ICP Match Rate Trends */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>ICP Match Rate</CardTitle>
                  <CardDescription>Percentage of accounts matching ICP</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics?.icpMatchRateTrends.map(point => ({
                  date: formatDate(point.date),
                  matchRate: point.value,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="matchRate" 
                    stroke="hsl(var(--chart-5))" 
                    strokeWidth={2}
                    name="Match Rate %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pipeline Velocity Trends */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Pipeline Velocity</CardTitle>
                  <CardDescription>Average days to close won deals</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics?.pipelineVelocityTrends.map(point => ({
                  date: formatDate(point.date),
                  days: point.value,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="days" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    name="Days to Close"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {metrics && (
          metrics.scoreTrends.overall.length === 0 &&
          metrics.dataQualityTrends.length === 0 &&
          metrics.icpMatchRateTrends.length === 0 &&
          metrics.pipelineVelocityTrends.length === 0
        ) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trend data available</h3>
              <p className="text-muted-foreground text-center">
                Historical data will appear here as your metrics are tracked over time
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

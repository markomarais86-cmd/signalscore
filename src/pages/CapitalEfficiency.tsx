import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, ComposedChart, Area, AreaChart } from "recharts";
import { DollarSign, TrendingUp, Clock, Calculator, Target, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BenchmarkComparison } from "@/components/BenchmarkComparison";

const chartConfig = {
  investment: {
    label: "Investment",
    color: "hsl(var(--chart-1))",
  },
  pipeline: {
    label: "Pipeline",
    color: "hsl(var(--chart-2))",
  },
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-3))",
  },
  efficiency: {
    label: "Efficiency",
    color: "hsl(var(--chart-4))",
  }
};

export default function CapitalEfficiency() {
  const [timeFilter, setTimeFilter] = useState("12");
  
  // Mock capital efficiency data
  const efficiencyData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
    investment: Math.round(100000 + Math.random() * 50000),
    pipeline: Math.round(400000 + Math.random() * 200000),
    revenue: Math.round(150000 + Math.random() * 100000),
    efficiency: Math.round(2.5 + Math.random() * 1.5),
    cacPayback: Math.round(8 + Math.random() * 4),
    roas: Math.round(3.2 + Math.random() * 1.8)
  }));

  // Current period metrics
  const currentMetrics = {
    totalInvestment: 1200000,
    pipelineGenerated: 5800000,
    revenueGenerated: 2100000,
    pipelineMultiplier: 4.8,
    revenueMultiplier: 1.75,
    cacPayback: 9.5,
    roas: 4.2,
    efficiencyScore: 87
  };

  // Benchmark data
  const benchmarkData = [
    { metric: "Pipeline Multiplier", value: currentMetrics.pipelineMultiplier, benchmark: 3.5, unit: "x", trend: 8 },
    { metric: "Revenue Multiplier", value: currentMetrics.revenueMultiplier, benchmark: 2.2, unit: "x", trend: -5 },
    { metric: "CAC Payback", value: currentMetrics.cacPayback, benchmark: 12, unit: " mo", trend: -2 },
    { metric: "ROAS", value: currentMetrics.roas, benchmark: 3.0, unit: "x", trend: 12 }
  ];

  // Channel efficiency breakdown
  const channelData = [
    { channel: "Email Campaigns", investment: 45000, pipeline: 280000, revenue: 95000, efficiency: 6.2, roas: 2.1 },
    { channel: "Paid Social", investment: 78000, pipeline: 310000, revenue: 125000, efficiency: 4.0, roas: 1.6 },
    { channel: "Content Marketing", investment: 65000, pipeline: 420000, revenue: 180000, efficiency: 6.5, roas: 2.8 },
    { channel: "Events", investment: 120000, pipeline: 890000, revenue: 380000, efficiency: 7.4, roas: 3.2 },
    { channel: "Outbound Sales", investment: 180000, pipeline: 1200000, revenue: 580000, efficiency: 6.7, roas: 3.2 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Capital Efficiency</h1>
          <p className="text-muted-foreground">Investment performance and ROI analysis</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Efficiency Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Multiplier</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.pipelineMultiplier}x</div>
            <p className="text-xs text-muted-foreground">
              $1 → ${currentMetrics.pipelineMultiplier} pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Multiplier</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.revenueMultiplier}x</div>
            <p className="text-xs text-muted-foreground">
              $1 → ${currentMetrics.revenueMultiplier} revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC Payback</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.cacPayback} mo</div>
            <p className="text-xs text-muted-foreground">
              21% faster than benchmark
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROAS</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics.roas}x</div>
            <p className="text-xs text-muted-foreground">
              Return on ad spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Trends */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Investment → Pipeline → Revenue</CardTitle>
            <CardDescription>
              Capital flow and conversion over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={efficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="investment" 
                    fill="var(--color-investment)"
                    name="Investment"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pipeline" 
                    stroke="var(--color-pipeline)" 
                    strokeWidth={3}
                    name="Pipeline Generated"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--color-revenue)" 
                    strokeWidth={3}
                    name="Revenue Generated"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <BenchmarkComparison 
          data={benchmarkData}
          title="Efficiency vs Industry"
          description="Key efficiency metrics compared to benchmarks"
        />
      </div>

      {/* Channel Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Efficiency Analysis</CardTitle>
          <CardDescription>
            Investment performance by channel and activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {channelData.map((channel, index) => (
              <div key={channel.channel} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{channel.channel}</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">Efficiency Score</div>
                      <div className="text-lg font-bold text-primary">{channel.efficiency}x</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">ROAS</div>
                      <div className="text-lg font-bold">{channel.roas}x</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Investment</div>
                    <div className="font-medium">${channel.investment.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Pipeline Generated</div>
                    <div className="font-medium">${channel.pipeline.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Revenue Generated</div>
                    <div className="font-medium">${channel.revenue.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Pipeline Efficiency</span>
                    <span>{((channel.pipeline / channel.investment) * 100).toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={Math.min((channel.pipeline / channel.investment) / 10 * 100, 100)}
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Efficiency Score Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Capital Efficiency Score</CardTitle>
          <CardDescription>
            Overall efficiency score trending over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={efficiencyData}>
                <defs>
                  <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 6]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="efficiency" 
                  stroke="hsl(var(--chart-4))" 
                  fillOpacity={1}
                  fill="url(#efficiencyGradient)"
                  strokeWidth={3}
                  name="Efficiency Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
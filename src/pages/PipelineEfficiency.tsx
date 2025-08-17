import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, FunnelChart, Funnel, Cell } from "recharts";
import { TrendingUp, ArrowDown, Users, PhoneCall, Calendar, Briefcase, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const chartConfig = {
  current: {
    label: "Current Period",
    color: "hsl(var(--chart-1))",
  },
  previous: {
    label: "Previous Period", 
    color: "hsl(var(--chart-2))",
  },
  benchmark: {
    label: "Industry Benchmark",
    color: "hsl(var(--muted-foreground))",
  }
};

const FUNNEL_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))", 
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function PipelineEfficiency() {
  const [timeFilter, setTimeFilter] = useState("30");
  
  // Mock pipeline funnel data
  const funnelData = [
    { name: "Dials", value: 10000, conversion: 100, benchmark: 100, icon: PhoneCall },
    { name: "Connects", value: 2500, conversion: 25, benchmark: 20, icon: Users },
    { name: "Meetings", value: 750, conversion: 30, benchmark: 25, icon: Calendar },
    { name: "Opportunities", value: 225, conversion: 30, benchmark: 28, icon: Briefcase },
    { name: "Revenue", value: 90, conversion: 40, benchmark: 35, icon: DollarSign },
  ];

  // Mock drop-off analysis data
  const dropOffData = [
    { stage: "Dials → Connects", current: 75, previous: 73, benchmark: 80, improvement: 2 },
    { stage: "Connects → Meetings", current: 70, previous: 68, benchmark: 75, improvement: 2 },
    { stage: "Meetings → Opps", current: 70, previous: 72, benchmark: 72, improvement: -2 },
    { stage: "Opps → Revenue", current: 60, previous: 55, benchmark: 65, improvement: 5 },
  ];

  // Mock efficiency metrics over time
  const efficiencyTrend = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
    pipelineEfficiency: Math.round(25 + Math.random() * 15),
    benchmark: 28,
    revenue: Math.round(50000 + Math.random() * 30000)
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pipeline Efficiency</h1>
          <p className="text-muted-foreground">Funnel analysis and conversion optimization</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline Funnel Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>
              Volume and conversion rates at each stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((stage, index) => {
                const IconComponent = stage.icon;
                const isLast = index === funnelData.length - 1;
                const dropOff = !isLast ? ((stage.value - funnelData[index + 1].value) / stage.value) * 100 : 0;
                
                return (
                  <div key={stage.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <span className="font-medium">{stage.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{stage.value.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {stage.conversion}% conv rate
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-8">
                      <Progress 
                        value={(stage.conversion / Math.max(...funnelData.map(d => d.conversion))) * 100}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>vs {stage.benchmark}% benchmark</span>
                        {!isLast && (
                          <span className="text-[hsl(var(--signal-low))]">
                            -{Math.round(dropOff)}% drop-off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage Performance Analysis</CardTitle>
            <CardDescription>
              Conversion rates vs benchmarks and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dropOffData.map((stage, index) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{stage.current}%</span>
                      <div className={`flex items-center text-xs ${
                        stage.improvement > 0 ? 'text-[hsl(var(--signal-high))]' : 'text-[hsl(var(--signal-low))]'
                      }`}>
                        {stage.improvement > 0 ? '+' : ''}{stage.improvement}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Progress value={stage.current} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Previous: {stage.previous}%</span>
                      <span>Benchmark: {stage.benchmark}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Efficiency Trends</CardTitle>
          <CardDescription>
            Overall pipeline performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="efficiency" orientation="left" />
                <YAxis yAxisId="revenue" orientation="right" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  yAxisId="efficiency"
                  dataKey="pipelineEfficiency" 
                  fill="var(--color-current)"
                  name="Pipeline Efficiency %"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  yAxisId="efficiency"
                  dataKey="benchmark" 
                  fill="var(--color-benchmark)"
                  name="Industry Benchmark %"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Biggest Drop-off</CardTitle>
            <ArrowDown className="h-4 w-4 text-[hsl(var(--signal-low))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">Dials → Connects</div>
            <p className="text-xs text-muted-foreground">
              75% loss rate, 5% below benchmark
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">Opps → Revenue</div>
            <p className="text-xs text-muted-foreground">
              60% conversion, 5% improvement MoM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Velocity</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42 days</div>
            <p className="text-xs text-muted-foreground">
              Average deal cycle, -8% vs last quarter
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
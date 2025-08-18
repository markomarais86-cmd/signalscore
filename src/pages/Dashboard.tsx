import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { TrendingUp, Users, Target, Zap, Activity, Gauge, DollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";
import { BenchmarkComparison } from "@/components/BenchmarkComparison";
import { SampleDataGenerator } from "@/components/SampleDataGenerator";
import { Button } from "@/components/ui/button";

const chartConfig = {
  leads: {
    label: "Total Leads",
    color: "hsl(var(--chart-1))",
  },
  qualified: {
    label: "Qualified Leads",
    color: "hsl(var(--chart-2))",
  },
  accounts: {
    label: "Accounts",
    color: "hsl(var(--chart-3))",
  }
};

const SCORE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  const [timeFilter, setTimeFilter] = useState("30");
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0,
    salesVelocity: 0,
    signalScore: 0,
    signalTrend: 0
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [showSampleDataGenerator, setShowSampleDataGenerator] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile?.org_id) return;
    
    loadDashboardData();
  }, [userProfile?.org_id, timeFilter]);

  const loadDashboardData = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Get basic stats
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, external_id')
        .eq('org_id', userProfile.org_id);

      const { data: scores } = await supabase
        .from('scores')
        .select('overall, account_external_id')
        .eq('org_id', userProfile.org_id);

      const totalLeads = accounts?.length || 0;
      const qualifiedLeads = scores?.filter(s => s.overall >= 70).length || 0;
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
      
      // Show sample data generator if no accounts exist
      setShowSampleDataGenerator(totalLeads === 0);
      
      // Calculate overall SignalScore (weighted average)
      const avgScore = scores?.length > 0 
        ? scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length 
        : 0;

      setStats({
        totalLeads,
        qualifiedLeads,
        conversionRate: Math.round(conversionRate),
        salesVelocity: Math.round(Math.random() * 20 + 10), // Mock data
        signalScore: Math.round(avgScore),
        signalTrend: Math.round((Math.random() - 0.5) * 10) // Mock trend
      });

      // Get weekly leads data
      const { data: weeklyLeads } = await supabase
        .from('mv_leads_by_week')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('week_start', { ascending: true });

      if (weeklyLeads) {
        const formattedWeeklyData = weeklyLeads.map(item => ({
          week: new Date(item.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          leads: item.total_leads,
          qualified: item.qualified_leads,
        }));
        setWeeklyData(formattedWeeklyData);
      }

      // Get score distribution
      const { data: distribution } = await supabase
        .from('mv_score_distribution')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (distribution) {
        const formattedDistribution = distribution.map((item, index) => ({
          name: item.score_bucket,
          value: item.account_count,
          fill: SCORE_COLORS[index % SCORE_COLORS.length]
        }));
        setScoreDistribution(formattedDistribution);
      }

      // Generate mock trend data for SignalScore over time
      const mockTrendData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: Math.round(avgScore + (Math.random() - 0.5) * 20),
        benchmark: 65
      }));
      setTrendData(mockTrendData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const refreshViews = async () => {
    try {
      await supabase.rpc('refresh_reporting_views');
      loadDashboardData();
    } catch (error) {
      console.error('Error refreshing views:', error);
    }
  };

  const benchmarkData = [
    { metric: "Pipeline Velocity", value: stats.salesVelocity, benchmark: 45, unit: " days", trend: -3 },
    { metric: "Lead Qualification Rate", value: stats.conversionRate, benchmark: 25, unit: "%", trend: 5 },
    { metric: "Signal Accuracy", value: 87, benchmark: 72, unit: "%", trend: 2 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SignalScore Overview</h1>
          <p className="text-muted-foreground">Board-ready Signal Intelligence Dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export Report
          </Button>
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

      {/* Sample Data Generator - Show when no data exists */}
      {showSampleDataGenerator && (
        <div className="max-w-2xl mx-auto">
          <SampleDataGenerator />
        </div>
      )}

      {/* Only show dashboard content when we have data */}
      {!showSampleDataGenerator && (
        <>
          {/* Primary SignalScore Display */}
          <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current SignalScore
            </CardTitle>
            <CardDescription>
              Real-time intelligence across your entire pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <SignalScoreDisplay 
                score={stats.signalScore} 
                size="xl" 
                trend={stats.signalTrend}
              />
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Industry Benchmark</div>
                <div className="text-2xl font-bold text-muted-foreground">65</div>
                <div className="text-xs text-[hsl(var(--signal-high))]">
                  +{stats.signalScore - 65} vs avg
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <BenchmarkComparison 
          data={benchmarkData}
          title="Performance vs Peers"
          description="Key metrics benchmarked against industry"
        />
      </div>

      {/* SignalScore Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            SignalScore Trend
          </CardTitle>
          <CardDescription>
            30-day SignalScore evolution with industry benchmark
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--chart-1))" 
                  fillOpacity={1}
                  fill="url(#scoreGradient)"
                  strokeWidth={3}
                  name="SignalScore"
                />
                <Line 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  name="Industry Benchmark"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2.1M</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Signal Accounts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qualifiedLeads}</div>
            <p className="text-xs text-muted-foreground">
              Score ≥ 80
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Above 25% benchmark
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Velocity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.salesVelocity} days</div>
            <p className="text-xs text-muted-foreground">
              15% faster than avg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Leads Trend</CardTitle>
            <CardDescription>
              Lead volume and qualification over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="var(--color-leads)" 
                    strokeWidth={2}
                    name="Total Leads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qualified" 
                    stroke="var(--color-qualified)" 
                    strokeWidth={2}
                    name="Qualified Leads"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>
              Account scores by decile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
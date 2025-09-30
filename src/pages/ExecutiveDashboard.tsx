import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Target, Zap, Download, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const [timeFilter, setTimeFilter] = useState<string>("30d");
  const [metrics, setMetrics] = useState({
    signalScore: 78,
    signalScoreTrend: 12,
    highSignalAccounts: 0,
    conversionRate: 0,
    pipelineValue: 0,
    salesVelocity: 45,
    cacPayback: 8.5,
    roas: 4.2,
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadDashboardData();
    }
  }, [userProfile, timeFilter]);

  const loadDashboardData = async () => {
    try {
      const { data: accounts, error: accountsError } = await supabase
        .from('scores')
        .select('*')
        .eq('org_id', userProfile?.org_id)
        .gte('overall', 70);

      if (accountsError) throw accountsError;

      const { data: allAccounts, error: allAccountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (allAccountsError) throw allAccountsError;

      const { data: leads, error: leadsError } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (leadsError) throw leadsError;

      const highSignalCount = accounts?.length || 0;
      const totalAccounts = allAccounts?.length || 1;
      const qualifiedLeads = leads?.filter(l => l.status === 'qualified').length || 0;
      const totalLeads = leads?.length || 1;

      setMetrics({
        signalScore: 78,
        signalScoreTrend: 12,
        highSignalAccounts: highSignalCount,
        conversionRate: (qualifiedLeads / totalLeads) * 100,
        pipelineValue: highSignalCount * 250000,
        salesVelocity: 45,
        cacPayback: 8.5,
        roas: 4.2,
      });

      // 30-day trend data
      setTrendData([
        { day: 'Day 1', score: 68 },
        { day: 'Day 5', score: 70 },
        { day: 'Day 10', score: 72 },
        { day: 'Day 15', score: 74 },
        { day: 'Day 20', score: 76 },
        { day: 'Day 25', score: 77 },
        { day: 'Day 30', score: 78 },
      ]);

      setPerformanceData([
        { month: 'Jan', value: 2.8, benchmark: 3.5 },
        { month: 'Feb', value: 3.2, benchmark: 3.5 },
        { month: 'Mar', value: 3.8, benchmark: 3.5 },
        { month: 'Apr', value: 4.2, benchmark: 3.5 },
      ]);

      setBenchmarkData([
        { metric: 'Win Rate', company: 68, industry: 52 },
        { metric: 'Velocity', company: 45, industry: 62 },
        { metric: 'Deal Size', company: 250, industry: 180 },
        { metric: 'CAC Payback', company: 8.5, industry: 12 },
      ]);

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const handleExport = () => {
    toast.success('Exporting report...');
  };

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUpRight className="h-5 w-5 text-[hsl(var(--executive-green))]" />;
    if (value < 0) return <ArrowDownRight className="h-5 w-5 text-[hsl(var(--executive-red))]" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Intelligence Command Center
          </h1>
          <p className="text-base text-muted-foreground mt-2">
            Real-time GTM performance and signal intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Hero Metric - SignalScore */}
      <Card className="border-2 border-primary/20 shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <CardContent className="pt-8 pb-6 relative">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Big Number */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Overall SignalScore
                </p>
                <div className="flex items-baseline gap-4">
                  <span className="text-7xl font-bold text-primary">
                    {metrics.signalScore}
                  </span>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--executive-green))]/10">
                    <TrendIcon value={metrics.signalScoreTrend} />
                    <span className="text-lg font-bold text-[hsl(var(--executive-green))]">
                      +{metrics.signalScoreTrend}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  vs last period • Industry benchmark: 65
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    High-Signal Accounts
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics.highSignalAccounts}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Conversion Rate
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics.conversionRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Trend Visualization */}
            <div className="flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#scoreGradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supporting Metrics - Horizontal Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pipeline Value
              </p>
              <DollarSign className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              ${(metrics.pipelineValue / 1000000).toFixed(1)}M
            </p>
            <div className="flex items-center gap-1">
              <TrendIcon value={12} />
              <span className="text-xs font-semibold text-[hsl(var(--executive-green))]">
                +12%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sales Velocity
              </p>
              <Zap className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {metrics.salesVelocity} days
            </p>
            <div className="flex items-center gap-1">
              <TrendIcon value={-5} />
              <span className="text-xs font-semibold text-[hsl(var(--executive-green))]">
                -5%
              </span>
              <span className="text-xs text-muted-foreground">faster close</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                CAC Payback
              </p>
              <Target className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {metrics.cacPayback} mo
            </p>
            <div className="flex items-center gap-1">
              <TrendIcon value={-2} />
              <span className="text-xs font-semibold text-[hsl(var(--executive-green))]">
                -2%
              </span>
              <span className="text-xs text-muted-foreground">improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ROAS
              </p>
              <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">
              {metrics.roas}x
            </p>
            <div className="flex items-center gap-1">
              <TrendIcon value={15} />
              <span className="text-xs font-semibold text-[hsl(var(--executive-green))]">
                +15%
              </span>
              <span className="text-xs text-muted-foreground">growth</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deep Dive Section with Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted">
          <TabsTrigger value="performance" className="font-semibold">
            Performance Analysis
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="font-semibold">
            Competitive Benchmarks
          </TabsTrigger>
          <TabsTrigger value="trends" className="font-semibold">
            Market Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">ROAS Performance Trend</CardTitle>
              <CardDescription>Return on ad spend vs industry benchmark</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#performanceGradient)"
                    name="Your ROAS"
                    strokeWidth={3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="benchmark" 
                    stroke="hsl(var(--muted-foreground))" 
                    name="Industry Avg"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmarks" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Performance vs Peers</CardTitle>
              <CardDescription>Key metrics compared to industry average</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={benchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="metric" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="company" 
                    fill="hsl(var(--primary))" 
                    name="Your Company"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="industry" 
                    fill="hsl(var(--muted-foreground) / 0.3)" 
                    name="Industry Avg"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Market Intelligence Trends</CardTitle>
              <CardDescription>Emerging patterns in your target market</CardDescription>
            </CardHeader>
            <CardContent className="h-96 flex items-center justify-center">
              <p className="text-muted-foreground">Market trend analysis coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

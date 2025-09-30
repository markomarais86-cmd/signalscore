import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExportToPdf } from "@/components/executive/ExportToPdf";
import { StatusIndicator } from "@/components/executive/StatusIndicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { TrendingUp, DollarSign, Target, Zap, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const [timeFilter, setTimeFilter] = useState<string>("30d");
  const [metrics, setMetrics] = useState({
    pipelineValue: 0,
    highSignalAccounts: 0,
    conversionRate: 0,
    salesVelocity: 0,
    cacPayback: 0,
    roas: 0,
  });
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadDashboardData();
    }
  }, [userProfile, timeFilter]);

  const loadDashboardData = async () => {
    try {
      // Fetch high signal accounts (score >= 70)
      const { data: accounts, error: accountsError } = await supabase
        .from('scores')
        .select('*')
        .eq('org_id', userProfile?.org_id)
        .gte('overall', 70);

      if (accountsError) throw accountsError;

      // Fetch all accounts for conversion calculation
      const { data: allAccounts, error: allAccountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (allAccountsError) throw allAccountsError;

      // Fetch leads
      const { data: leads, error: leadsError } = await supabase
        .from('Leads')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (leadsError) throw leadsError;

      // Calculate metrics
      const highSignalCount = accounts?.length || 0;
      const totalAccounts = allAccounts?.length || 1;
      const qualifiedLeads = leads?.filter(l => l.status === 'qualified').length || 0;
      const totalLeads = leads?.length || 1;

      setMetrics({
        pipelineValue: highSignalCount * 250000, // Avg deal size estimate
        highSignalAccounts: highSignalCount,
        conversionRate: (qualifiedLeads / totalLeads) * 100,
        salesVelocity: 45, // Mock for now - days to close
        cacPayback: 8.5, // Mock - months
        roas: 4.2, // Mock - return on ad spend
      });

      // Mock performance trend data
      setPerformanceData([
        { month: 'Jan', value: 2.8, benchmark: 3.5 },
        { month: 'Feb', value: 3.2, benchmark: 3.5 },
        { month: 'Mar', value: 3.8, benchmark: 3.5 },
        { month: 'Apr', value: 4.2, benchmark: 3.5 },
      ]);

      // Mock benchmark comparison data
      setBenchmarkData([
        { metric: 'Win Rate', company: 68, industry: 52 },
        { metric: 'Sales Velocity', company: 45, industry: 62 },
        { metric: 'Deal Size', company: 250, industry: 180 },
        { metric: 'CAC Payback', company: 8.5, industry: 12 },
      ]);

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const handleExport = (format: 'pdf' | 'pptx' | 'csv') => {
    toast.success(`Exporting ${format.toUpperCase()} report...`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-base text-muted-foreground mt-1">
            Strategic overview of sales intelligence and pipeline performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator
            value={75}
            threshold={{ low: 50, medium: 70, high: 85 }}
            showTrend
            trend={5}
          />
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
          <ExportToPdf onExport={handleExport} variant="default" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ExecutiveMetricCard
          title="Pipeline Value"
          value={`$${(metrics.pipelineValue / 1000000).toFixed(1)}M`}
          subtitle="High-signal opportunities"
          icon={DollarSign}
          trend={{ value: 12, period: "vs last month" }}
          status={{
            value: 75,
            threshold: { low: 50, medium: 70, high: 85 }
          }}
        />
        
        <ExecutiveMetricCard
          title="High-Signal Accounts"
          value={metrics.highSignalAccounts.toString()}
          subtitle="Score ≥ 70"
          icon={Target}
          trend={{ value: 8, period: "vs last month" }}
          status={{
            value: metrics.highSignalAccounts > 5 ? 85 : 65,
            threshold: { low: 50, medium: 70, high: 85 }
          }}
        />
        
        <ExecutiveMetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          subtitle="ICP vs non-ICP"
          icon={TrendingUp}
          trend={{ value: -3, period: "vs last month" }}
          status={{
            value: metrics.conversionRate,
            threshold: { low: 30, medium: 50, high: 70 }
          }}
        />
        
        <ExecutiveMetricCard
          title="Sales Velocity"
          value={`${metrics.salesVelocity} days`}
          subtitle="Avg time to close"
          icon={Zap}
          trend={{ value: -5, period: "vs last month" }}
          status={{
            value: metrics.salesVelocity < 50 ? 85 : 65,
            threshold: { low: 50, medium: 70, high: 85 }
          }}
        />
        
        <ExecutiveMetricCard
          title="CAC Payback"
          value={`${metrics.cacPayback} mo`}
          subtitle="Customer acquisition cost"
          icon={DollarSign}
          trend={{ value: -2, period: "vs last month" }}
          status={{
            value: metrics.cacPayback < 12 ? 85 : 65,
            threshold: { low: 50, medium: 70, high: 85 }
          }}
        />
        
        <ExecutiveMetricCard
          title="ROAS"
          value={`${metrics.roas}x`}
          subtitle="Return on ad spend"
          icon={TrendingUp}
          trend={{ value: 15, period: "vs last month" }}
          status={{
            value: metrics.roas > 3 ? 85 : 65,
            threshold: { low: 50, medium: 70, high: 85 }
          }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance Trend */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">ROAS Performance Trend</CardTitle>
            <CardDescription>Return on ad spend vs industry benchmark</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
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
                  fill="hsl(var(--primary) / 0.1)" 
                  name="Your ROAS"
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="hsl(var(--muted-foreground))" 
                  fill="transparent" 
                  name="Industry Avg"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Benchmark Comparison */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Performance vs Peers</CardTitle>
            <CardDescription>Key metrics compared to industry average</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={benchmarkData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="metric" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
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
                  radius={[6, 6, 0, 0]}
                />
                <Bar 
                  dataKey="industry" 
                  fill="hsl(var(--muted-foreground) / 0.3)" 
                  name="Industry Avg"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

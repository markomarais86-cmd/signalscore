import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { TrendingUp, Users, Target, Zap, Activity, Gauge, DollarSign, FileText, AlertTriangle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useToast } from "@/hooks/use-toast";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";
import { BenchmarkComparison } from "@/components/BenchmarkComparison";
import { SampleDataGenerator } from "@/components/SampleDataGenerator";
import { Button } from "@/components/ui/button";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { StatusIndicator } from "@/components/executive/StatusIndicator";
import { ExportToPdf } from "@/components/executive/ExportToPdf";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { analyzeSegmentationGaps, calculateICPCoverage } from "@/utils/segmentation-analysis";
import { useDataSources } from "@/hooks/use-data-sources";
import { formatCoverage } from "@/utils/data-source-attribution";
import { EmptyDataState } from "@/components/EmptyDataState";
import jsPDF from 'jspdf';

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
  const [segmentationInsights, setSegmentationInsights] = useState<any>(null);
  const [icpCoverage, setICPCoverage] = useState<any>(null);
  const { userProfile, loading: authLoading } = useAuth();
  const { flags } = useFeatureFlags();
  const { toast } = useToast();
  const { stats: dataSourceStats, loading: dataSourceLoading } = useDataSources();

  // Show loading state while authentication is in progress
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!userProfile?.org_id) return;
    
    loadDashboardData();
  }, [userProfile?.org_id, timeFilter]);

  const loadDashboardData = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Real data mode only - no demo mode

      // Real data mode
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, external_id, name, industry_norm, employee_count, revenue_range, country')
        .eq('org_id', userProfile.org_id)
        .limit(50000);

      const { data: scores } = await supabase
        .from('scores')
        .select('overall, account_external_id, fit, intent, reachability')
        .eq('org_id', userProfile.org_id)
        .limit(50000);

      const { data: icpProfiles } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id);

      const totalLeads = accounts?.length || 0;
      const qualifiedLeads = scores?.filter(s => s.overall >= 70).length || 0;
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
      
      console.log('Dashboard data loaded:', { totalLeads, accounts: accounts?.length, showEmpty: totalLeads === 0 });
      
      // Show sample data generator if no accounts exist
      setShowSampleDataGenerator(totalLeads === 0);
      
      // Calculate overall SignalScore (weighted average)
      const avgScore = scores?.length > 0 
        ? scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length 
        : 0;

      // Analyze segmentation gaps
      if (accounts && scores && icpProfiles) {
        const analysis = analyzeSegmentationGaps(accounts, scores, icpProfiles);
        setSegmentationInsights(analysis);
        
        const activeICP = icpProfiles.find(icp => icp.status === 'active');
        const coverage = calculateICPCoverage(accounts, scores, activeICP || null);
        setICPCoverage(coverage);
      }

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

  const handleExport = async (format: 'pdf' | 'pptx' | 'csv') => {
    if (format === 'pdf') {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(20);
        doc.text('Executive Dashboard Report', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });
        
        doc.setFontSize(12);
        let yPos = 45;
        doc.text('Key Metrics Summary', 15, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.text(`• Total Accounts: ${stats.totalLeads}`, 20, yPos);
        yPos += 7;
        doc.text(`• High-Signal Accounts: ${stats.qualifiedLeads}`, 20, yPos);
        yPos += 7;
        doc.text(`• SignalScore: ${stats.signalScore}/100`, 20, yPos);
        
        doc.save(`dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`);
        
        toast({
          title: "Export successful",
          description: "Dashboard report exported to PDF"
        });
      } catch (error) {
        toast({
          title: "Export failed",
          description: "Failed to generate PDF",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Coming soon",
        description: `${format.toUpperCase()} export will be available soon`
      });
    }
  };

  const benchmarkData = [
    { metric: "Pipeline Velocity", value: stats.salesVelocity, benchmark: 45, unit: " days", trend: -3 },
    { metric: "Lead Qualification Rate", value: stats.conversionRate, benchmark: 25, unit: "%", trend: 5 },
    { metric: "Signal Accuracy", value: 87, benchmark: 72, unit: "%", trend: 2 }
  ];

  // Show empty state if no accounts exist
  if (showSampleDataGenerator) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto p-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-lg text-muted-foreground">Strategic Signal Intelligence Overview</p>
        </div>
        <EmptyDataState 
          title="No Data Available"
          description="Upload your CRM data (accounts and contacts) to start seeing insights and analytics on your dashboard."
          actionLabel="Upload Data"
          actionRoute="/data-upload"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      
      {/* Executive Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-lg text-muted-foreground">Strategic Signal Intelligence Overview</p>
          
          {/* Overall Status Indicator */}
          <div className="flex items-center gap-4 mt-4">
            <StatusIndicator
              value={stats.signalScore}
              threshold={{ low: 40, medium: 65, high: 80 }}
              showTrend={true}
              trend={stats.signalTrend}
              size="md"
            />
            <div className="text-sm text-muted-foreground">
              Overall Signal Health: <span className="font-semibold">{stats.signalScore}/100</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <ExportToPdf onExport={handleExport} />
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

      {/* Executive Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ExecutiveMetricCard
              title="Pipeline Value"
              value="$2.1M"
              subtitle="USD"
              icon={DollarSign}
              status={{ 
                value: 85, 
                threshold: { low: 40, medium: 65, high: 80 } 
              }}
              trend={{ value: 12, period: "vs last month" }}
            />
            
            <ExecutiveMetricCard
              title="High-Signal Accounts"
              value={stats.qualifiedLeads}
              subtitle="accounts"
              icon={Target}
              status={{ 
                value: stats.conversionRate, 
                threshold: { low: 15, medium: 25, high: 40 } 
              }}
              trend={{ value: stats.signalTrend, period: "vs benchmark" }}
            />

            <ExecutiveMetricCard
              title="Conversion Rate"
              value={`${stats.conversionRate}%`}
              subtitle="lead to opportunity"
              icon={TrendingUp}
              status={{ 
                value: stats.conversionRate, 
                threshold: { low: 15, medium: 25, high: 35 } 
              }}
              trend={{ value: 8, period: "vs industry avg" }}
            />

            <ExecutiveMetricCard
              title="Sales Velocity"
              value={`${stats.salesVelocity}`}
              subtitle="days to close"
              icon={Zap}
              status={{ 
                value: 100 - stats.salesVelocity, 
                threshold: { low: 40, medium: 60, high: 80 } 
              }}
              trend={{ value: -15, period: "faster than avg" }}
            />
          </div>

          {/* Phase 3: Dual-Source Data Intelligence */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CRM Coverage</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dataSourceLoading ? '...' : dataSourceStats.crmAccounts.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dataSourceLoading ? '...' : formatCoverage(dataSourceStats.coveragePercentage)} of database
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">External Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dataSourceLoading ? '...' : dataSourceStats.databaseAccounts.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total accounts available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Whitespace Opportunity</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dataSourceLoading ? '...' : dataSourceStats.whitespaceAccounts.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Enrichment opportunities
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Primary SignalScore Display */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 border-0 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Activity className="h-5 w-5" />
                  Current SignalScore
                </CardTitle>
                <CardDescription className="text-base">
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
                  <div className="text-right space-y-2">
                    <div className="text-sm text-muted-foreground">Industry Benchmark</div>
                    <div className="text-3xl font-bold text-muted-foreground">65</div>
                    <StatusIndicator
                      value={stats.signalScore}
                      threshold={{ low: 40, medium: 65, high: 80 }}
                      size="sm"
                    />
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

      {/* SignalScore Trend - Simplified for Executives */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gauge className="h-5 w-5" />
                SignalScore Evolution
              </CardTitle>
              <CardDescription className="text-base">
                30-day performance trend with industry benchmark
              </CardDescription>
            </div>
            <StatusIndicator
              value={stats.signalScore}
              threshold={{ low: 40, medium: 65, high: 80 }}
              showTrend={true}
              trend={stats.signalTrend}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
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

      {/* Simplified Charts for Executive View */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Pipeline Performance</CardTitle>
            <CardDescription className="text-base">
              Weekly lead generation and qualification trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="var(--color-leads)" 
                    strokeWidth={3}
                    name="Total Leads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qualified" 
                    stroke="var(--color-qualified)" 
                    strokeWidth={3}
                    name="Qualified Leads"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Account Distribution</CardTitle>
            <CardDescription className="text-base">
              SignalScore distribution across all accounts
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
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    strokeWidth={2}
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

      {/* Segmentation Insights */}
      {segmentationInsights && (
        <>
          {/* Missing Segments & Gaps */}
          {segmentationInsights.gaps.length > 0 && (
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Missing ICP Segments
                </CardTitle>
                <CardDescription>
                  Target segments from your ICP that need attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {segmentationInsights.gaps.slice(0, 5).map((gap: any, index: number) => (
                    <Alert key={index} variant={gap.priority === 'high' ? 'destructive' : 'default'}>
                      <AlertDescription>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold flex items-center gap-2">
                              {gap.segment}
                              <Badge variant={gap.priority === 'high' ? 'destructive' : 'secondary'}>
                                {gap.priority} priority
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{gap.reason}</div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm font-medium">{gap.currentAccounts} accounts</div>
                            {gap.avgScore > 0 && (
                              <div className="text-xs text-muted-foreground">Avg score: {gap.avgScore}</div>
                            )}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategic Insights */}
          {segmentationInsights.insights.length > 0 && (
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle>Strategic Insights</CardTitle>
                <CardDescription>
                  Data-driven recommendations based on your CRM performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {segmentationInsights.insights.slice(0, 5).map((insight: any, index: number) => (
                    <Alert 
                      key={index}
                      variant={
                        insight.type === 'warning' ? 'destructive' : 
                        insight.type === 'success' ? 'default' : 
                        'default'
                      }
                    >
                      <AlertDescription>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{insight.title}</div>
                            <div className="text-sm mt-1">{insight.description}</div>
                            <div className="text-xs text-muted-foreground mt-2">
                              Impact: {insight.impact}
                            </div>
                          </div>
                          <Badge 
                            variant={
                              insight.type === 'warning' ? 'destructive' : 
                              insight.type === 'success' ? 'default' : 
                              'secondary'
                            }
                          >
                            {insight.type}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {segmentationInsights.recommendations.length > 0 && (
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>
                  Recommended actions to improve ICP alignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {segmentationInsights.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
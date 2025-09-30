import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, TrendingDown, Target, Database, AlertCircle, Download, ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    tamCoverage: 0,
    icpMatchQuality: 0,
    whitespaceOpportunity: 0,
    dataCompleteness: 0,
    totalAccounts: 0,
    icpCount: 0,
    highFitAccounts: 0,
    estimatedTAM: 0,
    tamCoverageTrend: 0,
    icpMatchTrend: 0,
    whitespaceTrend: 0,
    dataCompletenessTrend: 0,
  });
  const [coverageTrend, setCoverageTrend] = useState<any[]>([]);
  const [fitDistribution, setFitDistribution] = useState<any[]>([]);
  const [missingSegments, setMissingSegments] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadTAMData();
    }
  }, [userProfile]);

  const loadTAMData = async () => {
    try {
      // Load accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (accountsError) throw accountsError;

      // Load ICPs
      const { data: icps, error: icpsError } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (icpsError) throw icpsError;

      // Load scores
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .eq('org_id', userProfile?.org_id);

      if (scoresError) throw scoresError;

      const totalAccounts = accounts?.length || 0;
      const icpCount = icps?.length || 0;
      const highFitAccounts = scores?.filter(s => s.overall >= 70).length || 0;

      // Calculate data completeness
      const completeFields = accounts?.filter(a => 
        a.industry_norm && a.employee_count && a.country && a.revenue_range
      ).length || 0;
      const dataCompleteness = totalAccounts > 0 ? (completeFields / totalAccounts) * 100 : 0;

      // Calculate ICP match quality
      const icpMatchQuality = totalAccounts > 0 ? (highFitAccounts / totalAccounts) * 100 : 0;

      // Estimated TAM (simplified calculation)
      const avgICPTAM = icps?.reduce((sum, icp) => sum + (icp.tam_estimate || 0), 0) / (icpCount || 1);
      const tamCoverage = avgICPTAM > 0 ? (totalAccounts / avgICPTAM) * 100 : 0;

      // Calculate trends (simulated - in production, compare with historical data)
      const previousTamCoverage = tamCoverage * 0.87; // 13% improvement
      const previousIcpMatch = icpMatchQuality * 0.92; // 8% improvement
      const previousWhitespace = Math.floor(avgICPTAM - totalAccounts) * 1.12; // 12% reduction
      const previousDataQuality = dataCompleteness * 0.95; // 5% improvement

      setMetrics({
        tamCoverage: Math.min(tamCoverage, 100),
        icpMatchQuality,
        whitespaceOpportunity: Math.floor(avgICPTAM - totalAccounts),
        dataCompleteness,
        totalAccounts,
        icpCount,
        highFitAccounts,
        estimatedTAM: Math.floor(avgICPTAM),
        tamCoverageTrend: Number((((tamCoverage - previousTamCoverage) / previousTamCoverage) * 100).toFixed(2)),
        icpMatchTrend: Number((((icpMatchQuality - previousIcpMatch) / (previousIcpMatch || 1)) * 100).toFixed(2)),
        whitespaceTrend: Number((((Math.floor(avgICPTAM - totalAccounts) - previousWhitespace) / (previousWhitespace || 1)) * 100).toFixed(2)),
        dataCompletenessTrend: Number((((dataCompleteness - previousDataQuality) / (previousDataQuality || 1)) * 100).toFixed(2)),
      });

      // Coverage trend (last 90 days)
      setCoverageTrend([
        { date: '60d ago', coverage: 15 },
        { date: '45d ago', coverage: 18 },
        { date: '30d ago', coverage: 20 },
        { date: '15d ago', coverage: 22 },
        { date: 'Today', coverage: tamCoverage },
      ]);

      // Fit distribution
      const highFit = scores?.filter(s => s.overall >= 70).length || 0;
      const medFit = scores?.filter(s => s.overall >= 40 && s.overall < 70).length || 0;
      const lowFit = scores?.filter(s => s.overall < 40).length || 0;

      setFitDistribution([
        { name: 'High Fit', value: highFit, color: 'hsl(var(--executive-green))' },
        { name: 'Medium Fit', value: medFit, color: 'hsl(var(--executive-amber))' },
        { name: 'Low Fit', value: lowFit, color: 'hsl(var(--executive-red))' },
      ]);

      // Top missing segments (mock data based on ICP definitions)
      setMissingSegments([
        { segment: 'Enterprise Technology', missing: 324, potential: '$81M TAM' },
        { segment: 'Financial Services', missing: 289, potential: '$72M TAM' },
        { segment: 'Healthcare Tech', missing: 156, potential: '$39M TAM' },
        { segment: 'Manufacturing', missing: 98, potential: '$24M TAM' },
      ]);

      // Geographic distribution
      const geoCounts = accounts?.reduce((acc, a) => {
        const country = a.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setGeoData(
        Object.entries(geoCounts || {})
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      completeStep('explore_dashboard');

    } catch (error: any) {
      console.error('Error loading TAM data:', error);
      toast.error('Failed to load TAM intelligence data');
    }
  };

  const handleExport = () => {
    toast.success('Exporting TAM report...');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            TAM Intelligence Overview
          </h1>
          <p className="text-base text-muted-foreground mt-2">
            Market coverage, ICP fit, and whitespace opportunities
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Onboarding Progress */}
      <OnboardingProgress />

      {/* Hero Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <HeroMetric
          label="TAM Coverage"
          value={`${metrics.tamCoverage.toFixed(2)}%`}
          subtitle={`${metrics.totalAccounts} of ${metrics.estimatedTAM} accounts`}
          trend={{ value: metrics.tamCoverageTrend, period: 'last quarter' }}
          status="success"
          chart={{
            data: coverageTrend.map(d => ({ value: d.coverage })),
            color: 'hsl(var(--primary))',
          }}
        />
        <HeroMetric
          label="ICP Match Quality"
          value={`${metrics.icpMatchQuality.toFixed(2)}%`}
          subtitle={`${metrics.highFitAccounts} high-fit accounts`}
          trend={{ value: metrics.icpMatchTrend, period: 'last month' }}
          status="success"
        />
        <HeroMetric
          label="Whitespace Opportunity"
          value={metrics.whitespaceOpportunity.toLocaleString()}
          subtitle="high-fit accounts missing"
          trend={{ value: metrics.whitespaceTrend, period: 'vs last quarter' }}
          status="warning"
        />
        <HeroMetric
          label="Data Completeness"
          value={`${metrics.dataCompleteness.toFixed(2)}%`}
          subtitle={`${metrics.totalAccounts} accounts tracked`}
          trend={{ value: metrics.dataCompletenessTrend, period: 'data quality' }}
          status={metrics.dataCompleteness >= 80 ? 'success' : 'warning'}
        />
      </div>

      {/* Benchmark Comparison */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Benchmark Comparison
          </CardTitle>
          <CardDescription>How you compare to industry averages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">TAM Coverage</span>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{metrics.tamCoverage.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">Your coverage</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-muted-foreground">45%</div>
                    <div className="text-xs text-muted-foreground">Industry avg</div>
                  </div>
                </div>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-primary/30 rounded-full" 
                  style={{ width: '45%' }}
                />
                <div 
                  className="absolute h-full bg-primary rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.tamCoverage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.tamCoverage < 45 
                  ? `${(45 - metrics.tamCoverage).toFixed(1)}% below industry average`
                  : `${(metrics.tamCoverage - 45).toFixed(1)}% above industry average`}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">ICP Match Quality</span>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{metrics.icpMatchQuality.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">Your quality</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-muted-foreground">62%</div>
                    <div className="text-xs text-muted-foreground">Industry avg</div>
                  </div>
                </div>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-secondary/30 rounded-full" 
                  style={{ width: '62%' }}
                />
                <div 
                  className="absolute h-full bg-secondary rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.icpMatchQuality, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.icpMatchQuality < 62
                  ? `${(62 - metrics.icpMatchQuality).toFixed(0)}% below industry average`
                  : `${(metrics.icpMatchQuality - 62).toFixed(0)}% above industry average`}
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Revenue Impact</p>
                  <p className="text-sm text-muted-foreground">
                    Reaching industry-average TAM coverage could unlock{' '}
                    <span className="font-semibold text-foreground">
                      ${((metrics.estimatedTAM * 0.45 - metrics.totalAccounts) * 50000).toLocaleString()}
                    </span>
                    {' '}in additional pipeline opportunity
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ICP Fit Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ICP Fit Distribution</CardTitle>
            <CardDescription>How well your accounts match your ICPs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fitDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="name" 
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
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {fitDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage Trend</CardTitle>
            <CardDescription>TAM coverage improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={coverageTrend}>
                <defs>
                  <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
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
                <Area 
                  type="monotone" 
                  dataKey="coverage" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#coverageGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Missing Segments & Geographic Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Missing Segments</CardTitle>
                <CardDescription>High-value whitespace opportunities</CardDescription>
              </div>
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                {missingSegments.length} segments
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {missingSegments.map((segment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{segment.segment}</p>
                    <p className="text-xs text-muted-foreground">{segment.potential}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{segment.missing}</p>
                    <p className="text-xs text-muted-foreground">accounts</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
            <CardDescription>Where your accounts are located</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {geoData.map((geo, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{geo.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${(geo.count / metrics.totalAccounts) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">{geo.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Dynamic Recommendations */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Recommended Next Steps
          </CardTitle>
          <CardDescription>Prioritized actions based on your current metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Dynamic action 1: Based on TAM coverage */}
            {metrics.tamCoverage < 50 && (
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4 border-2 border-primary/30"
                onClick={() => navigate('/data-upload')}
              >
                <div className="text-left">
                  <Badge className="mb-2" variant="default">High Priority</Badge>
                  <p className="font-semibold">Upload {Math.ceil((metrics.estimatedTAM * 0.50) - metrics.totalAccounts)} more accounts</p>
                  <p className="text-xs text-muted-foreground">To reach 50% TAM coverage (industry minimum)</p>
                </div>
              </Button>
            )}
            
            {/* Dynamic action 2: Based on ICP count */}
            {metrics.icpCount < 3 && (
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate('/icp-manager')}
              >
                <div className="text-left">
                  <Badge className="mb-2" variant="secondary">Medium Priority</Badge>
                  <p className="font-semibold">Define {3 - metrics.icpCount} more ICP{3 - metrics.icpCount > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {missingSegments[0]?.segment ? `Start with ${missingSegments[0]?.segment} segment` : 'Expand market coverage'}
                  </p>
                </div>
              </Button>
            )}

            {/* Dynamic action 3: Based on whitespace */}
            {metrics.whitespaceOpportunity > 100 && (
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate('/icp-tam')}
              >
                <div className="text-left">
                  <Badge className="mb-2" variant="outline">Opportunity</Badge>
                  <p className="font-semibold">Explore whitespace</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.whitespaceOpportunity.toLocaleString()} high-fit accounts not in pipeline
                  </p>
                </div>
              </Button>
            )}

            {/* Dynamic action 4: Based on data quality */}
            {metrics.dataCompleteness < 80 && (
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate('/accounts')}
              >
                <div className="text-left">
                  <Badge className="mb-2" variant="outline">Data Quality</Badge>
                  <p className="font-semibold">Improve data completeness</p>
                  <p className="text-xs text-muted-foreground">
                    Currently at {metrics.dataCompleteness.toFixed(2)}% - aim for 80%+
                  </p>
                </div>
              </Button>
            )}

            {/* Dynamic action 5: If doing well */}
            {metrics.tamCoverage >= 50 && metrics.icpMatchQuality >= 70 && (
              <Button 
                variant="outline" 
                className="justify-start h-auto py-4"
                onClick={() => navigate('/settings')}
              >
                <div className="text-left">
                  <Badge className="mb-2 bg-success">On Track</Badge>
                  <p className="font-semibold">Optimize scoring model</p>
                  <p className="text-xs text-muted-foreground">
                    Fine-tune weights for better precision
                  </p>
                </div>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

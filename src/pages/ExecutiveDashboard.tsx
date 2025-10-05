import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Sparkles, Building2, Settings, AlertCircle, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { useICPInsights } from "@/hooks/use-icp-insights";
import { Lightbulb } from "lucide-react";
import { DataSourceBreakdownCard } from "@/components/executive/DataSourceBreakdownCard";
import { ScoringDataQualityCard } from "@/components/executive/ScoringDataQualityCard";
import { RiskExceptionsPanel, RiskItem } from "@/components/executive/RiskExceptionsPanel";
import { TrendIndicator } from "@/components/executive/TrendIndicator";
import { calculateTrends, TrendData } from "@/utils/trend-calculator";
import { detectRisks } from "@/utils/risk-detector";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const { insights, statistics, loading: insightsLoading, generateInsights } = useICPInsights();
  
  const [metrics, setMetrics] = useState({
    totalAccounts: 0,
    crmAccounts: 0,
    databaseAccounts: 0,
    bothSourcesAccounts: 0,
    totalScored: 0,
    crmScored: 0,
    databaseScored: 0,
    highFitAccounts: 0,
    highFitCrmAccounts: 0,
    highFitDatabaseAccounts: 0,
    averageScore: 0,
    icpMatchQuality: 0,
    scoringProgress: 0,
    completenessScore: 0,
    industryCompleteness: 0,
    sizeCompleteness: 0,
    revenueCompleteness: 0,
    geoCompleteness: 0,
    contactsCompleteness: 0,
    campaignReadyAccounts: 0,
    campaignReadyLeads: 0,
    coverage: 0,
    totalLeads: 0,
    linkedLeads: 0,
    unlinkedLeads: 0,
    crmLeads: 0,
    databaseLeads: 0,
    highFitLeads: 0,
    highFitCrmLeads: 0,
    highFitDatabaseLeads: 0
  });
  
  const [fitDistribution, setFitDistribution] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [trends, setTrends] = useState<TrendData>({
    scoringProgress: 0,
    completeness: 0,
    highFitAccounts: 0,
    campaignReady: 0
  });
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadUnifiedData();
    }
  }, [userProfile?.org_id]);

  const loadUnifiedData = async () => {
    if (!userProfile?.org_id) return;
    
    console.log('📊 Loading dashboard data for org:', userProfile.org_id);
    setLoading(true);
    try {
      // Fetch all accounts with data source info
      const { data: accounts, error: accountsError, count: accountsCount } = await supabase
        .from('accounts')
        .select('*, data_source, external_database_match', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📦 Accounts fetched:', accounts?.length, 'Total count:', accountsCount, 'Error:', accountsError);

      if (accountsError) throw accountsError;

      // Fetch scores
      const { data: scores, error: scoresError, count: scoresCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📈 Scores fetched:', scores?.length, 'Total count:', scoresCount, 'Error:', scoresError);

      if (scoresError) throw scoresError;

      // Fetch ICP profiles
      const { data: icpProfiles, error: icpError } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'active');

      if (icpError) throw icpError;

      // Fetch contacts for reachability metrics
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id);

      if (contactsError) throw contactsError;

      // Fetch leads
      const { data: leads, error: leadsError, count: leadsCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .limit(10000);

      console.log('📋 Leads fetched:', leads?.length, 'Total count:', leadsCount, 'Error:', leadsError);

      if (leadsError) throw leadsError;

      // Get accurate counts for data sources
      const { count: crmCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .in('data_source', ['crm', 'both']);

      const { count: databaseCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'database');

      const { count: bothCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('data_source', 'both');

      const { count: linkedLeadsCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .not('account_external_id', 'is', null);

      // Count leads by account source using database function
      const { data: crmLeadsData } = await supabase
        .rpc('count_leads_by_account_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'crm'
        });

      const { data: databaseLeadsData } = await supabase
        .rpc('count_leads_by_account_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'database'
        });

      const { data: highFitLeadsData } = await supabase
        .rpc('count_high_fit_leads', {
          p_org_id: userProfile.org_id
        });

      // Get high-fit breakdowns by data source
      const { data: highFitCrmAccountsData } = await supabase
        .rpc('count_high_fit_accounts_by_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'crm'
        });

      const { data: highFitDatabaseAccountsData } = await supabase
        .rpc('count_high_fit_accounts_by_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'database'
        });

      const { data: highFitCrmLeadsData } = await supabase
        .rpc('count_high_fit_leads_by_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'crm'
        });

      const { data: highFitDatabaseLeadsData } = await supabase
        .rpc('count_high_fit_leads_by_source', {
          p_org_id: userProfile.org_id,
          p_data_source: 'database'
        });

      const { data: campaignReadyData } = await supabase
        .rpc('count_campaign_ready_accounts', {
          p_org_id: userProfile.org_id
        });

      const { data: campaignReadyLeadsData } = await supabase
        .rpc('count_campaign_ready_leads', {
          p_org_id: userProfile.org_id
        });

      const { data: completenessData } = await supabase
        .rpc('calculate_data_completeness', {
          p_org_id: userProfile.org_id
        });

      const crmLeadsCount = crmLeadsData || 0;
      const databaseLeadsCount = databaseLeadsData || 0;
      const highFitLeadsCount = highFitLeadsData || 0;
      const highFitCrmAccountsCount = highFitCrmAccountsData || 0;
      const highFitDatabaseAccountsCount = highFitDatabaseAccountsData || 0;
      const highFitCrmLeadsCount = highFitCrmLeadsData || 0;
      const highFitDatabaseLeadsCount = highFitDatabaseLeadsData || 0;
      const campaignReadyAccounts = campaignReadyData || 0;
      const campaignReadyLeads = campaignReadyLeadsData || 0;
      const completenessScore = completenessData || 0;

      console.log('📋 CRM leads:', crmLeadsCount, 'Database leads:', databaseLeadsCount, 'High fit leads:', highFitLeadsCount);
      console.log('🎯 High-fit CRM accounts:', highFitCrmAccountsCount, 'High-fit Database accounts:', highFitDatabaseAccountsCount);

      const totalAccounts = accountsCount || 0;
      const totalLeads = leadsCount || 0;
      const linkedLeads = linkedLeadsCount || 0;
      const unlinkedLeads = totalLeads - linkedLeads;
      const crmAccounts = crmCount || 0;
      const databaseAccounts = databaseCount || 0;
      const bothSourcesAccounts = bothCount || 0;
      
      // Calculate field-level completeness
      const totalAccountsForCalc = accounts?.length || 1;
      const industryComplete = accounts?.filter(a => a.industry_norm).length || 0;
      const sizeComplete = accounts?.filter(a => a.employee_count).length || 0;
      const revenueComplete = accounts?.filter(a => a.revenue_range).length || 0;
      const geoComplete = accounts?.filter(a => a.country).length || 0;
      
      const accountsWithContacts = new Set(contacts?.map(c => c.account_external_id) || []).size;
      
      const industryCompleteness = Math.round((industryComplete / totalAccountsForCalc) * 100);
      const sizeCompleteness = Math.round((sizeComplete / totalAccountsForCalc) * 100);
      const revenueCompleteness = Math.round((revenueComplete / totalAccountsForCalc) * 100);
      const geoCompleteness = Math.round((geoComplete / totalAccountsForCalc) * 100);
      const contactsCompleteness = Math.round((accountsWithContacts / totalAccountsForCalc) * 100);
      
      console.log('🔢 Total accounts:', totalAccounts, 'Total leads:', totalLeads);
      console.log('📋 Linked leads:', linkedLeads, 'Unlinked leads:', unlinkedLeads);
      console.log('📊 CRM accounts:', crmAccounts, 'Database:', databaseAccounts, 'Both:', bothSourcesAccounts);
      
      // Calculate ICP metrics
      const totalScored = scoresCount || 0;
      
      // Calculate CRM/DB scoring breakdown (after totalScored is defined)
      const crmScoredEstimate = Math.floor((totalScored / totalAccounts) * crmAccounts);
      const databaseScoredEstimate = Math.floor((totalScored / totalAccounts) * databaseAccounts);
      
      const { count: highFitCount, error: highFitError } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);
      
      console.log('🎯 High fit query result:', { highFitCount, highFitError, totalScored });
      
      const highFitAccounts = highFitCount || 0;
      
      console.log('🎯 Total scored:', totalScored, 'High fit:', highFitAccounts);
      const averageScore = scores && scores.length > 0 
        ? Math.round(scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length)
        : 0;

      const icpMatchQuality = highFitAccounts > 0 
        ? Math.round((highFitAccounts / totalAccounts) * 100)
        : 0;
      
      const scoringProgress = totalAccounts > 0
        ? Math.round((totalScored / totalAccounts) * 100)
        : 0;

      // Use database-calculated values
      const finalCompletenessScore = completenessScore;
      const finalCampaignReadyAccounts = campaignReadyAccounts;

      const finalMetrics = {
        totalAccounts,
        totalScored,
        crmScored: crmScoredEstimate,
        databaseScored: databaseScoredEstimate,
        highFitAccounts,
        highFitCrmAccounts: highFitCrmAccountsCount,
        highFitDatabaseAccounts: highFitDatabaseAccountsCount,
        averageScore,
        icpMatchQuality,
        scoringProgress,
        completenessScore: finalCompletenessScore,
        industryCompleteness,
        sizeCompleteness,
        revenueCompleteness,
        geoCompleteness,
        contactsCompleteness,
        coverage: totalAccounts > 0 ? Math.round((crmAccounts / totalAccounts) * 100) : 0,
        crmAccounts,
        databaseAccounts,
        bothSourcesAccounts,
        campaignReadyAccounts: finalCampaignReadyAccounts,
        campaignReadyLeads,
        totalLeads,
        linkedLeads,
        unlinkedLeads,
        crmLeads: crmLeadsCount,
        databaseLeads: databaseLeadsCount,
        highFitLeads: highFitLeadsCount,
        highFitCrmLeads: highFitCrmLeadsCount,
        highFitDatabaseLeads: highFitDatabaseLeadsCount
      };
      
      console.log('✅ Final metrics calculated:', finalMetrics);
      
      setMetrics(finalMetrics);
      
      // Calculate trends (async, don't block rendering)
      calculateTrends(userProfile.org_id, finalMetrics).then(setTrends).catch(console.error);
      
      // Detect risks (async, don't block rendering)
      detectRisks(userProfile.org_id, finalMetrics).then(setRisks).catch(console.error);

      // Generate AI insights if we have scores
      if (totalScored > 0) {
        generateInsights();
      }

      // Fit distribution - use database counts
      const { count: highFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70);

      const { count: medFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('overall', 40)
        .lt('overall', 70);

      const { count: lowFitDistCount } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .lt('overall', 40);

      const highFitValue = highFitDistCount || 0;
      const medFitValue = medFitDistCount || 0;
      const lowFitValue = lowFitDistCount || 0;
      const totalFitAccounts = highFitValue + medFitValue + lowFitValue;

      setFitDistribution([
        { 
          name: 'High Fit', 
          value: highFitValue,
          percentage: totalFitAccounts > 0 ? Math.round((highFitValue / totalFitAccounts) * 100) : 0,
          color: 'hsl(var(--executive-green))' 
        },
        { 
          name: 'Medium Fit', 
          value: medFitValue,
          percentage: totalFitAccounts > 0 ? Math.round((medFitValue / totalFitAccounts) * 100) : 0,
          color: 'hsl(var(--executive-amber))' 
        },
        { 
          name: 'Low Fit', 
          value: lowFitValue,
          percentage: totalFitAccounts > 0 ? Math.round((lowFitValue / totalFitAccounts) * 100) : 0,
          color: 'hsl(var(--executive-red))' 
        },
      ]);

      // Geographic distribution
      const geoCounts = accounts?.reduce((acc, a) => {
        const country = a.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setGeoData(
        Object.entries(geoCounts || {})
          .map(([country, count]) => ({ country, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      completeStep('explore_dashboard');

    } catch (error: any) {
      console.error('Error loading unified data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Loading your unified CRM intelligence...</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Unified view of your CRM data and available opportunities
          </p>
        </div>
      </div>

      <OnboardingProgress />

      {/* Unlinked Leads Status Indicator */}
      {metrics.unlinkedLeads > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              {metrics.unlinkedLeads.toLocaleString()} leads need processing
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/data-upload')}
            >
              Go to Data Upload
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Go-to-Market Intelligence - Nested Cards */}
      <Card className="bg-gradient-to-br from-card to-muted/20 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Go-to-Market Intelligence
          </CardTitle>
          <CardDescription>
            Breakdown of accounts and leads by source with ICP match rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataSourceBreakdownCard
              title="Accounts"
              icon={Building2}
              total={metrics.totalAccounts}
              crm={{
                count: metrics.crmAccounts,
                highFit: metrics.highFitCrmAccounts,
                highFitPercentage: metrics.crmAccounts > 0 
                  ? Number(((metrics.highFitCrmAccounts / metrics.crmAccounts) * 100).toFixed(1))
                  : 0
              }}
              database={{
                count: metrics.databaseAccounts,
                highFit: metrics.highFitDatabaseAccounts,
                highFitPercentage: metrics.databaseAccounts > 0
                  ? Number(((metrics.highFitDatabaseAccounts / metrics.databaseAccounts) * 100).toFixed(1))
                  : 0
              }}
            />
            <DataSourceBreakdownCard
              title="Leads"
              icon={Users}
              total={metrics.totalLeads}
              crm={{
                count: metrics.crmLeads,
                highFit: metrics.highFitCrmLeads,
                highFitPercentage: metrics.crmLeads > 0
                  ? Number(((metrics.highFitCrmLeads / metrics.crmLeads) * 100).toFixed(1))
                  : 0
              }}
              database={{
                count: metrics.databaseLeads,
                highFit: metrics.highFitDatabaseLeads,
                highFitPercentage: metrics.databaseLeads > 0
                  ? Number(((metrics.highFitDatabaseLeads / metrics.databaseLeads) * 100).toFixed(1))
                  : 0
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Quality - Scoring & Data Completeness */}
      <ScoringDataQualityCard
        scoringProgress={metrics.scoringProgress}
        totalScored={metrics.totalScored}
        totalAccounts={metrics.totalAccounts}
        crmScored={metrics.crmScored}
        crmTotal={metrics.crmAccounts}
        databaseScored={metrics.databaseScored}
        databaseTotal={metrics.databaseAccounts}
        completeness={metrics.completenessScore}
        industryCompleteness={metrics.industryCompleteness}
        sizeCompleteness={metrics.sizeCompleteness}
        revenueCompleteness={metrics.revenueCompleteness}
        geoCompleteness={metrics.geoCompleteness}
        contactsCompleteness={metrics.contactsCompleteness}
        scoringTrend={trends.scoringProgress}
        completenessTrend={trends.completeness}
      />

      {/* Unlinked Leads Status */}
      {metrics.unlinkedLeads > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {metrics.unlinkedLeads.toLocaleString()} leads waiting to be matched to accounts (auto-matching enabled in settings)
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings?tab=automation')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Section 3: Readiness - Campaign-Ready Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Campaign-Ready Assets
          </CardTitle>
          <CardDescription>
            High-fit accounts with contact data available for outreach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-4xl font-bold text-primary">{metrics.campaignReadyAccounts.toLocaleString()}</div>
                {trends.campaignReady !== 0 && (
                  <TrendIndicator value={trends.campaignReady} />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">Accounts ready</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-signal-medium">{(metrics.campaignReadyLeads || 0).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mb-4">Leads ready for outreach</p>
            </div>
          </div>
          <Button onClick={() => navigate('/campaign-builder')} className="w-full mt-4">
            Build Campaign List →
          </Button>
        </CardContent>
      </Card>

      {/* ICP Fit Distribution - Enhanced */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ICP Fit Distribution</CardTitle>
              <CardDescription>
                Scored accounts by ICP match quality
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                navigate('/accounts');
                toast.info('Filtered to high-fit accounts');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export High-Fit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fitDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.value.toLocaleString()} accounts ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {fitDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            {fitDistribution.map((item) => (
              <div key={item.name} className="text-center">
                <div className="text-2xl font-bold" style={{ color: item.color }}>
                  {item.value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.name} ({item.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Top Geographies
          </CardTitle>
          <CardDescription>
            Account distribution by country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {geoData.map((geo) => (
              <div key={geo.country} className="flex items-center justify-between">
                <span className="font-medium">{geo.country}</span>
                <Badge variant="secondary">{geo.count.toLocaleString()} accounts</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>
              Based on your current ICP and account data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1">{insight.type}</Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      <p className="text-sm text-primary mt-2 font-medium">
                        Impact: {insight.impact}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Risks & Exceptions */}
      <RiskExceptionsPanel 
        risks={risks}
        onRiskClick={(risk) => {
          console.log('Risk clicked:', risk);
          navigate('/accounts');
          toast.info(`Filtering to: ${risk.title}`);
        }}
      />

      {/* Recommended Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Next Steps</CardTitle>
          <CardDescription>
            Actions to improve your go-to-market strategy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.totalScored === 0 && (
              <Button onClick={() => navigate('/icp-manager')} className="w-full justify-start" variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Define Your ICP Profile
              </Button>
            )}
            {metrics.campaignReadyAccounts > 0 && (
              <Button onClick={() => navigate('/campaign-builder')} className="w-full justify-start" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Build Your First Campaign List
              </Button>
            )}
            {metrics.completenessScore < 70 && (
              <Button onClick={() => navigate('/data-upload')} className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Upload More Account Data
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

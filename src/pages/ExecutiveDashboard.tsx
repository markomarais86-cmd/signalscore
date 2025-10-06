import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
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
import { TrendIndicator } from "@/components/executive/TrendIndicator";
import { calculateTrends, TrendData } from "@/utils/trend-calculator";
import { detectRisks } from "@/utils/risk-detector";
import type { RiskItem } from "@/utils/risk-detector";
import { CombinedScoringICPCard } from "@/components/executive/CombinedScoringICPCard";
import { GeographyChartCard } from "@/components/executive/GeographyChartCard";
import { AIRecommendationsTiles } from "@/components/executive/AIRecommendationsTiles";
import { RisksAndActionsCard } from "@/components/executive/RisksAndActionsCard";
import { ICPCoverageCard } from "@/components/executive/ICPCoverageCard";
import { EnhancedRisksCard } from "@/components/executive/EnhancedRisksCard";

export default function ExecutiveDashboard() {
  const { userProfile } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const sidebar = useSidebar();
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
      
      const industryCompleteness = Math.round((industryComplete / totalAccountsForCalc) * 100);
      const sizeCompleteness = Math.round((sizeComplete / totalAccountsForCalc) * 100);
      const revenueCompleteness = Math.round((revenueComplete / totalAccountsForCalc) * 100);
      const geoCompleteness = Math.round((geoComplete / totalAccountsForCalc) * 100);
      
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

      // Transform insights to include category and route information
      const transformedInsights = (insights || []).map((insight: any) => ({
        ...insight,
        category: insight.category || insight.type || 'firmographic',
        why: insight.why || insight.description,
        action: insight.action || 'View Details',
        route: insight.route || '/accounts',
        filter: insight.filter || {}
      }));

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
          .slice(0, 10)
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

  // Responsive grid based on sidebar state
  const gridClass = !sidebar?.open 
    ? "grid-cols-1 lg:grid-cols-3 gap-6" 
    : "grid-cols-1 lg:grid-cols-2 gap-6";

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
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

      {/* Row 1: ICP Coverage (left) + Scoring/ICP (right) */}
      <div className={`grid ${gridClass}`}>
        <ICPCoverageCard
          totalAccounts={metrics.totalAccounts}
          crmAccounts={metrics.crmAccounts}
          databaseAccounts={metrics.databaseAccounts}
          highFitAccounts={metrics.highFitAccounts}
          highFitCrmAccounts={metrics.highFitCrmAccounts}
          highFitDatabaseAccounts={metrics.highFitDatabaseAccounts}
          totalLeads={metrics.totalLeads}
          crmLeads={metrics.crmLeads}
          databaseLeads={metrics.databaseLeads}
          highFitLeads={metrics.highFitLeads}
          highFitCrmLeads={metrics.highFitCrmLeads}
          highFitDatabaseLeads={metrics.highFitDatabaseLeads}
        />
        
        <CombinedScoringICPCard
        scoringProgress={metrics.scoringProgress}
        totalScored={metrics.totalScored}
        totalAccounts={metrics.totalAccounts}
        crmScored={metrics.crmScored}
        databaseScored={metrics.databaseScored}
        fitDistribution={fitDistribution}
        completeness={metrics.completenessScore}
        industryCompleteness={metrics.industryCompleteness}
        sizeCompleteness={metrics.sizeCompleteness}
        revenueCompleteness={metrics.revenueCompleteness}
        geoCompleteness={metrics.geoCompleteness}
          scoringTrend={trends.scoringProgress}
          completenessTrend={trends.completeness}
        />
      </div>

      {/* Row 2: Campaign-Ready Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Campaign-Ready Assets
          </CardTitle>
          <CardDescription>High-fit accounts with qualified leads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-4xl font-bold text-primary">{metrics.campaignReadyAccounts.toLocaleString()}</div>
                {trends.campaignReady !== 0 && <TrendIndicator value={trends.campaignReady} />}
              </div>
              <p className="text-sm text-muted-foreground">Accounts ready</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-signal-medium">{(metrics.campaignReadyLeads || 0).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Leads ready</p>
            </div>
            <div className="flex items-center">
              <Button 
                onClick={() => navigate('/campaign-builder')} 
                className="w-full"
                disabled={metrics.campaignReadyAccounts === 0}
              >
                Build Campaign List →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Geographic Distribution Chart */}
      <GeographyChartCard geoData={geoData} />

      {/* Row 4: AI Recommendations (Tiles) + Risks & Actions */}
      <div className={`grid ${gridClass}`}>
        <AIRecommendationsTiles 
          insights={
            insights && insights.length > 0 
              ? insights.map((insight: any) => ({
                  ...insight,
                  category: insight.category || insight.type || 'firmographic',
                  why: insight.why || insight.description,
                  action: insight.action || 'View Details',
                  route: insight.route || '/accounts',
                  filter: insight.filter || {}
                }))
              : []
          }
          onRefresh={() => generateInsights()}
        />

        <EnhancedRisksCard
          risks={risks}
          campaignReadyCount={metrics.campaignReadyAccounts}
          completenessScore={metrics.completenessScore}
          totalScored={metrics.totalScored}
          onRiskClick={(risk) => {
            console.log('Risk clicked:', risk);
            if (risk.fix?.action === 'navigate' && risk.fix.target) {
              navigate(risk.fix.target);
            }
            toast.info(`Filtering to: ${risk.title}`);
          }}
        />
      </div>
    </div>
  );
}

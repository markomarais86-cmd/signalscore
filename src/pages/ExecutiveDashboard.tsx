import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Sparkles, Building2, Settings, AlertCircle, Users, RefreshCw, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData, useGeographyData, useSourceFilterStats } from "@/hooks/use-dashboard-data";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useDataChangeListener } from "@/hooks/use-data-change-listener";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeroMetric } from "@/components/executive/HeroMetric";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { useICPInsights } from "@/hooks/use-icp-insights";
import { Lightbulb } from "lucide-react";
import { DataSourceBreakdownCard } from "@/components/executive/DataSourceBreakdownCard";
import { TrendIndicator } from "@/components/executive/TrendIndicator";
import { calculateTrends, TrendData } from "@/utils/trend-calculator";
import { detectRisks, RiskItem } from "@/utils/risk-detector";
import { CombinedScoringICPCard } from "@/components/executive/CombinedScoringICPCard";
import { GeographyChartCard } from "@/components/executive/GeographyChartCard";
import { EnhancedGeographyCard } from "@/components/executive/EnhancedGeographyCard";
import { UnifiedInsightsPanel, Insight } from "@/components/executive/UnifiedInsightsPanel";
import { SyncStatusBadge } from "@/components/executive/SyncStatusBadge";
import { SyncProgressModal } from "@/components/settings/SyncProgressModal";
import { ICPCoverageCard } from "@/components/executive/ICPCoverageCard";
import { EnhancedRisksCard } from "@/components/executive/EnhancedRisksCard";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { TAMSAMSOMCalculator } from "@/components/executive/TAMSAMSOMCalculator";
import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";
import { ExternalGeographyBreakdownCard } from "@/components/executive/ExternalGeographyBreakdownCard";
import { UnifiedTAMCard } from "@/components/executive/UnifiedTAMCard";
import { FitDistributionHero } from "@/components/executive/FitDistributionHero";
import { MarketIntelligenceCard } from "@/components/executive/MarketIntelligenceCard";
import { calculateExternalTAMMetrics } from "@/utils/external-tam-calculator";
import { EmptyState } from "@/components/EmptyState";
import { QuickCampaignButton } from "@/components/executive/QuickCampaignButton";
import { SystemHealthDashboard } from "@/components/settings/SystemHealthDashboard";
import { DataQualityWarning } from "@/components/executive/DataQualityWarning";


export default function ExecutiveDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const sidebar = useSidebar();
  const { insights, statistics, loading: insightsLoading, generateInsights } = useICPInsights();
  
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('crm');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressOpen, setSyncProgressOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'complete' | 'error'>('syncing');
  const [syncBreakdown, setSyncBreakdown] = useState<any>(null);
  
  // Use optimized React Query hooks with source filtering
  const { data: dashboardData, isLoading, error: queryError, refetch } = useDashboardData(userProfile?.org_id, sourceFilter);
  const { data: geographyData } = useGeographyData(userProfile?.org_id, !!dashboardData, sourceFilter);
  const { data: filterStats } = useSourceFilterStats(userProfile?.org_id);

  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [weeklyTrendData, setWeeklyTrendData] = useState<TrendData | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [activeScoringJob, setActiveScoringJob] = useState<any>(null);
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);
  

  const totalAccounts = dashboardData?.metrics?.total_accounts || 0;
  const totalScores = dashboardData?.metrics?.total_scores || 0;
  const campaignReadyAccounts = dashboardData?.metrics?.campaign_ready_accounts || 0;
  const campaignReadyLeads = dashboardData?.metrics?.campaign_ready_leads || 0;
  const dataCompleteness = Math.round(dashboardData?.metrics?.data_completeness || 0);

  const highFitAccounts = dashboardData?.metrics?.high_fit_scores || 0;
  const medFitAccounts = dashboardData?.metrics?.med_fit_scores || 0;
  const lowFitAccounts = dashboardData?.metrics?.low_fit_scores || 0;

  const crmAccounts = dashboardData?.metrics?.crm_accounts || 0;
  const databaseAccounts = dashboardData?.metrics?.database_accounts || 0;
  const bothAccounts = dashboardData?.metrics?.both_accounts || 0;
  const crmScoredAccounts = dashboardData?.metrics?.crm_scored_accounts || 0;
  const databaseScoredAccounts = dashboardData?.metrics?.database_scored_accounts || 0;

  const highFitCrmAccounts = dashboardData?.metrics?.high_fit_crm_accounts || 0;
  const highFitDatabaseAccounts = dashboardData?.metrics?.high_fit_database_accounts || 0;

  const totalLeads = dashboardData?.metrics?.total_leads || 0;
  const crmLeads = dashboardData?.metrics?.crm_leads || 0;
  const databaseLeads = dashboardData?.metrics?.database_leads || 0;
  const highFitLeads = dashboardData?.metrics?.high_fit_leads_total || 0;
  const highFitCrmLeads = dashboardData?.metrics?.high_fit_crm_leads || 0;
  const highFitDatabaseLeads = dashboardData?.metrics?.high_fit_database_leads || 0;


  const icpProfiles = dashboardData?.icpProfiles || [];
  const tamData = dashboardData?.tamData;

  const geographyDistribution = geographyData || [];

  const hasData = totalAccounts > 0;

  // Listen for significant data changes and auto-refresh
  useDataChangeListener({
    onAccountsChanged: async () => {
      console.log('[ExecutiveDashboard] Accounts changed, refreshing dashboard...');
      await refetch();
      toast.info('Dashboard updated with new account data');
    },
    onScoringCompleted: async () => {
      console.log('[ExecutiveDashboard] Scoring completed, refreshing insights...');
      await Promise.all([refetch(), generateInsights()]);
      setLastRefreshed(new Date());
      toast.success('Scoring complete! Dashboard and recommendations updated');
    },
    onEnrichmentCompleted: async () => {
      console.log('[ExecutiveDashboard] Enrichment completed, refreshing dashboard...');
      await refetch();
      toast.success('Enrichment complete! Dashboard updated');
    },
    debounceMs: 3000
  });

  useEffect(() => {
    if (dashboardData) {
      // Calculate 30-day trends
      calculateTrends(userProfile?.org_id || '', dashboardData?.metrics, '30d')
        .then(setTrendData)
        .catch(console.error);
      
      // Calculate 7-day (weekly) trends for fit levels
      calculateTrends(userProfile?.org_id || '', dashboardData?.metrics, '7d')
        .then(setWeeklyTrendData)
        .catch(console.error);

      // Detect risks asynchronously
      detectRisks(userProfile?.org_id || '', dashboardData?.metrics)
        .then(setRisks)
        .catch(console.error);
      
      // Generate insights if we have data
      if (totalScores > 0 && userProfile?.org_id) {
        generateInsights();
      }

      // Check for stale data and active scoring jobs
      checkDataFreshness();
    }
  }, [dashboardData?.metrics, userProfile?.org_id, totalScores]); // Fix: use dashboardData.metrics instead of dashboardData

  const checkDataFreshness = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Check for active scoring jobs
      const { data: activeJob } = await supabase
        .from('bulk_scoring_jobs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'processing')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveScoringJob(activeJob);

      // Check if ICP was updated after last scoring
      const { data: latestICP } = await supabase
        .from('icp_profiles')
        .select('created_at')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: latestScore } = await supabase
        .from('scores')
        .select('computed_at')
        .eq('org_id', userProfile.org_id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestICP && latestScore) {
        const icpDate = new Date(latestICP.created_at);
        const scoreDate = new Date(latestScore.computed_at);
        setIsDataStale(icpDate > scoreDate);
      }
    } catch (error) {
      console.error('Error checking data freshness:', error);
    }
  };

  // Poll for active scoring job status every 3 seconds
  useEffect(() => {
    if (!userProfile?.org_id) return;

    checkDataFreshness();
    
    // Poll every 3 seconds (faster polling for better UX)
    const interval = setInterval(() => {
      checkDataFreshness();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [userProfile?.org_id]);

  useEffect(() => {
    if (userProfile?.org_id) {
      completeStep('viewed_dashboard');
    }
  }, [userProfile?.org_id]); // Remove completeStep from deps to prevent infinite loops

  useEffect(() => {
    if (!insightsLoading && insights?.length === 0) {
      setShowAISuggestions(true);
    } else {
      setShowAISuggestions(false);
    }
  }, [insights, insightsLoading]);

  const handleRefreshInsights = async () => {
    if (!userProfile?.org_id) {
      toast.error("Can't refresh insights - No organization ID found");
      return;
    }

    setRefreshingInsights(true);
    try {
      await generateInsights();
      setLastRefreshed(new Date());
      toast.success("Insights refreshed successfully");
    } catch (error: any) {
      console.error("Error refreshing insights:", error);
      toast.error(error.message || "Failed to refresh insights");
    } finally {
      setRefreshingInsights(false);
    }
  };

  const handleSyncApollo = async () => {
    if (!userProfile?.org_id) {
      toast.error('Organization not found');
      return;
    }

    setIsSyncing(true);
    setSyncProgressOpen(true);
    setSyncStatus('syncing');
    setSyncBreakdown(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-provider', {
        body: {
          org_id: userProfile.org_id,
          provider: 'apollo'
        }
      });

      if (error) throw error;

      setSyncStatus('complete');
      setSyncBreakdown({
        accounts: data?.totalAccounts || 0,
        leads: data?.totalContacts || 0,
        geography: tamData?.geography_breakdown,
        industry: tamData?.industry_breakdown
      });

      toast.success('Apollo sync completed! Refreshing dashboard...');
      
      // Refresh the dashboard data to show the new breakdowns
      setTimeout(() => {
        refetch();
      }, 1000);
    } catch (error: any) {
      console.error('Error syncing Apollo:', error);
      setSyncStatus('error');
      toast.error(error.message || 'Failed to sync Apollo data');
    } finally {
      setIsSyncing(false);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-screen">Loading Auth...</div>;
  }

  if (!userProfile) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please create a user profile to view this page. <Button variant="link" onClick={() => navigate('/profile')}>Go to Profile</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (queryError) {
    console.error("React Query Error:", queryError.message);
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading dashboard data. Please try again. <Button variant="link" onClick={() => refetch()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state for new users - check TAM data when in database mode
  const effectiveAccountCount = sourceFilter === 'database' 
    ? (tamData?.totalAccounts || 0) 
    : totalAccounts;
  const showEmptyState = effectiveAccountCount === 0 && !isLoading;

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 space-y-3 lg:space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between flex-wrap gap-3 lg:gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Executive Dashboard</h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Filter data by source to focus on your CRM, database, or combined view</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SourceFilterToggle
              value={sourceFilter}
              onChange={setSourceFilter}
              stats={{
                crm: filterStats?.crm || 0,
                database: filterStats?.database || 0,
              }}
            />
            {sourceFilter === 'database' && (
              <Button 
                variant="default" 
                onClick={handleSyncApollo}
                disabled={isSyncing}
                size="sm"
                className="bg-primary"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Apollo Data'}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                refetch();
                toast.success('Refreshing dashboard data...');
              }}
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                try {
                  console.log('🚀 Manual scoring trigger clicked');
                  console.log('Org ID:', userProfile.org_id);
                  
                  const { data, error } = await supabase.functions.invoke('bulk-score-accounts', {
                    body: { 
                      org_id: userProfile.org_id, 
                      chunk_size: 5000 
                    }
                  });
                  
                  if (error) {
                    console.error('❌ Scoring error:', error);
                    console.error('Full error:', JSON.stringify(error, null, 2));
                    toast.error(error.message || 'Failed to start scoring');
                  } else {
                    console.log('✅ Scoring job started:', data);
                    toast.success('Scoring started! Processing in background...');
                    checkDataFreshness(); // Refresh to show active job
                  }
                } catch (err) {
                  console.error('❌ Exception during scoring:', err);
                  toast.error('Failed to start scoring');
                }
              }}
              disabled={!!activeScoringJob}
            >
              <Target className="mr-2 h-4 w-4" />
              {activeScoringJob ? 'Scoring...' : 'Start Scoring'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEnrichmentModalOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich
            </Button>
            <Button 
              variant={showHealthDashboard ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowHealthDashboard(!showHealthDashboard)}
            >
              <Activity className="mr-2 h-4 w-4" />
              {showHealthDashboard ? 'Hide' : 'Show'} Health
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <QuickCampaignButton 
              highFitAccounts={highFitAccounts}
              disabled={isLoading || highFitAccounts === 0}
            />
          </div>
        </div>

        {/* Stale Data Warning */}
        {isDataStale && !activeScoringJob && (
          <Alert className="bg-amber-500/10 border-amber-500/50">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>Your ICP was recently updated. Re-score accounts to see updated fit scores.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/icp-manager')}
                className="ml-4"
              >
                Go to ICP Manager
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Data Quality Warning */}
        <DataQualityWarning 
          dataCompleteness={dataCompleteness}
          totalAccounts={totalAccounts}
          onEnrich={() => setIsEnrichmentModalOpen(true)}
        />

        {/* Phase 5: System Health Dashboard */}
        {showHealthDashboard && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health Monitor
              </CardTitle>
              <CardDescription>
                Real-time monitoring of CRM sync, enrichment, scoring, and automations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemHealthDashboard />
            </CardContent>
          </Card>
        )}

        {/* Active Scoring Job Progress */}
        {activeScoringJob && (
          <Alert className="bg-primary/10 border-primary/50">
            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Re-scoring in progress...</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {activeScoringJob.processed_accounts || 0} of {activeScoringJob.total_accounts || 0} accounts processed
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  {activeScoringJob.total_accounts > 0 
                    ? Math.round((activeScoringJob.processed_accounts / activeScoringJob.total_accounts) * 100)
                    : 0}%
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <DashboardSkeleton />
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <EmptyState
              icon={Database}
              title="Welcome to LaunchPulse!"
              description="Get started by generating sample data to explore the platform, uploading your account data, or connecting your CRM."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
              <Card className="border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer" onClick={async () => {
                try {
                  toast.info('Generating sample data...');
                  const { data, error } = await supabase.rpc('generate_sample_data');
                  if (error) throw error;
                  toast.success('Sample data generated! Refreshing...');
                  setTimeout(() => window.location.reload(), 1500);
                } catch (err: any) {
                  toast.error(err.message || 'Failed to generate sample data');
                }
              }}>
                <CardContent className="pt-6 text-center">
                  <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Generate Sample Data</h3>
                  <p className="text-sm text-muted-foreground">Quick demo with realistic accounts</p>
                </CardContent>
              </Card>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/data-upload')}>
                <CardContent className="pt-6 text-center">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Upload CSV Data</h3>
                  <p className="text-sm text-muted-foreground">Import your own account data</p>
                </CardContent>
              </Card>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/settings?tab=integrations')}>
                <CardContent className="pt-6 text-center">
                  <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Connect CRM</h3>
                  <p className="text-sm text-muted-foreground">Sync from Salesforce or HubSpot</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            {/* Your Database Metrics */}
            <div>
              <h2 className="text-lg lg:text-xl font-semibold mb-3 flex items-center gap-2">
                {sourceFilter === 'database' ? <Database className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                {sourceFilter === 'database' ? 'Available Market' : 'Your Pipeline'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
                <HeroMetric
                  label="Total Accounts"
                  value={sourceFilter === 'database' ? (tamData?.totalAccounts || 0) : totalAccounts}
                  subtitle={sourceFilter === 'database' ? `Available via ${tamData?.provider || 'Database'}` : 'In your CRM'}
                  trend={sourceFilter === 'crm' && trendData?.totalAccountsGrowth ? { value: trendData.totalAccountsGrowth, period: "last week" } : undefined}
                  icon={Building2}
                  tooltip={{
                    title: "Total Accounts",
                    description: "The total number of accounts in your system. CRM view shows accounts from your sales system, Database view shows your full addressable market.",
                    example: "Filter by data source to see different views"
                  }}
                />
                {sourceFilter === 'database' ? (
                  <HeroMetric
                    label="Total Contacts"
                    value={tamData?.totalLeads || 0}
                    subtitle="Available in market database"
                    icon={Users}
                    tooltip={{
                      title: "Available Contacts",
                      description: "Total contacts available in your TAM database. Redeem contacts to import them into your CRM for campaigns.",
                      example: "Use Campaign Builder to redeem contacts"
                    }}
                  />
                ) : (
                  <HeroMetric
                    label="Campaign Ready"
                    value={campaignReadyLeads}
                    subtitle={`Across ${campaignReadyAccounts.toLocaleString()} accounts`}
                    trend={trendData ? { value: trendData.campaignReady, period: "last week" } : undefined}
                    icon={Users}
                    status={campaignReadyLeads > 0 ? 'success' : 'warning'}
                    onClick={() => navigate('/leads?campaign_ready=true')}
                    tooltip={{
                      title: "Campaign Ready Contacts",
                      description: "Leads that have email, job title, and persona identified. These contacts can be immediately used in campaigns without additional enrichment cost.",
                      example: "Click to view all campaign-ready contacts"
                    }}
                  />
                )}
              </div>
            </div>

            {/* Fit Distribution Hero Section - Only for CRM mode where scores exist */}
            {sourceFilter === 'crm' && totalScores > 0 && (
              <FitDistributionHero
                highFitAccounts={highFitAccounts}
                mediumFitAccounts={medFitAccounts}
                lowFitAccounts={lowFitAccounts}
                totalScored={totalScores}
                highFitTrend={weeklyTrendData?.highFitAccounts}
                mediumFitTrend={weeklyTrendData?.mediumFitAccounts}
                lowFitTrend={weeklyTrendData?.lowFitAccounts}
                highFitPercentageTrend={weeklyTrendData?.highFitPercentage}
                mediumFitPercentageTrend={weeklyTrendData?.mediumFitPercentage}
                lowFitPercentageTrend={weeklyTrendData?.lowFitPercentage}
              />
            )}

            {/* Market Intelligence Card - Only for Database mode */}
            {sourceFilter === 'database' && tamData && (
              <MarketIntelligenceCard
                totalAccounts={tamData.totalAccounts}
                totalContacts={tamData.totalLeads}
                provider={tamData.provider}
                industryBreakdown={tamData.industry_breakdown}
                companySizeBreakdown={tamData.company_size_breakdown}
                revenueBreakdown={tamData.revenue_breakdown}
                geographyBreakdown={tamData.geography_breakdown}
              />
            )}

            {/* Available Market Card - NOT shown for database filter (redundant with TAM calculator) */}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">

              {/* ICP Coverage Card - Only for CRM mode */}
              {sourceFilter === 'crm' && (
                <ICPCoverageCard
                  totalAccounts={totalAccounts}
                  crmAccounts={crmAccounts}
                  databaseAccounts={databaseAccounts}
                  highFitAccounts={highFitAccounts}
                  highFitCrmAccounts={dashboardData.metrics.high_fit_crm_accounts}
                  highFitDatabaseAccounts={dashboardData.metrics.high_fit_database_accounts}
                  mediumFitAccounts={medFitAccounts}
                  mediumFitCrmAccounts={dashboardData.metrics.medium_fit_crm_accounts}
                  mediumFitDatabaseAccounts={dashboardData.metrics.medium_fit_database_accounts}
                  lowFitAccounts={lowFitAccounts}
                  lowFitCrmAccounts={dashboardData.metrics.low_fit_crm_accounts}
                  lowFitDatabaseAccounts={dashboardData.metrics.low_fit_database_accounts}
                  totalLeads={totalLeads}
                  crmLeads={crmLeads}
                  databaseLeads={databaseLeads}
                  highFitLeads={highFitLeads}
                  highFitCrmLeads={highFitCrmLeads}
                  highFitDatabaseLeads={highFitDatabaseLeads}
                  mediumFitCrmLeads={dashboardData.metrics.medium_fit_crm_leads}
                  mediumFitDatabaseLeads={dashboardData.metrics.medium_fit_database_leads}
                  lowFitCrmLeads={dashboardData.metrics.low_fit_crm_leads}
                  lowFitDatabaseLeads={dashboardData.metrics.low_fit_database_leads}
                  tamAccounts={tamData?.totalAccounts}
                  tamLeads={tamData?.totalLeads}
                  tamProvider={tamData?.provider}
                />
              )}

              {/* Combined Scoring ICP Card - Only for CRM mode */}
              {sourceFilter === 'crm' && (
                <CombinedScoringICPCard
                  scoringProgress={totalAccounts > 0 ? Math.round((totalScores / totalAccounts) * 100) : 0}
                  totalScored={totalScores}
                  totalAccounts={totalAccounts}
                  crmScored={crmScoredAccounts}
                  databaseScored={databaseScoredAccounts}
                  fitDistribution={[
                    { name: 'High Fit', value: highFitAccounts, percentage: totalScores > 0 ? Math.round((highFitAccounts / totalScores) * 100) : 0, color: 'hsl(var(--executive-green))' },
                    { name: 'Medium Fit', value: medFitAccounts, percentage: totalScores > 0 ? Math.round((medFitAccounts / totalScores) * 100) : 0, color: 'hsl(var(--executive-amber))' },
                    { name: 'Low Fit', value: lowFitAccounts, percentage: totalScores > 0 ? Math.round((lowFitAccounts / totalScores) * 100) : 0, color: 'hsl(var(--executive-red))' }
                  ]}
                  completeness={dataCompleteness}
                  industryCompleteness={75}
                  sizeCompleteness={65}
                  revenueCompleteness={55}
                  geoCompleteness={80}
                  scoringTrend={trendData?.scoringProgress}
                  completenessTrend={trendData?.completeness}
                  fitTrends={weeklyTrendData ? {
                    highFitAccounts: weeklyTrendData.highFitAccounts,
                    mediumFitAccounts: weeklyTrendData.mediumFitAccounts,
                    lowFitAccounts: weeklyTrendData.lowFitAccounts,
                    highFitPercentage: weeklyTrendData.highFitPercentage,
                    mediumFitPercentage: weeklyTrendData.mediumFitPercentage,
                    lowFitPercentage: weeklyTrendData.lowFitPercentage,
                  } : undefined}
                />
              )}

              {/* TAM/SAM/SOM Calculator */}
              {sourceFilter === 'database' && tamData ? (
                (() => {
                  const { sam, som } = calculateExternalTAMMetrics(
                    tamData,
                    icpProfiles[0] || null,
                    0.15,
                    12
                  );
                  return (
                    <TAMSAMSOMCalculator
                      totalAccounts={tamData.totalAccounts}
                      highFitAccounts={sam}
                      campaignReadyAccounts={som}
                      averageDealSize={75000}
                      conversionRate={0.15}
                      externalTAMAccounts={tamData.totalAccounts}
                      isExternalView={true}
                    />
                  );
                })()
              ) : (
              <TAMSAMSOMCalculator
                  totalAccounts={totalAccounts}
                  highFitAccounts={highFitAccounts}
                  campaignReadyAccounts={campaignReadyAccounts}
                  averageDealSize={75000}
                  conversionRate={0.15}
                  externalTAMAccounts={sourceFilter === 'crm' ? undefined : tamData?.totalAccounts}
                  isExternalView={false}
                />
              )}

              {/* Geography Distribution - Shown for all filters */}
              {sourceFilter === 'database' && tamData?.geography_breakdown ? (
                <EnhancedGeographyCard 
                  geoData={Object.entries(tamData.geography_breakdown).map(([country, data]) => ({
                    country,
                    count: typeof data === 'object' && data !== null ? (data as any).accounts || 0 : Number(data) || 0
                  })).sort((a, b) => b.count - a.count)}
                  invalidCount={0}
                  title="TAM Geographic Distribution"
                  sourceFilter={sourceFilter}
                />
              ) : geographyData && geographyData.length > 0 && (
                <EnhancedGeographyCard 
                  geoData={geographyDistribution} 
                  invalidCount={0}
                  title="Your Geographic Distribution"
                  sourceFilter={sourceFilter}
                />
              )}
            </div>

            {/* Bottom Cards */}
            <div className="grid grid-cols-1 gap-6">
              {/* Unified Insights Panel - merges Risks and AI Recommendations */}
              <UnifiedInsightsPanel
                risks={risks}
                insights={insights || []}
                onRefresh={handleRefreshInsights}
                campaignReadyCount={campaignReadyAccounts}
                completenessScore={dataCompleteness}
                totalScored={totalScores}
              />
            </div>
          </>
        )}

        {/* Enrichment Modal */}
        <EnrichmentModal open={isEnrichmentModalOpen} onOpenChange={setIsEnrichmentModalOpen} />
        
        {/* Sync Progress Modal */}
        <SyncProgressModal
          open={syncProgressOpen}
          onOpenChange={setSyncProgressOpen}
          provider="Apollo"
          status={syncStatus}
          breakdown={syncBreakdown}
        />
        
      </div>
  );
}

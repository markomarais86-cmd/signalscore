import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Building2, Settings, AlertCircle, Users, RefreshCw, Activity, Search } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData, useGeographyData, useSourceFilterStats } from "@/hooks/use-dashboard-data";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useDataChangeListener } from "@/hooks/use-data-change-listener";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { useICPInsights } from "@/hooks/use-icp-insights";
import { calculateTrends, TrendData } from "@/utils/trend-calculator";
import { detectRisks, RiskItem } from "@/utils/risk-detector";
import { UnifiedInsightsPanel, Insight } from "@/components/executive/UnifiedInsightsPanel";
import { SyncProgressModal } from "@/components/settings/SyncProgressModal";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";
import { EmptyState } from "@/components/EmptyState";
import { QuickCampaignButton } from "@/components/executive/QuickCampaignButton";
import { SystemHealthDashboard } from "@/components/settings/SystemHealthDashboard";
import { AgentRunDetailSheet } from "@/components/insights/AgentRunDetailSheet";

// Simplified components
import { SimplifiedHeroMetrics } from "@/components/executive/SimplifiedHeroMetrics";
import { ICPDonutChart } from "@/components/executive/ICPDonutChart";
import { ICPCoveragePanel } from "@/components/executive/ICPCoveragePanel";
import { SimpleICPTable } from "@/components/executive/SimpleICPTable";
import { SimpleTAMCard } from "@/components/executive/SimpleTAMCard";
import { SimpleGeographyCard } from "@/components/executive/SimpleGeographyCard";

import { CommandPalette, CommandPaletteTrigger } from "@/components/executive/CommandPalette";
import { StatusBar, useStatusItems } from "@/components/executive/StatusBar";
import { dashboardLogger } from "@/lib/logger";

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
  const [apolloStale, setApolloStale] = useState(false);
  const [syncingApolloFromAlert, setSyncingApolloFromAlert] = useState(false);
  const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | null>(null);
  

  const totalAccounts = dashboardData?.metrics?.total_accounts || 0;
  const totalScores = dashboardData?.metrics?.scored_accounts || 0;
  const campaignReadyAccounts = dashboardData?.metrics?.campaign_ready_accounts || 0;
  const campaignReadyLeads = dashboardData?.metrics?.campaign_ready_leads || 0;
  const dataCompleteness = Math.round(dashboardData?.metrics?.data_completeness || 0);

  const highFitAccounts = dashboardData?.metrics?.high_fit_accounts || 0;
  const medFitAccounts = dashboardData?.metrics?.medium_fit_accounts || 0;
  const lowFitAccounts = dashboardData?.metrics?.low_fit_accounts || 0;

  const crmAccounts = dashboardData?.metrics?.total_crm_accounts || 0;
  const databaseAccounts = dashboardData?.metrics?.total_database_accounts || 0;
  const bothAccounts = dashboardData?.metrics?.both_accounts || 0;
  const crmScoredAccounts = dashboardData?.metrics?.scored_crm_accounts || 0;
  const databaseScoredAccounts = dashboardData?.metrics?.scored_database_accounts || 0;

  const highFitCrmAccounts = dashboardData?.metrics?.high_fit_crm_accounts || 0;
  const highFitDatabaseAccounts = dashboardData?.metrics?.high_fit_database_accounts || 0;
  const medFitCrmAccounts = dashboardData?.metrics?.medium_fit_crm_accounts || 0;
  const medFitDatabaseAccounts = dashboardData?.metrics?.medium_fit_database_accounts || 0;
  const lowFitCrmAccounts = dashboardData?.metrics?.low_fit_crm_accounts || 0;
  const lowFitDatabaseAccounts = dashboardData?.metrics?.low_fit_database_accounts || 0;

  const totalLeads = dashboardData?.metrics?.total_leads || 0;
  const crmLeads = dashboardData?.metrics?.total_crm_leads || 0;
  const databaseLeads = dashboardData?.metrics?.total_database_leads || 0;
  const highFitLeads = dashboardData?.metrics?.high_fit_leads || 0;
  const medFitLeads = dashboardData?.metrics?.medium_fit_leads || 0;
  const lowFitLeads = dashboardData?.metrics?.low_fit_leads || 0;
  const highFitCrmLeads = dashboardData?.metrics?.high_fit_crm_leads || 0;
  const highFitDatabaseLeads = dashboardData?.metrics?.high_fit_database_leads || 0;
  const medFitCrmLeads = dashboardData?.metrics?.medium_fit_crm_leads || 0;
  const medFitDatabaseLeads = dashboardData?.metrics?.medium_fit_database_leads || 0;
  const lowFitCrmLeads = dashboardData?.metrics?.low_fit_crm_leads || 0;
  const lowFitDatabaseLeads = dashboardData?.metrics?.low_fit_database_leads || 0;


  const icpProfiles = dashboardData?.icpProfiles || [];
  const tamData = dashboardData?.tamData;

  const geographyDistribution = geographyData || [];

  const hasData = totalAccounts > 0;

  // Listen for significant data changes and auto-refresh
  useDataChangeListener({
    onAccountsChanged: async () => {
      dashboardLogger.debug('Accounts changed, refreshing dashboard...');
      await refetch();
      toast.info('Dashboard updated with new account data');
    },
    onScoringCompleted: async () => {
      dashboardLogger.debug('Scoring completed, refreshing insights...');
      await Promise.all([refetch(), generateInsights()]);
      setLastRefreshed(new Date());
      toast.success('Scoring complete! Dashboard and recommendations updated');
    },
    onEnrichmentCompleted: async () => {
      dashboardLogger.debug('Enrichment completed, refreshing dashboard...');
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
        .catch((e) => dashboardLogger.error('Failed to calculate trends:', e));
      
      // Calculate 7-day (weekly) trends for fit levels
      calculateTrends(userProfile?.org_id || '', dashboardData?.metrics, '7d')
        .then(setWeeklyTrendData)
        .catch((e) => dashboardLogger.error('Failed to calculate weekly trends:', e));

      // Detect risks asynchronously
      detectRisks(userProfile?.org_id || '', dashboardData?.metrics)
        .then(setRisks)
        .catch((e) => dashboardLogger.error('Failed to detect risks:', e));
      
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

      // Check if Apollo data is stale compared to ICP
      const { data: primaryICP } = await supabase
        .from('icp_profiles')
        .select('created_at')
        .eq('org_id', userProfile.org_id)
        .eq('is_primary', true)
        .maybeSingle();

      const { data: apolloData } = await supabase
        .from('external_data_sources')
        .select('last_synced_at')
        .eq('org_id', userProfile.org_id)
        .eq('provider', 'apollo')
        .maybeSingle();

      if (primaryICP?.created_at && apolloData?.last_synced_at) {
        const icpTime = new Date(primaryICP.created_at).getTime();
        const apolloTime = new Date(apolloData.last_synced_at).getTime();
        setApolloStale(icpTime > apolloTime);
      } else if (primaryICP?.created_at && !apolloData?.last_synced_at) {
        // ICP exists but Apollo never synced
        setApolloStale(true);
      } else {
        setApolloStale(false);
      }
    } catch (error) {
      dashboardLogger.error('Error checking data freshness:', error);
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
      dashboardLogger.error("Error refreshing insights:", error);
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
      dashboardLogger.error('Error syncing Apollo:', error);
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
    dashboardLogger.error("React Query Error:", queryError.message);
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

  // Build status items for StatusBar
  const statusItems = useStatusItems({
    activeScoringJob,
    apolloStale,
    isDataStale,
    dataCompleteness,
    totalAccounts,
    sourceFilter,
    onSyncApollo: async () => {
      setSyncingApolloFromAlert(true);
      await handleSyncApollo();
      setSyncingApolloFromAlert(false);
      setApolloStale(false);
    },
    onGoToICP: () => navigate('/icp-manager'),
    onEnrich: () => setIsEnrichmentModalOpen(true),
    syncingApollo: syncingApolloFromAlert
  });

  // Score accounts handler for command palette
  const handleScoreAccounts = async () => {
    try {
      dashboardLogger.debug('Manual scoring trigger clicked');
      const { data, error } = await supabase.functions.invoke('bulk-score-accounts', {
        body: { org_id: userProfile.org_id, chunk_size: 5000 }
      });
      if (error) {
        toast.error(error.message || 'Failed to start scoring');
      } else {
        toast.success('Scoring started! Processing in background...');
        checkDataFreshness();
      }
    } catch (err) {
      toast.error('Failed to start scoring');
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 space-y-6 lg:space-y-8 hero-gradient bg-grid-pattern min-h-screen pb-8">
      {/* Command Palette - Global keyboard shortcut */}
      <CommandPalette
        onScoreAccounts={handleScoreAccounts}
        onEnrich={() => setIsEnrichmentModalOpen(true)}
        onSyncApollo={handleSyncApollo}
        onRefresh={() => {
          refetch();
          toast.success('Refreshing dashboard data...');
        }}
        onToggleHealth={() => setShowHealthDashboard(!showHealthDashboard)}
        isScoring={!!activeScoringJob}
        isSyncing={isSyncing}
      />

      {/* Header Section - Simplified */}
      <div className="flex items-center justify-between flex-wrap gap-3 lg:gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold leading-tight">Executive Dashboard</h1>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1">Filter data by source to focus on your CRM, database, or combined view</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Command Palette Trigger - for users who don't know keyboard shortcut */}
          <CommandPaletteTrigger />
          
          <SourceFilterToggle
            value={sourceFilter}
            onChange={setSourceFilter}
            stats={{
              crm: filterStats?.crm || 0,
              database: filterStats?.database || 0,
            }}
          />
          
          {/* Primary Actions - Grouped */}
          <div className="flex items-center gap-1.5">
            {sourceFilter === 'database' && (
              <Button 
                variant="default" 
                onClick={handleSyncApollo}
                disabled={isSyncing}
                size="sm"
                className="bg-primary hover:shadow-md transition-shadow"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Apollo'}
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
              className="hover:shadow-sm transition-shadow"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {/* Secondary Actions */}
          <div className="flex items-center gap-1.5">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleScoreAccounts}
              disabled={!!activeScoringJob}
              className="hover:shadow-sm transition-shadow active:scale-[0.98]"
            >
              <Target className="mr-2 h-4 w-4" />
              {activeScoringJob ? 'Scoring...' : 'Score'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEnrichmentModalOpen(true)}
              className="hover:shadow-sm transition-shadow active:scale-[0.98]"
            >
              <LaunchPulseMark className="mr-2 h-4 w-4" />
              Enrich
            </Button>
            <Button 
              variant={showHealthDashboard ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowHealthDashboard(!showHealthDashboard)}
              className="hover:shadow-sm transition-shadow active:scale-[0.98]"
            >
              <Activity className="mr-2 h-4 w-4" />
              Health
            </Button>
          </div>
          
          <QuickCampaignButton 
            highFitAccounts={highFitAccounts}
            disabled={isLoading || highFitAccounts === 0}
          />
        </div>
      </div>

      {/* Consolidated Status Bar - Replaces scattered alerts */}
      <StatusBar items={statusItems} />


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
              <SystemHealthDashboard onViewAgentRun={(runId) => setSelectedAgentRunId(runId)} />
            </CardContent>
          </Card>
        )}

        {/* Agent Run Detail Sheet */}
        <AgentRunDetailSheet
          runId={selectedAgentRunId}
          open={!!selectedAgentRunId}
          onOpenChange={(open) => !open && setSelectedAgentRunId(null)}
        />

        {/* Note: Active scoring job is now shown in StatusBar above */}

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
              <Card 
                className="border-primary/50 bg-primary/5 hover:bg-primary/10 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer" 
                onClick={async () => {
                  try {
                    toast.info('Generating sample data...');
                    const { data, error } = await supabase.rpc('generate_sample_data');
                    if (error) throw error;
                    toast.success('Sample data generated! Refreshing...');
                    setTimeout(() => window.location.reload(), 1500);
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to generate sample data');
                  }
                }}
              >
                <CardContent className="pt-6 text-center">
                  <LaunchPulseMark className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Generate Sample Data</h3>
                  <p className="text-sm text-muted-foreground">Quick demo with realistic accounts</p>
                </CardContent>
              </Card>
              <Card 
                className="hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer" 
                onClick={() => navigate('/data-upload')}
              >
                <CardContent className="pt-6 text-center">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Upload CSV Data</h3>
                  <p className="text-sm text-muted-foreground">Import your own account data</p>
                </CardContent>
              </Card>
              <Card 
                className="hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer" 
                onClick={() => navigate('/settings?tab=integrations')}
              >
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
            {/* Simplified Hero Metrics - Floating Cards */}
            <SimplifiedHeroMetrics
              totalAccounts={sourceFilter === 'database' ? (tamData?.totalAccounts || 0) : totalAccounts}
              totalLeads={sourceFilter === 'database' ? (tamData?.totalLeads || 0) : totalLeads}
              campaignReady={campaignReadyLeads}
              sourceFilter={sourceFilter}
              tamProvider={tamData?.provider}
            />

            {/* Central ICP Coverage Panel - Source-filtered */}
            <ICPCoveragePanel
              highFitAccounts={sourceFilter === 'database' ? highFitDatabaseAccounts : sourceFilter === 'crm' ? highFitCrmAccounts : highFitAccounts}
              medFitAccounts={sourceFilter === 'database' ? medFitDatabaseAccounts : sourceFilter === 'crm' ? medFitCrmAccounts : medFitAccounts}
              lowFitAccounts={sourceFilter === 'database' ? lowFitDatabaseAccounts : sourceFilter === 'crm' ? lowFitCrmAccounts : lowFitAccounts}
              totalScored={sourceFilter === 'database' ? databaseScoredAccounts : sourceFilter === 'crm' ? crmScoredAccounts : totalScores}
              highFitLeads={sourceFilter === 'database' ? highFitDatabaseLeads : sourceFilter === 'crm' ? highFitCrmLeads : highFitLeads}
              medFitLeads={sourceFilter === 'database' ? medFitDatabaseLeads : sourceFilter === 'crm' ? medFitCrmLeads : medFitLeads}
              lowFitLeads={sourceFilter === 'database' ? lowFitDatabaseLeads : sourceFilter === 'crm' ? lowFitCrmLeads : lowFitLeads}
              totalLeads={sourceFilter === 'database' ? databaseLeads : sourceFilter === 'crm' ? crmLeads : totalLeads}
            />

            {/* Main Content Grid - 3 columns for visual balance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - ICP Coverage Table */}
              <SimpleICPTable
                crmAccounts={crmAccounts}
                databaseAccounts={databaseAccounts}
                highFitCrmAccounts={highFitCrmAccounts}
                highFitDatabaseAccounts={highFitDatabaseAccounts}
                apolloAccounts={tamData?.totalAccounts}
                apolloHighFitEstimate={
                  tamData?.totalAccounts && tamData?.industry_breakdown
                    ? Math.round(tamData.totalAccounts * 0.35)
                    : undefined
                }
              />
              
              {/* Center Column - TAM/SAM/SOM Card */}
              <SimpleTAMCard
                totalAccounts={sourceFilter === 'database' ? (tamData?.totalAccounts || 0) : totalAccounts}
                highFitAccounts={highFitAccounts}
                campaignReadyAccounts={campaignReadyAccounts}
                averageDealSize={75000}
              />
              
              {/* Right Column - Geography Card */}
              <SimpleGeographyCard
                geoData={
                  sourceFilter === 'database' && tamData?.geography_breakdown
                    ? Object.entries(tamData.geography_breakdown as Record<string, { accounts?: number }>).map(([country, data]) => ({
                        country,
                        count: typeof data === 'object' ? (data.accounts || 0) : (typeof data === 'number' ? data : 0),
                      })).sort((a, b) => b.count - a.count)
                    : geographyDistribution.map(g => ({ country: g.country, count: g.count }))
                }
              />
            </div>

            {/* Bottom Row - Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ICP Donut Chart */}
              <ICPDonutChart
                highFitAccounts={highFitAccounts}
                medFitAccounts={medFitAccounts}
                lowFitAccounts={lowFitAccounts}
                totalScored={totalScores}
              />
              
              {/* CRM Insights Panel */}
              <UnifiedInsightsPanel
                risks={risks}
                insights={insights || []}
                orgId={userProfile?.org_id}
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, Target, Database, Download, MapPin, Sparkles, Building2, Settings, AlertCircle, Users, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData, useGeographyData } from "@/hooks/use-dashboard-data";
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
import { detectRisks } from "@/utils/risk-detector";
import type { RiskItem } from "@/utils/risk-detector";
import { CombinedScoringICPCard } from "@/components/executive/CombinedScoringICPCard";
import { GeographyChartCard } from "@/components/executive/GeographyChartCard";
import { EnhancedGeographyCard } from "@/components/executive/EnhancedGeographyCard";
import { AIRecommendationsTiles } from "@/components/executive/AIRecommendationsTiles";
import { RisksAndActionsCard } from "@/components/executive/RisksAndActionsCard";
import { ICPCoverageCard } from "@/components/executive/ICPCoverageCard";
import { EnhancedRisksCard } from "@/components/executive/EnhancedRisksCard";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { TAMSAMSOMCalculator } from "@/components/executive/TAMSAMSOMCalculator";
import { AvailableMarketCard } from "@/components/executive/AvailableMarketCard";

export default function ExecutiveDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const sidebar = useSidebar();
  const { insights, statistics, loading: insightsLoading, generateInsights } = useICPInsights();
  
  // Use optimized React Query hooks - 22 queries reduced to 2!
  const { data: dashboardData, isLoading, error: queryError, refetch } = useDashboardData(userProfile?.org_id);
  const { data: geographyData } = useGeographyData(userProfile?.org_id, !!dashboardData);

  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [weeklyTrendData, setWeeklyTrendData] = useState<TrendData | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const totalAccounts = dashboardData?.metrics?.total_accounts || 0;
  const totalScores = dashboardData?.metrics?.total_scores || 0;
  const totalLeads = dashboardData?.metrics?.total_leads || 0;
  const campaignReadyAccounts = dashboardData?.metrics?.campaign_ready_accounts || 0;
  const campaignReadyContacts = dashboardData?.metrics?.campaign_ready_contacts || 0;
  const dataCompleteness = dashboardData?.metrics?.data_completeness || 0;

  const highFitAccounts = dashboardData?.metrics?.high_fit_scores || 0;
  const medFitAccounts = dashboardData?.metrics?.med_fit_scores || 0;
  const lowFitAccounts = dashboardData?.metrics?.low_fit_scores || 0;

  const crmAccounts = dashboardData?.metrics?.crm_accounts || 0;
  const databaseAccounts = dashboardData?.metrics?.database_accounts || 0;
  const bothAccounts = dashboardData?.metrics?.both_accounts || 0;

  const highFitCrmAccounts = dashboardData?.metrics?.high_fit_crm_accounts || 0;
  const highFitDatabaseAccounts = dashboardData?.metrics?.high_fit_database_accounts || 0;

  const crmLeads = dashboardData?.metrics?.crm_leads || 0;
  const databaseLeads = dashboardData?.metrics?.database_leads || 0;
  const highFitLeadsTotal = dashboardData?.metrics?.high_fit_leads_total || 0;
  const highFitCrmLeads = dashboardData?.metrics?.high_fit_crm_leads || 0;
  const highFitDatabaseLeads = dashboardData?.metrics?.high_fit_database_leads || 0;
  const campaignReadyLeads = dashboardData?.metrics?.campaign_ready_leads || 0;

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
    }
  }, [dashboardData?.metrics, userProfile?.org_id, totalScores]); // Fix: use dashboardData.metrics instead of dashboardData

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
            <p className="text-muted-foreground">Insights into your ideal customer profile and overall data health.</p>
          </div>
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                refetch();
                toast.success('Refreshing dashboard data...');
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button variant="outline" onClick={() => setIsEnrichmentModalOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich Data
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Your Database Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Database className="h-5 w-5" />
                Your Database
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <HeroMetric
                  label="Total Accounts"
                  value={totalAccounts}
                  subtitle="In your database"
                  trend={trendData ? { value: trendData.scoringProgress, period: "last week" } : undefined}
                  icon={Building2}
                />
                <HeroMetric
                  label="Total Leads"
                  value={totalLeads}
                  subtitle="Contacts tracked"
                  trend={trendData ? { value: trendData.completeness, period: "last week" } : undefined}
                  icon={Users}
                />
                <HeroMetric
                  label="High Fit Accounts"
                  value={highFitAccounts}
                  subtitle={`${totalScores > 0 ? Math.round((highFitAccounts / totalScores) * 100) : 0}% of scored accounts`}
                  icon={Target}
                  status={highFitAccounts > 0 ? 'success' : 'warning'}
                />
                <HeroMetric
                  label="Campaign Ready"
                  value={campaignReadyContacts}
                  subtitle={`${campaignReadyAccounts} accounts with contacts`}
                  trend={trendData ? { value: trendData.campaignReady, period: "last week" } : undefined}
                  icon={Sparkles}
                  status={campaignReadyContacts > 0 ? 'success' : 'warning'}
                />
              </div>
            </div>

            {/* Available Market TAM Reference */}
            {tamData && tamData.totalAccounts > 0 && (
              <AvailableMarketCard
                totalAccounts={tamData.totalAccounts}
                totalContacts={tamData.totalLeads || 0}
                provider={tamData.provider || 'External Data'}
                lastSyncedAt={tamData.lastSyncedAt}
              />
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ICP Coverage Card */}
              <ICPCoverageCard
                totalAccounts={totalAccounts}
                crmAccounts={crmAccounts}
                databaseAccounts={databaseAccounts}
                highFitAccounts={highFitAccounts}
                highFitCrmAccounts={highFitCrmAccounts}
                highFitDatabaseAccounts={highFitDatabaseAccounts}
                totalLeads={totalLeads}
                crmLeads={crmLeads}
                databaseLeads={databaseLeads}
                highFitLeads={highFitLeadsTotal}
                highFitCrmLeads={highFitCrmLeads}
                highFitDatabaseLeads={highFitDatabaseLeads}
                tamAccounts={tamData?.totalAccounts}
                tamLeads={tamData?.totalLeads}
                tamProvider={tamData?.provider}
              />

              {/* Combined Scoring ICP Card */}
              <CombinedScoringICPCard
                scoringProgress={totalAccounts > 0 ? Math.round((totalScores / totalAccounts) * 100) : 0}
                totalScored={totalScores}
                totalAccounts={totalAccounts}
                crmScored={Math.floor((totalScores / (totalAccounts || 1)) * crmAccounts)}
                databaseScored={Math.floor((totalScores / (totalAccounts || 1)) * databaseAccounts)}
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

              {/* TAM/SAM/SOM Calculator */}
              <TAMSAMSOMCalculator
                totalAccounts={totalAccounts}
                highFitAccounts={highFitAccounts}
                campaignReadyAccounts={campaignReadyAccounts}
                averageDealSize={75000}
                conversionRate={0.15}
                externalTAMAccounts={tamData?.totalAccounts}
              />

              {/* Enhanced Geography Card */}
              <EnhancedGeographyCard geoData={geographyDistribution} invalidCount={0} />
            </div>

            {/* Bottom Cards */}
            <div className="grid grid-cols-1 gap-6">
              {/* Risks and Actions Card */}
              {risks.length > 0 && <EnhancedRisksCard risks={risks} />}

              {/* AI Recommendations Card */}
              {insights && insights.length > 0 && (
                <AIRecommendationsTiles 
                  insights={insights} 
                  onRefresh={handleRefreshInsights}
                />
              )}
            </div>
          </>
        )}

        {/* Enrichment Modal */}
        <EnrichmentModal open={isEnrichmentModalOpen} onOpenChange={setIsEnrichmentModalOpen} />
      </div>
    </div>
  );
}

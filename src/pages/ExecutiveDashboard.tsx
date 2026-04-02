import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useDataOrgId } from "@/hooks/use-data-org";
import { useOrgSwitcher } from "@/contexts/OrgSwitcherContext";
import { useDashboardData, useGeographyData, useSourceFilterStats } from "@/hooks/use-dashboard-data";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useDataChangeListener } from "@/hooks/use-data-change-listener";
import { useOrgSettings } from "@/hooks/use-org-settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { useICPInsights } from "@/hooks/use-icp-insights";
import { calculateTrends, TrendData } from "@/utils/trend-calculator";
import { detectRisks, RiskItem } from "@/utils/risk-detector";
import { SyncProgressModal } from "@/components/settings/SyncProgressModal";
import { EnrichmentModal } from "@/components/executive/EnrichmentModal";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { WelcomeEmptyState } from "@/components/onboarding/WelcomeEmptyState";
import { SystemHealthDashboard } from "@/components/settings/SystemHealthDashboard";
import { AgentRunDetailSheet } from "@/components/insights/AgentRunDetailSheet";
import { StatusBar, buildStatusItems } from "@/components/executive/StatusBar";
import { DashboardHeader } from "@/components/executive/DashboardHeader";
import { DashboardHeroBanner } from "@/components/executive/DashboardHeroBanner";
import { DashboardContent } from "@/components/executive/DashboardContent";
import { CampaignBuilderV2 } from "@/components/campaigns/CampaignBuilderV2";
import type { SourceFilter } from "@/components/executive/SourceFilterToggle";
import { dashboardLogger } from "@/lib/logger";

export default function ExecutiveDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { dataOrgId, isChildOrg } = useDataOrgId();
  const { selectedOrg } = useOrgSwitcher();
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const { insights, statistics, loading: insightsLoading, generateInsights } = useICPInsights();
  const { averageDealSize, conversionRate, updateSettings } = useOrgSettings();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("crm");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressOpen, setSyncProgressOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "complete" | "error">("syncing");
  const [syncBreakdown, setSyncBreakdown] = useState<any>(null);

  const { data: dashboardData, isLoading, error: queryError, refetch } = useDashboardData(effectiveOrgId, sourceFilter, dataOrgId ?? undefined);
  const { data: geographyData } = useGeographyData(effectiveOrgId, !!dashboardData, sourceFilter, dataOrgId ?? undefined);
  const { data: filterStats } = useSourceFilterStats(effectiveOrgId);

  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [isDataStale, setIsDataStale] = useState(false);
  const [activeScoringJob, setActiveScoringJob] = useState<any>(null);
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);
  const [apolloStale, setApolloStale] = useState(false);
  const [syncingApolloFromAlert, setSyncingApolloFromAlert] = useState(false);
  const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | null>(null);
  const [signalCampaignOpen, setSignalCampaignOpen] = useState(false);
  const [signalCampaignContext, setSignalCampaignContext] = useState<any>(undefined);

  // Derived metrics
  const m = dashboardData?.metrics;
  const totalAccounts = m?.total_accounts || 0;
  const totalScores = m?.scored_accounts || 0;
  const campaignReadyAccounts = m?.campaign_ready_accounts || 0;
  const campaignReadyLeads = m?.campaign_ready_leads || 0;
  const dataCompleteness = Math.round(m?.data_completeness || 0);
  const highFitAccounts = m?.high_fit_accounts || 0;
  const medFitAccounts = m?.medium_fit_accounts || 0;
  const lowFitAccounts = m?.low_fit_accounts || 0;
  const crmAccounts = m?.total_crm_accounts || 0;
  const databaseAccounts = m?.total_database_accounts || 0;
  const crmScoredAccounts = m?.scored_crm_accounts || 0;
  const databaseScoredAccounts = m?.scored_database_accounts || 0;
  const highFitCrmAccounts = m?.high_fit_crm_accounts || 0;
  const highFitDatabaseAccounts = m?.high_fit_database_accounts || 0;
  const medFitCrmAccounts = m?.medium_fit_crm_accounts || 0;
  const medFitDatabaseAccounts = m?.medium_fit_database_accounts || 0;
  const lowFitCrmAccounts = m?.low_fit_crm_accounts || 0;
  const lowFitDatabaseAccounts = m?.low_fit_database_accounts || 0;
  const totalLeads = m?.total_leads || 0;
  const crmLeads = m?.total_crm_leads || 0;
  const databaseLeads = m?.total_database_leads || 0;
  const highFitLeads = m?.high_fit_leads || 0;
  const medFitLeads = m?.medium_fit_leads || 0;
  const lowFitLeads = m?.low_fit_leads || 0;
  const highFitCrmLeads = m?.high_fit_crm_leads || 0;
  const highFitDatabaseLeads = m?.high_fit_database_leads || 0;
  const medFitCrmLeads = m?.medium_fit_crm_leads || 0;
  const medFitDatabaseLeads = m?.medium_fit_database_leads || 0;
  const lowFitCrmLeads = m?.low_fit_crm_leads || 0;
  const lowFitDatabaseLeads = m?.low_fit_database_leads || 0;
  const icpProfiles = dashboardData?.icpProfiles || [];
  const tamData = dashboardData?.tamData;
  const geographyDistribution = geographyData || [];
  const hasData = totalAccounts > 0;

  useDataChangeListener({
    onAccountsChanged: async () => {
      dashboardLogger.debug("Accounts changed, refreshing dashboard...");
      await refetch();
      toast.info("Dashboard updated with new account data");
      autoEnrichNewAccounts();
    },
    onScoringCompleted: async () => {
      dashboardLogger.debug("Scoring completed, refreshing insights...");
      await Promise.all([refetch(), generateInsights()]);
      toast.success("Scoring complete! Dashboard and recommendations updated");
    },
    onEnrichmentCompleted: async () => {
      dashboardLogger.debug("Enrichment completed, refreshing dashboard...");
      await refetch();
      toast.success("Enrichment complete! Dashboard updated");
    },
    debounceMs: 3000,
  });

  useEffect(() => {
    if (dashboardData) {
      calculateTrends(effectiveOrgId || "", m, "30d").then(setTrendData).catch((e) => dashboardLogger.error("Trend calc failed:", e));
      detectRisks(effectiveOrgId || "", m).then(setRisks).catch((e) => dashboardLogger.error("Risk detection failed:", e));
      if ((totalScores > 0 || totalAccounts > 0) && effectiveOrgId) generateInsights();
      checkDataFreshness();
    }
  }, [m, effectiveOrgId, totalScores, totalAccounts]);

  const checkDataFreshness = async () => {
    if (!effectiveOrgId) return;
    const sharedDataOrgId = dataOrgId || effectiveOrgId;
    try {
      const { data: activeJob } = await supabase.from("bulk_scoring_jobs").select("*").eq("org_id", effectiveOrgId!).eq("status", "processing").order("started_at", { ascending: false }).limit(1).maybeSingle();
      setActiveScoringJob(activeJob);

      const { data: latestICP } = await supabase.from("icp_profiles").select("created_at").eq("org_id", effectiveOrgId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: latestScore } = await supabase.from("scores").select("computed_at").eq("org_id", effectiveOrgId!).order("computed_at", { ascending: false }).limit(1).maybeSingle();
      if (latestICP && latestScore) setIsDataStale(new Date(latestICP.created_at) > new Date(latestScore.computed_at));

      const { data: primaryICP } = await supabase.from("icp_profiles").select("created_at").eq("org_id", effectiveOrgId!).eq("is_primary", true).maybeSingle();
      let apolloData: { last_synced_at: string | null } | null = null;
      const { data: childApollo } = await supabase.from("external_data_sources").select("last_synced_at").eq("org_id", effectiveOrgId!).eq("provider", "apollo").maybeSingle();
      if (childApollo) apolloData = childApollo;
      else if (sharedDataOrgId !== effectiveOrgId) {
        const { data: parentApollo } = await supabase.from("external_data_sources").select("last_synced_at").eq("org_id", sharedDataOrgId).eq("provider", "apollo").maybeSingle();
        apolloData = parentApollo;
      }
      if (primaryICP?.created_at && apolloData?.last_synced_at) setApolloStale(new Date(primaryICP.created_at).getTime() > new Date(apolloData.last_synced_at).getTime());
      else if (primaryICP?.created_at && !apolloData?.last_synced_at) setApolloStale(true);
      else setApolloStale(false);
    } catch (error) {
      dashboardLogger.error("Error checking data freshness:", error);
    }
  };

  useEffect(() => {
    if (!effectiveOrgId) return;
    checkDataFreshness();
    const interval = setInterval(checkDataFreshness, 30000);
    return () => clearInterval(interval);
  }, [effectiveOrgId]);

  useEffect(() => { if (effectiveOrgId) completeStep("viewed_dashboard"); }, [effectiveOrgId]);

  const handleRefreshInsights = async () => {
    if (!effectiveOrgId) { toast.error("No organization ID found"); return; }
    setRefreshingInsights(true);
    try { await generateInsights(); toast.success("Insights refreshed"); } catch (error: any) { toast.error(error.message || "Failed to refresh"); } finally { setRefreshingInsights(false); }
  };

  const handleSyncApollo = async () => {
    if (!effectiveOrgId) { toast.error("Organization not found"); return; }
    setIsSyncing(true); setSyncProgressOpen(true); setSyncStatus("syncing"); setSyncBreakdown(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-provider", { body: { org_id: effectiveOrgId, provider: "apollo" } });
      if (error) throw error;
      setSyncStatus("complete");
      setSyncBreakdown({ accounts: data?.totalAccounts || 0, leads: data?.totalContacts || 0, geography: tamData?.geography_breakdown, industry: tamData?.industry_breakdown });
      toast.success("Apollo sync completed!");
      autoEnrichNewAccounts();
      setTimeout(() => refetch(), 1000);
    } catch (error: any) {
      setSyncStatus("error"); toast.error(error.message || "Failed to sync Apollo data");
    } finally { setIsSyncing(false); }
  };

  const autoEnrichNewAccounts = async () => {
    if (!effectiveOrgId) return;
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: unenriched } = await supabase.from("accounts").select("external_id").eq("org_id", effectiveOrgId).is("enriched_at", null).gte("updated_at", fiveMinutesAgo).limit(50);
      if (unenriched && unenriched.length > 0) {
        toast.info(`Auto-enriching ${unenriched.length} new accounts...`);
        await supabase.functions.invoke("enrich-unified", { body: { record_type: "account", org_id: effectiveOrgId, record_ids: unenriched.map((a) => a.external_id) } });
      }
    } catch (err) { dashboardLogger.error("Auto-enrich failed:", err); }
  };

  const handleScoreAccounts = async () => {
    try {
      const { error } = await supabase.functions.invoke("bulk-score-accounts", { body: { org_id: effectiveOrgId, chunk_size: 5000 } });
      if (error) toast.error(error.message || "Failed to start scoring");
      else { toast.success("Scoring started!"); checkDataFreshness(); }
    } catch { toast.error("Failed to start scoring"); }
  };

  if (authLoading) return <div className="flex justify-center items-center h-screen">Loading Auth...</div>;

  if (!userProfile) return (
    <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>Please create a user profile. <Button variant="link" onClick={() => navigate("/profile")}>Go to Profile</Button></AlertDescription></Alert>
  );

  if (queryError) return (
    <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading dashboard. <Button variant="link" onClick={() => refetch()}>Retry</Button></AlertDescription></Alert>
  );

  const effectiveAccountCount = sourceFilter === "database" ? (tamData?.totalAccounts || 0) : totalAccounts;
  const showEmptyState = effectiveAccountCount === 0 && totalScores === 0 && !isLoading;

  const statusItems = buildStatusItems({
    activeScoringJob, apolloStale, isDataStale, dataCompleteness, totalAccounts, sourceFilter,
    onSyncApollo: async () => { setSyncingApolloFromAlert(true); await handleSyncApollo(); setSyncingApolloFromAlert(false); setApolloStale(false); },
    onGoToICP: () => navigate("/icp-manager"),
    onEnrich: () => setIsEnrichmentModalOpen(true),
    syncingApollo: syncingApolloFromAlert,
    isChildOrg,
    childOrgName: selectedOrg?.name,
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] space-y-4 px-4 pb-10 sm:px-5 lg:px-6">
      <DashboardHeader
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        filterStats={filterStats}
        isSyncing={isSyncing}
        isLoading={isLoading}
        activeScoringJob={activeScoringJob}
        showHealthDashboard={showHealthDashboard}
        highFitAccounts={highFitAccounts}
        effectiveOrgId={effectiveOrgId}
        onSyncApollo={handleSyncApollo}
        onRefresh={() => { refetch(); toast.success("Refreshing..."); }}
        onScore={handleScoreAccounts}
        onEnrich={() => setIsEnrichmentModalOpen(true)}
        onToggleHealth={() => setShowHealthDashboard(!showHealthDashboard)}
        onPowerUpComplete={() => refetch()}
      />

      <StatusBar items={statusItems} />

      {showHealthDashboard && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />System Health Monitor</CardTitle>
            <CardDescription>Real-time monitoring of CRM sync, enrichment, scoring, and automations</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemHealthDashboard onViewAgentRun={(runId) => setSelectedAgentRunId(runId)} />
          </CardContent>
        </Card>
      )}

      <AgentRunDetailSheet runId={selectedAgentRunId} open={!!selectedAgentRunId} onOpenChange={(open) => !open && setSelectedAgentRunId(null)} />

      {isLoading ? (
        <DashboardSkeleton />
      ) : showEmptyState ? (
        <WelcomeEmptyState />
      ) : (
        <DashboardContent
          sourceFilter={sourceFilter}
          totalAccounts={totalAccounts} totalScores={totalScores}
          highFitAccounts={highFitAccounts} medFitAccounts={medFitAccounts} lowFitAccounts={lowFitAccounts}
          dataCompleteness={dataCompleteness} campaignReadyAccounts={campaignReadyAccounts} campaignReadyLeads={campaignReadyLeads}
          averageDealSize={averageDealSize} conversionRate={conversionRate}
          crmAccounts={crmAccounts} databaseAccounts={databaseAccounts}
          crmScoredAccounts={crmScoredAccounts} databaseScoredAccounts={databaseScoredAccounts}
          highFitCrmAccounts={highFitCrmAccounts} highFitDatabaseAccounts={highFitDatabaseAccounts}
          medFitCrmAccounts={medFitCrmAccounts} medFitDatabaseAccounts={medFitDatabaseAccounts}
          lowFitCrmAccounts={lowFitCrmAccounts} lowFitDatabaseAccounts={lowFitDatabaseAccounts}
          totalLeads={totalLeads} crmLeads={crmLeads} databaseLeads={databaseLeads}
          highFitLeads={highFitLeads} medFitLeads={medFitLeads} lowFitLeads={lowFitLeads}
          highFitCrmLeads={highFitCrmLeads} highFitDatabaseLeads={highFitDatabaseLeads}
          medFitCrmLeads={medFitCrmLeads} medFitDatabaseLeads={medFitDatabaseLeads}
          lowFitCrmLeads={lowFitCrmLeads} lowFitDatabaseLeads={lowFitDatabaseLeads}
          tamData={tamData} geographyDistribution={geographyDistribution} icpProfiles={icpProfiles}
          risks={risks} insights={insights || []} effectiveOrgId={effectiveOrgId}
          onRefreshInsights={handleRefreshInsights}
          onSettingsChange={({ averageDealSize: ds, conversionRate: cr }) => updateSettings({ average_deal_size: ds, conversion_rate: cr })}
          onLaunchCampaign={(ctx) => { setSignalCampaignContext(ctx); setSignalCampaignOpen(true); }}
        />
      )}

      <EnrichmentModal open={isEnrichmentModalOpen} onOpenChange={setIsEnrichmentModalOpen} />
      <SyncProgressModal open={syncProgressOpen} onOpenChange={setSyncProgressOpen} provider="Apollo" status={syncStatus} breakdown={syncBreakdown} />
      <CampaignBuilderV2
        isOpen={signalCampaignOpen}
        onClose={() => { setSignalCampaignOpen(false); setSignalCampaignContext(undefined); }}
        source="executive-dashboard"
        insightContext={signalCampaignContext}
      />
    </div>
  );
}

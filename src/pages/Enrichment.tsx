import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  Database,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDataOrgId } from "@/hooks/use-data-org";
import { useRoles } from "@/hooks/use-roles";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { supabase } from "@/integrations/supabase/client";

// Components
import { HeroMetric } from "@/components/executive/HeroMetric";
import { DataGapsVisualization } from "@/components/enrichment/DataGapsVisualization";
import { RecentEnrichmentActivity } from "@/components/enrichment/RecentEnrichmentActivity";
import { ExportAccountsButton } from "@/components/enrichment/ExportAccountsButton";
import { ExportLeadsButton } from "@/components/enrichment/ExportLeadsButton";
import { EnrichmentDiscoverySettings } from "@/components/settings/EnrichmentDiscoverySettings";
import { ICPAccountDiscovery } from "@/components/enrichment/ICPAccountDiscovery";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { CreditsDisplay } from "@/components/enrichment/CreditsDisplay";
import { DeepResearchSettings } from "@/components/settings/DeepResearchSettings";
import { DataQualityDashboard } from "@/components/settings/DataQualityDashboard";
import { EnrichmentQualityDashboard } from "@/components/settings/EnrichmentQualityDashboard";
import { EnrichmentAccuracyReport } from "@/components/enrichment/EnrichmentAccuracyReport";
import { UnifiedEnrichmentWizard } from "@/components/enrichment/UnifiedEnrichmentWizard";
import { AIPipelineHealth } from "@/components/enrichment/AIPipelineHealth";

interface HeroStats {
  totalAccounts: number;
  totalLeads: number;
  dataCompleteness: number;
  enrichedAccounts: number;
  accountsWithContacts: number;
}

export default function Enrichment() {
  const { userProfile } = useAuth();
  const { dataOrgId, effectiveOrgId } = useDataOrgId();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const isAdmin = isSuperAdmin || isOrgAdmin;
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [heroStats, setHeroStats] = useState<HeroStats>({
    totalAccounts: 0,
    totalLeads: 0,
    dataCompleteness: 0,
    enrichedAccounts: 0,
    accountsWithContacts: 0,
  });

  useEffect(() => {
    if (dataOrgId) {
      loadHeroStats();
    }
  }, [dataOrgId]);

  const loadHeroStats = async () => {
    if (!dataOrgId) return;

    try {
      // Use the new RPC that correctly queries accounts and leads tables
      const { data, error } = await supabase.rpc('get_enrichment_page_stats', {
        p_org_id: dataOrgId
      });

      if (error) {
        console.error("Error loading enrichment stats:", error);
        return;
      }

      // Handle both array and direct object responses from RPC
      const stats = Array.isArray(data) ? data[0] : data;

      setHeroStats({
        totalAccounts: Number(stats?.total_accounts) || 0,
        totalLeads: Number(stats?.total_leads) || 0,
        dataCompleteness: Number(stats?.data_completeness_pct) || 0,
        enrichedAccounts: Number(stats?.enriched_accounts) || 0,
        accountsWithContacts: Number(stats?.accounts_with_contacts) || 0,
      });
    } catch (error) {
      console.error("Error loading hero stats:", error);
    }
  };

  // Check if feature is disabled
  if (!flagsLoading && !flags.data_enrichment) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Data Enrichment Not Available</h2>
            <p className="text-muted-foreground">
              This feature is not enabled for your organization. Contact your administrator to enable it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Enrichment</h1>
            <p className="text-sm text-muted-foreground">
              Fill data gaps and discover contacts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreditsDisplay variant="compact" />
          <ExportAccountsButton />
          <ExportLeadsButton />
        </div>
      </div>

      {/* Hero Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeroMetric
          label="Total Accounts"
          value={heroStats.totalAccounts.toLocaleString()}
          icon={Database}
          status="default"
          tooltip={{
            title: "Total Accounts",
            description: "The total number of accounts in your database",
          }}
        />
        <HeroMetric
          label="Data Completeness"
          value={`${heroStats.dataCompleteness}%`}
          icon={CheckCircle2}
          status={heroStats.dataCompleteness >= 80 ? "success" : heroStats.dataCompleteness >= 50 ? "warning" : "danger"}
          tooltip={{
            title: "Data Completeness",
            description: "Percentage of accounts with key fields (employee count, revenue, or industry)",
          }}
        />
        <HeroMetric
          label="Enriched Accounts"
          value={heroStats.enrichedAccounts.toLocaleString()}
          icon={Sparkles}
          status="success"
          tooltip={{
            title: "Enriched Accounts",
            description: "Accounts that have been enriched with external data",
          }}
        />
        <HeroMetric
          label="With Contacts"
          value={heroStats.accountsWithContacts.toLocaleString()}
          icon={Users}
          status="default"
          tooltip={{
            title: "Accounts With Contacts",
            description: "Accounts that have at least one lead/contact associated",
          }}
        />
      </div>

      {/* Unified Enrichment Wizard - Primary Action */}
      <UnifiedEnrichmentWizard />

      {/* Two Column Layout: Data Gaps + Contact Discovery */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DataGapsVisualization />
        
        {/* Contact Discovery */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contact Discovery
            </CardTitle>
            <CardDescription>
              Find and discover decision makers at your target accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnrichmentDiscoverySettings />
          </CardContent>
        </Card>
      </div>

      {/* ICP Account Discovery */}
      <ICPAccountDiscovery />

      {/* Recent Activity */}
      <RecentEnrichmentActivity />

      {/* Admin Settings - Collapsible */}
      {isAdmin && (
        <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">Admin Settings</CardTitle>
                      <CardDescription className="text-xs">
                        Configure AI research, data quality, and enrichment options
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    {settingsExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                {/* AI Pipeline Health - Real-time provider monitoring */}
                <AIPipelineHealth />

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-muted">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <LaunchPulseMark className="w-4 h-4" />
                        AI Research Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DeepResearchSettings />
                    </CardContent>
                  </Card>

                  <Card className="border-muted">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="h-4 w-4 text-primary" />
                        Data Quality
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DataQualityDashboard />
                    </CardContent>
                  </Card>
                </div>

                {/* Enrichment Accuracy Report */}
                <EnrichmentAccuracyReport />

                <Card className="border-muted">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Enrichment Quality Metrics</CardTitle>
                    <CardDescription className="text-xs">
                      Track field coverage and enrichment effectiveness
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnrichmentQualityDashboard />
                  </CardContent>
                </Card>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

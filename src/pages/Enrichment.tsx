import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  Database,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  Upload,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { supabase } from "@/integrations/supabase/client";

// Components
import { HeroMetric } from "@/components/executive/HeroMetric";
import { InstantEnrich } from "@/components/enrichment/InstantEnrich";
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
import { FlexibleLeadEnrich } from "@/components/enrichment/FlexibleLeadEnrich";
import { EnrichmentAccuracyReport } from "@/components/enrichment/EnrichmentAccuracyReport";
import { UnifiedEnrichmentWizard } from "@/components/enrichment/UnifiedEnrichmentWizard";

interface HeroStats {
  totalAccounts: number;
  dataCompleteness: number;
  enrichedToday: number;
  accountsWithContacts: number;
}

export default function Enrichment() {
  const { userProfile } = useAuth();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const isAdmin = isSuperAdmin || isOrgAdmin;
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [heroStats, setHeroStats] = useState<HeroStats>({
    totalAccounts: 0,
    dataCompleteness: 0,
    enrichedToday: 0,
    accountsWithContacts: 0,
  });

  useEffect(() => {
    if (userProfile?.org_id) {
      loadHeroStats();
    }
  }, [userProfile?.org_id]);

  const loadHeroStats = async () => {
    if (!userProfile?.org_id) return;

    try {
      // Use server-side RPC for efficient stats calculation
      const { data, error } = await supabase.rpc('get_enrichment_stats', {
        p_org_id: userProfile.org_id
      });

      if (error) {
        console.error("Error loading enrichment stats:", error);
        return;
      }

      // Handle both array and direct object responses from RPC
      const stats = Array.isArray(data) ? data[0] : data;

      setHeroStats({
        totalAccounts: Number(stats?.total_accounts) || 0,
        dataCompleteness: Number(stats?.completeness_percent) || 0,
        enrichedToday: Number(stats?.enriched_today) || 0,
        accountsWithContacts: Number(stats?.with_contacts) || 0,
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
          value={heroStats.totalAccounts}
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
            description: "Average completeness of key fields (employee count, revenue, industry, country)",
          }}
        />
        <HeroMetric
          label="Enriched Today"
          value={heroStats.enrichedToday}
          icon={Sparkles}
          status="success"
          tooltip={{
            title: "Enriched Today",
            description: "Accounts that were enriched with new data today",
          }}
        />
        <HeroMetric
          label="With Contacts"
          value={heroStats.accountsWithContacts}
          icon={Users}
          status="default"
          tooltip={{
            title: "Accounts With Contacts",
            description: "Accounts that have at least one contact associated",
          }}
        />
      </div>

      {/* Unified Enrichment Wizard - Primary Action */}
      <UnifiedEnrichmentWizard />

      {/* Primary Action - Instant Lookup */}
      <InstantEnrich />

      {/* Two Column Layout: Data Gaps + Quick Upload */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DataGapsVisualization />
        
        {/* Quick Upload Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Quick Enrich
            </CardTitle>
            <CardDescription>
              Upload a CSV or spreadsheet to enrich in bulk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your account list and we'll automatically fill in missing company data using AI research.
            </p>
            <Link to="/quick-enrich">
              <Button className="w-full gap-2">
                <Upload className="h-4 w-4" />
                Upload & Enrich
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

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

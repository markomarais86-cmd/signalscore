import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, 
  Zap, 
  History,
  Upload,
  Settings,
  ArrowRight,
  Database,
  Users
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

// Enrichment components
import { UnifiedEnrichmentDashboard } from "@/components/enrichment/UnifiedEnrichmentDashboard";
import { EnrichmentControlPanel } from "@/components/enrichment/EnrichmentControlPanel";
import { InstantEnrich } from "@/components/enrichment/InstantEnrich";
import { ExportAccountsButton } from "@/components/enrichment/ExportAccountsButton";
import { ExportLeadsButton } from "@/components/enrichment/ExportLeadsButton";
import { EnrichmentDiscoverySettings } from "@/components/settings/EnrichmentDiscoverySettings";
import { ICPAccountDiscovery } from "@/components/enrichment/ICPAccountDiscovery";
import { EnrichmentHistoryViewer } from "@/components/settings/EnrichmentHistoryViewer";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { CreditsDisplay } from "@/components/enrichment/CreditsDisplay";
import { DeepResearchSettings } from "@/components/settings/DeepResearchSettings";
import { DataQualityDashboard } from "@/components/settings/DataQualityDashboard";
import { EnrichmentQualityDashboard } from "@/components/settings/EnrichmentQualityDashboard";

export default function Enrichment() {
  const [activeTab, setActiveTab] = useState("enrich");
  const { userProfile } = useAuth();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const isAdmin = isSuperAdmin || isOrgAdmin;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Simplified Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Enrichment</h1>
            <p className="text-sm text-muted-foreground">
              Enrich your accounts and discover contacts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreditsDisplay variant="compact" />
          <ExportAccountsButton />
          <ExportLeadsButton />
        </div>
      </div>

      {/* Quick Actions Hero */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-lg transition-all cursor-pointer group">
          <CardContent className="pt-6">
            <Link to="/quick-enrich" className="block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Upload & Enrich</h3>
                    <p className="text-sm text-muted-foreground">CSV or spreadsheet</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => setActiveTab("enrich")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Enrich Accounts</h3>
                  <p className="text-sm text-muted-foreground">Fill missing data</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => setActiveTab("enrich")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Find Contacts</h3>
                  <p className="text-sm text-muted-foreground">Discover decision makers</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simplified Tabs - 3 main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="enrich" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Enrich Data
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        {/* Enrich Tab - Simplified */}
        <TabsContent value="enrich" className="space-y-6">
          {/* Instant Lookup - First thing users see */}
          <InstantEnrich />

          {/* Bulk Enrichment */}
          <EnrichmentControlPanel />

          {/* Contact Discovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Contact Discovery
              </CardTitle>
              <CardDescription>
                Find and discover contacts at your target accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnrichmentDiscoverySettings />
            </CardContent>
          </Card>

          {/* ICP Account Discovery */}
          <ICPAccountDiscovery />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <UnifiedEnrichmentDashboard />
          <EnrichmentHistoryViewer />
        </TabsContent>

        {/* Settings Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LaunchPulseMark className="w-5 h-5" />
                    AI Research Settings
                  </CardTitle>
                  <CardDescription>
                    Configure AI-powered enrichment options
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DeepResearchSettings />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Data Quality
                  </CardTitle>
                  <CardDescription>
                    Monitor and improve data completeness
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataQualityDashboard />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Enrichment Quality Metrics</CardTitle>
                <CardDescription>
                  Track field coverage and enrichment effectiveness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnrichmentQualityDashboard />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
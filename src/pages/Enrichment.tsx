import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Sparkles, 
  Zap, 
  BarChart3, 
  Target, 
  Bot,
  History,
  TrendingUp,
  Users,
  Search,
  Upload
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

// Enrichment components
import { UnifiedEnrichmentDashboard } from "@/components/enrichment/UnifiedEnrichmentDashboard";
import { EnrichmentControlPanel } from "@/components/enrichment/EnrichmentControlPanel";
import { ExportAccountsButton } from "@/components/enrichment/ExportAccountsButton";
import { ExportLeadsButton } from "@/components/enrichment/ExportLeadsButton";
import { EnrichmentDiscoverySettings } from "@/components/settings/EnrichmentDiscoverySettings";
import { ICPAccountDiscovery } from "@/components/enrichment/ICPAccountDiscovery";
import { DataQualityDashboard } from "@/components/settings/DataQualityDashboard";
import { EnrichmentQualityDashboard } from "@/components/settings/EnrichmentQualityDashboard";
import { EnrichmentAttributionReport } from "@/components/settings/EnrichmentAttributionReport";
import { EnrichmentTester } from "@/components/settings/EnrichmentTester";
import { DeepResearchSettings } from "@/components/settings/DeepResearchSettings";
import { EnrichmentAnalyticsDashboard } from "@/components/settings/EnrichmentAnalyticsDashboard";
import { CandidateSelector } from "@/components/enrichment/CandidateSelector";
import { EnrichmentHistoryViewer } from "@/components/settings/EnrichmentHistoryViewer";
import { LeadsBackfill } from "@/components/settings/LeadsBackfill";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { CreditsDisplay } from "@/components/enrichment/CreditsDisplay";

export default function Enrichment() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const { userProfile } = useAuth();
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  const isAdmin = isSuperAdmin || isOrgAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <LaunchPulseMark className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Data Enrichment</h1>
              <p className="text-muted-foreground">
                Enrich accounts and discover contacts with Launch Pulse intelligence
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link to="/quick-enrich">
              <Upload className="h-4 w-4 mr-2" />
              Quick Enrich
            </Link>
          </Button>
          <ExportAccountsButton />
          <ExportLeadsButton />
          <CreditsDisplay variant="compact" />
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 flex-shrink-0">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="enrich" className="flex items-center gap-2 flex-shrink-0">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Enrich</span>
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2 flex-shrink-0">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Quality</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 flex-shrink-0">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="advanced" className="flex items-center gap-2 flex-shrink-0">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Dashboard Tab - Real-time monitoring */}
        <TabsContent value="dashboard" className="space-y-6">
          <UnifiedEnrichmentDashboard />
        </TabsContent>

        {/* Enrich Tab - Simplified with 2 sections */}
        <TabsContent value="enrich" className="space-y-6">
          {/* Section 1: Enrich Your Data */}
          <EnrichmentControlPanel />

          {/* Section 2: Contact Discovery */}
          <EnrichmentDiscoverySettings />

          {/* Section 3: ICP Account Discovery */}
          <ICPAccountDiscovery />
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-6">
          <Accordion 
            type="multiple" 
            defaultValue={["data-quality", "enrichment-quality"]} 
            className="space-y-4"
          >
            <AccordionItem value="data-quality" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Data Quality & Firmographic Sync</p>
                    <p className="text-sm text-muted-foreground">
                      Sync data between accounts and leads, enrich HQ addresses
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <DataQualityDashboard />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="enrichment-quality" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Enrichment Quality</p>
                    <p className="text-sm text-muted-foreground">
                      Quality metrics and field coverage
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <EnrichmentQualityDashboard />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="attribution" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Attribution Report</p>
                    <p className="text-sm text-muted-foreground">
                      Track enrichment sources and effectiveness
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <EnrichmentAttributionReport />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="backfill" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">Leads Backfill</p>
                    <p className="text-sm text-muted-foreground">
                      Backfill missing lead data from accounts
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <LeadsBackfill />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <EnrichmentHistoryViewer />
        </TabsContent>

        {/* Advanced Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="advanced" className="space-y-6">
            <Accordion 
              type="multiple" 
              defaultValue={["deep-research"]} 
              className="space-y-4"
            >
              <AccordionItem value="deep-research" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <LaunchPulseMark className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold">Deep Research & Analytics</p>
                      <p className="text-sm text-muted-foreground">
                        AI-powered enrichment and cost management
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <DeepResearchSettings />
                  <Button 
                    onClick={() => setShowCandidateSelector(true)} 
                    variant="outline" 
                    className="w-full"
                  >
                    Review Ambiguous Matches
                  </Button>
                  <EnrichmentAnalyticsDashboard />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tester" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold">Enrichment Tester</p>
                      <p className="text-sm text-muted-foreground">
                        Test enrichment on individual records
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <EnrichmentTester />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <CandidateSelector 
              isOpen={showCandidateSelector} 
              onClose={() => setShowCandidateSelector(false)} 
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

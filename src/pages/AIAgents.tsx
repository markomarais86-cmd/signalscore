import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentControlPanel } from "@/components/agents/AgentControlPanel";
import { AgentPerformanceMetrics } from "@/components/agents/AgentPerformanceMetrics";
import { AgentRunHistory } from "@/components/agents/AgentRunHistory";
import { DataQualityOverview } from "@/components/settings/DataQualityOverview";
import { SmartEnrichmentPanel } from "@/components/settings/SmartEnrichmentPanel";
import { Bot, BarChart3, Database, History, Sparkles } from "lucide-react";

export default function AIAgents() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">AI Data Agents</h1>
        <p className="text-muted-foreground">
          Automate data enrichment and quality management for your accounts
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Run History
          </TabsTrigger>
          <TabsTrigger value="enrichment" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Enrichment
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Quality
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AgentControlPanel />
        </TabsContent>

        <TabsContent value="performance">
          <AgentPerformanceMetrics />
        </TabsContent>

        <TabsContent value="history">
          <AgentRunHistory />
        </TabsContent>

        <TabsContent value="enrichment">
          <SmartEnrichmentPanel />
        </TabsContent>

        <TabsContent value="quality">
          <DataQualityOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}

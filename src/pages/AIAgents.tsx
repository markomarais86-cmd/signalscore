import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentControlPanel } from "@/components/agents/AgentControlPanel";
import { AgentPerformanceMetrics } from "@/components/agents/AgentPerformanceMetrics";
import { LeadQualificationQueue } from "@/components/agents/LeadQualificationQueue";
import { FollowUpAutomation } from "@/components/agents/FollowUpAutomation";
import { MeetingSchedulerPanel } from "@/components/agents/MeetingSchedulerPanel";
import { DataQualityOverview } from "@/components/settings/DataQualityOverview";
import { Bot, Users, Mail, Calendar, BarChart3, Database } from "lucide-react";

export default function AIAgents() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">AI Sales Agents</h1>
        <p className="text-muted-foreground">
          Automate lead qualification, follow-ups, meeting scheduling, and data enrichment
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="qualification" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Qualification
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Follow-Up
          </TabsTrigger>
          <TabsTrigger value="meetings" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Meetings
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

        <TabsContent value="qualification">
          <LeadQualificationQueue />
        </TabsContent>

        <TabsContent value="followup">
          <FollowUpAutomation />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingSchedulerPanel />
        </TabsContent>

        <TabsContent value="quality">
          <DataQualityOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}

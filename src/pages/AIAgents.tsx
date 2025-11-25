import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentControlPanel } from "@/components/agents/AgentControlPanel";
import { LeadQualificationQueue } from "@/components/agents/LeadQualificationQueue";
import { FollowUpAutomation } from "@/components/agents/FollowUpAutomation";
import { MeetingSchedulerPanel } from "@/components/agents/MeetingSchedulerPanel";
import { Bot, Users, Mail, Calendar } from "lucide-react";

export default function AIAgents() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">AI Sales Agents</h1>
        <p className="text-muted-foreground">
          Automate lead qualification, follow-ups, meeting scheduling, and data enrichment
        </p>
      </div>

      <AgentControlPanel />

      <Tabs defaultValue="qualification" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="qualification" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lead Qualification
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Follow-Up
          </TabsTrigger>
          <TabsTrigger value="meetings" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Meeting Scheduler
          </TabsTrigger>
          <TabsTrigger value="enrichment" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Data Enrichment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qualification">
          <LeadQualificationQueue />
        </TabsContent>

        <TabsContent value="followup">
          <FollowUpAutomation />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingSchedulerPanel />
        </TabsContent>

        <TabsContent value="enrichment">
          <div className="text-center py-12 text-muted-foreground">
            Data enrichment agent runs automatically in the background
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealStageBoard } from '@/components/pipeline/DealStageBoard';
import { RevenueAttributionPanel } from '@/components/pipeline/RevenueAttributionPanel';
import { Kanban, BarChart3 } from 'lucide-react';

export default function Opportunities() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
        <p className="text-muted-foreground">
          Track deal stages, capture win/loss reasons, and attribute revenue to campaigns
        </p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="flex items-center gap-1">
            <Kanban className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="attribution" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> Attribution
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <DealStageBoard />
        </TabsContent>
        <TabsContent value="attribution" className="mt-4">
          <RevenueAttributionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealStageBoard } from '@/components/pipeline/DealStageBoard';
import { RevenueAttributionPanel } from '@/components/pipeline/RevenueAttributionPanel';
import { DealForecastPanel } from '@/components/pipeline/DealForecastPanel';
import { WinLossAnalysis } from '@/components/pipeline/WinLossAnalysis';
import { Kanban, BarChart3, TrendingUp, Trophy } from 'lucide-react';

export default function Opportunities() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
        <p className="text-muted-foreground">
          Track deal stages, forecast revenue, and analyze win/loss patterns
        </p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="flex items-center gap-1">
            <Kanban className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> Forecast
          </TabsTrigger>
          <TabsTrigger value="winloss" className="flex items-center gap-1">
            <Trophy className="h-4 w-4" /> Win/Loss
          </TabsTrigger>
          <TabsTrigger value="attribution" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> Attribution
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <DealStageBoard />
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          <DealForecastPanel />
        </TabsContent>
        <TabsContent value="winloss" className="mt-4">
          <WinLossAnalysis />
        </TabsContent>
        <TabsContent value="attribution" className="mt-4">
          <RevenueAttributionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

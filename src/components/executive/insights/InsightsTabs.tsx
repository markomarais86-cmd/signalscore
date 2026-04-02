import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Zap, Target } from "lucide-react";
import { InsightCard } from "./InsightCard";
import type { UnifiedItem } from "./types";

interface InsightsTabsProps {
  urgent: UnifiedItem[];
  quickWins: UnifiedItem[];
  strategic: UnifiedItem[];
  isLoading: boolean;
  onDismiss: (item: UnifiedItem, e: React.MouseEvent) => void;
  onClick: (item: UnifiedItem) => void;
  inferWorkflowType: (action: string) => string | null;
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function LoadingGrid({ count }: { count: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${count > 2 ? 'lg:grid-cols-3' : ''} gap-3`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

function ItemGrid({ items, cols, onDismiss, onClick, inferWorkflowType }: {
  items: UnifiedItem[];
  cols: string;
  onDismiss: InsightsTabsProps['onDismiss'];
  onClick: InsightsTabsProps['onClick'];
  inferWorkflowType: InsightsTabsProps['inferWorkflowType'];
}) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {items.map(item => (
        <InsightCard
          key={item.id}
          item={item}
          onDismiss={onDismiss}
          onClick={onClick}
          inferWorkflowType={inferWorkflowType}
        />
      ))}
    </div>
  );
}

export function InsightsTabs({ urgent, quickWins, strategic, isLoading, onDismiss, onClick, inferWorkflowType }: InsightsTabsProps) {
  return (
    <Tabs defaultValue="urgent" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="urgent" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Urgent ({urgent.length})
        </TabsTrigger>
        <TabsTrigger value="quick-wins" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Wins ({quickWins.length})
        </TabsTrigger>
        <TabsTrigger value="strategic" className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Strategic ({strategic.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="urgent" className="space-y-3">
        {isLoading ? <LoadingGrid count={2} /> :
          urgent.length > 0 ? <ItemGrid items={urgent} cols="grid-cols-1 md:grid-cols-2" onDismiss={onDismiss} onClick={onClick} inferWorkflowType={inferWorkflowType} /> :
          <EmptyState icon={AlertTriangle} label="No urgent items — all critical issues resolved" />
        }
      </TabsContent>

      <TabsContent value="quick-wins" className="space-y-3">
        {isLoading ? <LoadingGrid count={3} /> :
          quickWins.length > 0 ? <ItemGrid items={quickWins} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" onDismiss={onDismiss} onClick={onClick} inferWorkflowType={inferWorkflowType} /> :
          <EmptyState icon={Zap} label="No quick wins available" />
        }
      </TabsContent>

      <TabsContent value="strategic" className="space-y-3">
        {isLoading ? <LoadingGrid count={3} /> :
          strategic.length > 0 ? <ItemGrid items={strategic} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" onDismiss={onDismiss} onClick={onClick} inferWorkflowType={inferWorkflowType} /> :
          <EmptyState icon={Target} label="No strategic items" />
        }
      </TabsContent>
    </Tabs>
  );
}

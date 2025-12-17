import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  Zap, 
  X,
  Loader2 
} from "lucide-react";

export interface ProactiveInsight {
  id: string;
  type: 'critical' | 'opportunity' | 'info' | 'agent_activity';
  title: string;
  description: string;
  metric?: number;
  actions: {
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }[];
  dismissible: boolean;
}

interface InsightCardProps {
  insight: ProactiveInsight;
  onAction: (action: string, params?: Record<string, unknown>) => void;
  onDismiss: (id: string) => void;
  isEnrichmentActive?: boolean;
  isStartingEnrichment?: boolean;
}

export function InsightCard({ 
  insight, 
  onAction, 
  onDismiss, 
  isEnrichmentActive,
  isStartingEnrichment 
}: InsightCardProps) {
  const getTypeIcon = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'opportunity':
        return <Target className="h-4 w-4 text-primary" />;
      case 'agent_activity':
        return <Zap className="h-4 w-4 text-amber-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'critical':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'opportunity':
        return <Badge className="bg-primary/10 text-primary">Opportunity</Badge>;
      case 'agent_activity':
        return <Badge className="bg-amber-500/10 text-amber-600">Agent Activity</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const renderActionButton = (
    actionItem: { label: string; action: string; params?: Record<string, unknown> }, 
    idx: number
  ) => {
    const isEnrichAction = actionItem.action === 'enrich_ai_free';
    
    // If enrichment is active, show disabled state for enrich buttons
    if (isEnrichAction && isEnrichmentActive) {
      return (
        <Button
          key={idx}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled
        >
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          See progress above
        </Button>
      );
    }
    
    const isStarting = isEnrichAction && isStartingEnrichment;
    
    return (
      <Button
        key={idx}
        variant={idx === 0 ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        disabled={isStarting}
        onClick={() => onAction(actionItem.action, actionItem.params)}
      >
        {isStarting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Starting...
          </>
        ) : (
          actionItem.label
        )}
      </Button>
    );
  };

  return (
    <div className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          {getTypeIcon(insight.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{insight.title}</span>
              {getTypeBadge(insight.type)}
              {insight.metric !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {insight.metric}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{insight.description}</p>
            {insight.actions.length > 0 && (
              <div className="flex gap-2 mt-2">
                {insight.actions.map((actionItem, idx) => renderActionButton(actionItem, idx))}
              </div>
            )}
          </div>
        </div>
        {insight.dismissible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onDismiss(insight.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

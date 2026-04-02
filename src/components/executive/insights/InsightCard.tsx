import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Zap, Target, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedItem } from "./types";

interface InsightCardProps {
  item: UnifiedItem;
  onDismiss: (item: UnifiedItem, e: React.MouseEvent) => void;
  onClick: (item: UnifiedItem) => void;
  inferWorkflowType: (action: string) => string | null;
}

function getIcon(item: UnifiedItem) {
  if (item.type === 'risk') return AlertTriangle;
  switch (item.category) {
    case 'revenue': return TrendingUp;
    case 'signal': return Zap;
    default: return Target;
  }
}

function getColorClass(item: UnifiedItem) {
  if (item.type === 'risk') {
    switch (item.severity) {
      case 'critical':
      case 'high':
        return 'border-executive-red/30 bg-executive-red/5 hover:bg-executive-red/10';
      case 'medium':
      case 'low':
        return 'border-executive-amber/30 bg-executive-amber/5 hover:bg-executive-amber/10';
      default: return 'border-primary/30 bg-primary/5 hover:bg-primary/10';
    }
  }
  switch (item.category) {
    case 'revenue': return 'border-executive-green/40 bg-executive-green/5 hover:bg-executive-green/10';
    case 'signal': return 'border-accent/40 bg-accent/5 hover:bg-accent/10';
    default: return 'border-primary/40 bg-primary/5 hover:bg-primary/10';
  }
}

export function InsightCard({ item, onDismiss, onClick, inferWorkflowType }: InsightCardProps) {
  const Icon = getIcon(item);
  const colorClass = getColorClass(item);

  return (
    <div
      className={cn(
        "relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer group hover:translate-y-[-2px] hover:shadow-md backdrop-blur-sm",
        colorClass
      )}
      onClick={() => onClick(item)}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => onDismiss(item, e)}
      >
        <X className="h-3 w-3" />
      </Button>

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-background/80">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
            {item.type === 'risk' && item.severity && (
              <Badge
                variant={
                  item.severity === 'critical' || item.severity === 'high'
                    ? 'destructive'
                    : 'outline'
                }
                className="text-xs"
              >
                {item.severity}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
          {item.relatedRisk && (
            <p className="text-xs text-primary mt-1">
              ↳ Related to: {item.relatedRisk}
            </p>
          )}
        </div>
        {item.count && (
          <div className="text-right shrink-0">
            <div className="text-xl font-bold">{item.count.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">affected</div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t space-y-2">
        <div className="text-xs font-medium text-primary">
          Impact: {item.impact}
        </div>
        {item.action && (
          <Button
            size="sm"
            className="w-full h-7 text-xs transition-all duration-200 hover:scale-[1.02]"
            onClick={(e) => {
              e.stopPropagation();
              onClick(item);
            }}
          >
            {inferWorkflowType(item.action) && (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {item.action}
          </Button>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertCircle, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Target,
  Activity,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'progress';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  progress?: {
    current: number;
    total: number;
  };
}

interface StatusBarProps {
  items: StatusItem[];
  className?: string;
}

const statusConfig = {
  info: {
    icon: AlertCircle,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    iconClass: 'text-blue-500',
    badgeVariant: 'secondary' as const
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    iconClass: 'text-amber-500',
    badgeVariant: 'secondary' as const
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-destructive/10 border-destructive/30',
    iconClass: 'text-destructive',
    badgeVariant: 'destructive' as const
  },
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-green-500/10 border-green-500/30',
    iconClass: 'text-green-500',
    badgeVariant: 'secondary' as const
  },
  progress: {
    icon: RefreshCw,
    bgClass: 'bg-primary/10 border-primary/30',
    iconClass: 'text-primary',
    badgeVariant: 'default' as const
  }
};

function StatusItemRow({ item }: { item: StatusItem }) {
  const config = statusConfig[item.type];
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 p-3 rounded-lg border",
      config.bgClass
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={cn(
          "h-4 w-4 shrink-0",
          config.iconClass,
          item.type === 'progress' && "animate-spin"
        )} />
        <div className="min-w-0">
          <div className="font-medium text-sm">{item.title}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground truncate">{item.description}</div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        {item.progress && (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">
              {Math.round((item.progress.current / item.progress.total) * 100)}%
            </div>
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(item.progress.current / item.progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {item.action && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={item.action.onClick}
            disabled={item.action.loading}
            className="h-7 text-xs"
          >
            {item.action.loading ? (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            {item.action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function StatusBar({ items, className }: StatusBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Don't render if no items
  if (items.length === 0) return null;
  
  // Prioritize items: progress > error > warning > info > success
  const priorityOrder = { progress: 0, error: 1, warning: 2, info: 3, success: 4 };
  const sortedItems = [...items].sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);
  
  const primaryItem = sortedItems[0];
  const additionalItems = sortedItems.slice(1);
  const hasMultiple = items.length > 1;
  
  // Calculate summary for collapsed state
  const errorCount = items.filter(i => i.type === 'error').length;
  const warningCount = items.filter(i => i.type === 'warning').length;
  const infoCount = items.filter(i => i.type === 'info').length;
  const progressCount = items.filter(i => i.type === 'progress').length;
  
  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Primary Status Item - Always visible */}
        <div className="relative">
          <StatusItemRow item={primaryItem} />
          
          {/* Expand/Collapse button overlay */}
          {hasMultiple && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 hover:bg-background/50"
              >
                <div className="flex items-center gap-1.5">
                  {!isOpen && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {progressCount > 0 && <Badge variant="default" className="h-5 px-1.5">{progressCount} running</Badge>}
                      {errorCount > 0 && <Badge variant="destructive" className="h-5 px-1.5">{errorCount}</Badge>}
                      {warningCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 bg-amber-500/20 text-amber-700">{warningCount}</Badge>}
                      {infoCount > 0 && <Badge variant="secondary" className="h-5 px-1.5">{infoCount}</Badge>}
                    </div>
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        
        {/* Additional Status Items - Collapsible */}
        <CollapsibleContent className="space-y-2 mt-2">
          {additionalItems.map((item) => (
            <StatusItemRow key={item.id} item={item} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Build status items from dashboard state
export function buildStatusItems({
  activeScoringJob,
  apolloStale,
  isDataStale,
  dataCompleteness,
  totalAccounts,
  sourceFilter,
  onSyncApollo,
  onGoToICP,
  onEnrich,
  syncingApollo,
  isChildOrg,
  childOrgName
}: {
  activeScoringJob?: any;
  apolloStale?: boolean;
  isDataStale?: boolean;
  dataCompleteness?: number;
  totalAccounts?: number;
  sourceFilter?: string;
  onSyncApollo?: () => void;
  onGoToICP?: () => void;
  onEnrich?: () => void;
  syncingApollo?: boolean;
  isChildOrg?: boolean;
  childOrgName?: string;
}): StatusItem[] {
  const items: StatusItem[] = [];
  
  // Active scoring job - highest priority
  if (activeScoringJob) {
    items.push({
      id: 'scoring-progress',
      type: 'progress',
      title: 'Re-scoring in progress...',
      description: `${activeScoringJob.processed_accounts || 0} of ${activeScoringJob.total_accounts || 0} accounts processed`,
      progress: {
        current: activeScoringJob.processed_accounts || 0,
        total: activeScoringJob.total_accounts || 1
      }
    });
  }
  
  // Apollo stale data
  if (apolloStale && sourceFilter === 'database') {
    items.push({
      id: 'apollo-stale',
      type: 'info',
      title: 'Apollo TAM data may be outdated',
      description: 'Your ICP was updated after the last sync',
      action: onSyncApollo ? {
        label: syncingApollo ? 'Syncing...' : 'Refresh Apollo',
        onClick: onSyncApollo,
        loading: syncingApollo
      } : undefined
    });
  }
  
  // ICP stale data
  if (isDataStale && !activeScoringJob) {
    items.push({
      id: 'icp-stale',
      type: 'warning',
      title: 'ICP recently updated',
      description: 'Re-score accounts to see updated fit scores',
      action: onGoToICP ? {
        label: 'Go to ICP Manager',
        onClick: onGoToICP
      } : undefined
    });
  }
  
  // Data quality warning
  if (totalAccounts && totalAccounts > 0 && dataCompleteness !== undefined && dataCompleteness < 70) {
    const missingPercent = Math.round(100 - dataCompleteness);
    items.push({
      id: 'data-quality',
      type: 'warning',
      title: `Data Quality Alert: ${missingPercent}% incomplete`,
      description: 'Scores may be less accurate with incomplete data',
      action: onEnrich ? {
        label: 'Enrich Data',
        onClick: onEnrich
      } : undefined
    });
  }
  // Child org filtered view indicator
  if (isChildOrg) {
    items.push({
      id: 'child-org-filter',
      type: 'info',
      title: 'Showing scored accounts only',
      description: `Data filtered to accounts scored by ${childOrgName || 'this organization'} — not the full parent dataset`
    });
  }
  
  return items;
}

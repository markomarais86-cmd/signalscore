import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Zap, AlertCircle } from "lucide-react";
import { useApolloCredits } from "@/hooks/use-apollo-credits";

interface ApolloCreditsDisplayProps {
  compact?: boolean;
}

export function ApolloCreditsDisplay({ compact = false }: ApolloCreditsDisplayProps) {
  const { 
    configured, 
    creditsRemaining, 
    creditsUsedToday, 
    dailyLimit,
    isLoading, 
    error,
    refreshCredits 
  } = useApolloCredits();

  if (!configured) {
    return null;
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-destructive border-destructive/50">
              <AlertCircle className="h-3 w-3" />
              Apollo Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 animate-pulse">
        <Zap className="h-3 w-3" />
        Loading...
      </Badge>
    );
  }

  const usagePercent = dailyLimit && creditsRemaining !== null 
    ? ((dailyLimit - creditsRemaining) / dailyLimit) * 100 
    : 0;

  const isLow = creditsRemaining !== null && dailyLimit && creditsRemaining < dailyLimit * 0.2;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 cursor-help ${isLow ? 'text-amber-600 border-amber-500/50' : 'text-primary border-primary/50'}`}
            >
              <Zap className="h-3 w-3" />
              {creditsRemaining?.toLocaleString() ?? '—'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">Apollo Credits</p>
              <p>{creditsRemaining?.toLocaleString() ?? 0} / {dailyLimit?.toLocaleString() ?? 0} remaining today</p>
              <p className="text-muted-foreground text-xs">{creditsUsedToday?.toLocaleString() ?? 0} used today</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2">
        <Zap className={`h-4 w-4 ${isLow ? 'text-amber-500' : 'text-primary'}`} />
        <div className="text-sm">
          <span className="font-medium">Apollo Credits:</span>
          <span className={`ml-2 ${isLow ? 'text-amber-600' : 'text-foreground'}`}>
            {creditsRemaining?.toLocaleString() ?? '—'} remaining
          </span>
          <span className="text-muted-foreground ml-1">
            / {dailyLimit?.toLocaleString() ?? '—'} daily
          </span>
        </div>
      </div>
      
      {creditsUsedToday !== null && creditsUsedToday > 0 && (
        <Badge variant="secondary" className="text-xs">
          {creditsUsedToday.toLocaleString()} used today
        </Badge>
      )}

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 ml-auto"
        onClick={refreshCredits}
      >
        <RefreshCw className="h-3 w-3" />
      </Button>

      {/* Usage bar */}
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${isLow ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
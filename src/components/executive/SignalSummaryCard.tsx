import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { useAccountSignals } from "@/hooks/useAccountSignals";
import { cn } from "@/lib/utils";

interface SignalSummaryCardProps {
  onViewAll?: () => void;
  className?: string;
}

export function SignalSummaryCard({ onViewAll, className }: SignalSummaryCardProps) {
  const { signals, summary, isLoading } = useAccountSignals({ limit: 5 });

  const topSignal = signals[0];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      {summary.critical > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive" />
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Account Signals
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{summary.critical}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{summary.high}</div>
            <div className="text-[10px] text-muted-foreground uppercase">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{summary.medium + summary.low}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Other</div>
          </div>
        </div>

        {/* Top Signal Preview */}
        {topSignal && (
          <div className={cn(
            "p-3 rounded-lg border-l-4",
            topSignal.signal_priority === 'critical' 
              ? "bg-destructive/10 border-l-destructive" 
              : topSignal.signal_priority === 'high'
              ? "bg-orange-500/10 border-l-orange-500"
              : "bg-accent border-l-primary"
          )}>
            <div className="flex items-start gap-2">
              {topSignal.signal_priority === 'critical' ? (
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              ) : topSignal.signal_type.includes('up') || topSignal.signal_type === 'new_high_fit' ? (
                <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Badge 
                    variant={topSignal.signal_priority === 'critical' ? 'destructive' : 'secondary'}
                    className="text-[9px] px-1 py-0"
                  >
                    {topSignal.signal_priority.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm font-medium line-clamp-1">{topSignal.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {topSignal.account_name || topSignal.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {summary.total === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">No active signals</p>
          </div>
        )}

        {/* CTA */}
        {onViewAll && summary.total > 0 && (
          <Button 
            variant="outline" 
            className="w-full h-8 text-xs"
            onClick={onViewAll}
          >
            Review All Signals
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

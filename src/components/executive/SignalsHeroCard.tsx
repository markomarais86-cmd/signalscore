import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Bell, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccountSignals } from "@/hooks/useAccountSignals";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SignalsHeroCardProps {
  className?: string;
}

export function SignalsHeroCard({ className }: SignalsHeroCardProps) {
  const navigate = useNavigate();
  const { signals, summary, isLoading } = useAccountSignals({ limit: 50 });

  if (isLoading) {
    return (
      <Card className={cn("border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent", className)}>
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topSignal = signals?.[0];
  const hasSignals = summary && summary.total > 0;

  return (
    <Card className={cn(
      "border-2 bg-gradient-to-r from-background to-muted/30 overflow-hidden",
      summary?.critical && summary.critical > 0 
        ? "border-destructive/50 from-destructive/5" 
        : summary?.high && summary.high > 0
          ? "border-executive-amber/50 from-executive-amber/5"
          : "border-primary/20 from-primary/5",
      className
    )}>
      <CardContent className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Icon */}
          <div className={cn(
            "flex items-center justify-center h-12 w-12 rounded-full shrink-0",
            summary?.critical && summary.critical > 0
              ? "bg-destructive/10"
              : summary?.high && summary.high > 0
                ? "bg-executive-amber/10"
                : "bg-primary/10"
          )}>
            {summary?.critical && summary.critical > 0 ? (
              <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
            ) : (
              <Zap className="h-6 w-6 text-primary" />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">Signals Today</h3>
              {hasSignals && (
                <Badge variant="secondary" className="text-xs">
                  {summary.total} active
                </Badge>
              )}
            </div>

            {hasSignals ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {summary.critical > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                    </span>
                    <span className="font-medium text-destructive">{summary.critical} Critical</span>
                  </div>
                )}
                {summary.high > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-executive-amber"></span>
                    <span className="font-medium text-executive-amber">{summary.high} High</span>
                  </div>
                )}
                {(summary.medium + summary.low) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                    <span className="text-muted-foreground">{summary.medium + summary.low} Other</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active signals detected</p>
            )}
          </div>

          {/* Top Signal Preview */}
          {topSignal && (
            <div className="hidden xl:flex items-center gap-3 px-4 py-2 rounded-lg bg-background/60 border max-w-sm">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{topSignal.account_name || 'Account'}</p>
                <p className="text-sm font-medium truncate">{topSignal.title}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`/accounts?id=${topSignal.account_external_id}`)}
              >
                View
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              variant={hasSignals ? "default" : "outline"} 
              size="sm"
              onClick={() => navigate('/signals')}
              className="gap-1"
            >
              {hasSignals ? 'Review Signals' : 'View Signals'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
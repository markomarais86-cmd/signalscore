import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, RefreshCw, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, Target, ArrowRight } from "lucide-react";
import { useWeeklyReport, WeeklyReport } from "@/hooks/useWeeklyReport";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface WeeklyReportCardProps {
  className?: string;
}

export function WeeklyReportCard({ className }: WeeklyReportCardProps) {
  const navigate = useNavigate();
  const { report, isLoading, generateReport, lastGenerated } = useWeeklyReport();
  const [isExpanded, setIsExpanded] = useState(false);

  const renderMetricChange = (value: number, label: string) => {
    if (value === 0) return null;
    return (
      <div className="flex items-center gap-1 text-xs">
        {value > 0 ? (
          <TrendingUp className="h-3 w-3 text-executive-green" />
        ) : (
          <TrendingDown className="h-3 w-3 text-destructive" />
        )}
        <span className={value > 0 ? "text-executive-green" : "text-destructive"}>
          {value > 0 ? '+' : ''}{value} {label}
        </span>
      </div>
    );
  };

  if (!report && !isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Weekly Intelligence Report
          </CardTitle>
          <CardDescription>
            AI-generated summary of your week's performance and opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateReport} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Generate Weekly Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <CardTitle className="text-lg">Generating Report...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Weekly Intelligence Report
              </CardTitle>
              {lastGenerated && (
                <CardDescription className="mt-1">
                  Generated {format(new Date(lastGenerated), 'MMM d, yyyy h:mm a')}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={generateReport} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Accounts Scored</p>
              <p className="text-xl font-bold">{report?.metrics.accounts_scored_this_week || 0}</p>
              {renderMetricChange(report?.metrics.high_fit_change || 0, 'high-fit')}
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">High-Fit Found</p>
              <p className="text-xl font-bold text-executive-green">{report?.metrics.high_fit_scored || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Signals Detected</p>
              <p className="text-xl font-bold">{report?.metrics.signals_detected || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Critical Alerts</p>
              <p className={cn(
                "text-xl font-bold",
                (report?.metrics.critical_signals || 0) > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {report?.metrics.critical_signals || 0}
              </p>
            </div>
          </div>

          {/* AI Summary - Always visible */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-sm whitespace-pre-wrap">{report?.ai_summary}</p>
            </div>
          </div>

          <CollapsibleContent className="space-y-4">
            {/* Top Opportunities */}
            {report?.top_opportunities && report.top_opportunities.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-executive-green" />
                  Top Opportunities This Week
                </h4>
                <div className="space-y-2">
                  {report.top_opportunities.map((opp, idx) => (
                    <div 
                      key={opp.account_external_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/accounts?id=${opp.account_external_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                        <div>
                          <p className="font-medium text-sm">{opp.account_name}</p>
                          <p className="text-xs text-muted-foreground">{opp.industry}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={opp.band === 'A' ? 'default' : 'secondary'}>
                          {opp.band}
                        </Badge>
                        <span className="text-sm font-medium">{opp.score}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accounts Needing Attention */}
            {report?.accounts_needing_attention && report.accounts_needing_attention.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-executive-amber" />
                  Accounts Needing Attention
                </h4>
                <div className="space-y-2">
                  {report.accounts_needing_attention.map((acc) => (
                    <div 
                      key={acc.account_external_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors border border-destructive/20"
                      onClick={() => navigate(`/accounts?id=${acc.account_external_id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{acc.account_name}</p>
                        <p className="text-xs text-muted-foreground">{acc.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          {acc.priority}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signal Breakdown */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Signal Breakdown:</span>
                {report?.signal_breakdown.critical > 0 && (
                  <Badge variant="destructive">{report.signal_breakdown.critical} Critical</Badge>
                )}
                {report?.signal_breakdown.high > 0 && (
                  <Badge className="bg-executive-amber text-white">{report.signal_breakdown.high} High</Badge>
                )}
                {report?.signal_breakdown.medium > 0 && (
                  <Badge variant="secondary">{report.signal_breakdown.medium} Medium</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/signals')}>
                View All Signals
              </Button>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
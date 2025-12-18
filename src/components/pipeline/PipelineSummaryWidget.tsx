import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { usePipelineSummary, useGeneratePipelineSummary } from '@/hooks/use-pipeline-summary';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface MetricBadgeProps {
  label: string;
  value: string | number;
  type?: 'default' | 'success' | 'warning' | 'danger';
}

function MetricBadge({ label, value, type = 'default' }: MetricBadgeProps) {
  const colorClasses = {
    default: 'bg-muted text-foreground',
    success: 'bg-green-500/10 text-green-600 border-green-500/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  
  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
      colorClasses[type]
    )}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function PipelineSummaryWidget() {
  const { data: summary, isLoading, error } = usePipelineSummary({ summaryType: 'daily' });
  const generateSummary = useGeneratePipelineSummary();

  const handleRefresh = () => {
    generateSummary.mutate('daily');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Failed to load summary: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pipeline Summary
          </CardTitle>
          <CardDescription>
            {summary ? (
              <>
                AI-generated • Updated {formatDistanceToNow(new Date(summary.generated_at), { addSuffix: true })}
              </>
            ) : (
              'AI-generated pipeline insights'
            )}
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={generateSummary.isPending}
        >
          <RefreshCw className={cn(
            'h-4 w-4 mr-1',
            generateSummary.isPending && 'animate-spin'
          )} />
          Refresh
        </Button>
      </CardHeader>
      
      <CardContent>
        {!summary ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No summary available</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={handleRefresh}
              disabled={generateSummary.isPending}
            >
              Generate Summary
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Narrative Summary */}
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-sm leading-relaxed">{summary.summary_text}</p>
            </div>
            
            {/* Metrics Snapshot */}
            {Object.keys(summary.metrics_snapshot).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.metrics_snapshot).slice(0, 4).map(([key, value]) => (
                  <MetricBadge 
                    key={key} 
                    label={key.replace(/_/g, ' ')} 
                    value={String(value)} 
                  />
                ))}
              </div>
            )}
            
            {/* Tabs for Insights, Risks, Opportunities, Actions */}
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="insights" className="text-xs">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="risks" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Risks
                </TabsTrigger>
                <TabsTrigger value="opportunities" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Opportunities
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Actions
                </TabsTrigger>
              </TabsList>
              
              <ScrollArea className="h-[200px] mt-3">
                <TabsContent value="insights" className="mt-0">
                  {summary.key_insights.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.key_insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No insights available</p>
                  )}
                </TabsContent>
                
                <TabsContent value="risks" className="mt-0">
                  {summary.risks.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.risks.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No risks identified</p>
                  )}
                </TabsContent>
                
                <TabsContent value="opportunities" className="mt-0">
                  {summary.opportunities.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.opportunities.map((opp, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{opp}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No opportunities identified</p>
                  )}
                </TabsContent>
                
                <TabsContent value="actions" className="mt-0">
                  {summary.recommended_actions.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.recommended_actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No actions recommended</p>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

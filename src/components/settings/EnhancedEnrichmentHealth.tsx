import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Activity,
  Zap,
  DollarSign,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/utils/format-numbers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EnhancedEnrichmentHealth() {
  const { userProfile } = useAuth();

  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['enhanced-enrichment-health', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error('No org ID');

      // Get provider health
      const { data: providers } = await supabase
        .from('provider_health')
        .select('*')
        .order('provider') as any;

      // Get recent enrichment history (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentHistory } = await supabase
        .from('enrichment_history')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false }) as any;

      // Get field coverage
      const { data: coverage } = await supabase
        .from('enrichment_field_coverage')
        .select('*')
        .eq('org_id', userProfile.org_id) as any;

      // Calculate overall stats
      const totalEnrichments = recentHistory?.length || 0;
      const successfulEnrichments = recentHistory?.filter((h: any) => h.status === 'success').length || 0;
      const failedEnrichments = recentHistory?.filter((h: any) => h.status === 'failed').length || 0;
      const totalCreditsUsed = recentHistory?.reduce((sum: number, h: any) => sum + (h.credits_used || 0), 0) || 0;
      const avgResponseTime = recentHistory?.length 
        ? Math.round(recentHistory.reduce((sum: number, h: any) => sum + (h.response_time_ms || 0), 0) / recentHistory.length)
        : 0;

      // Group by provider
      const byProvider = recentHistory?.reduce((acc: any, h: any) => {
        if (!acc[h.provider]) {
          acc[h.provider] = { total: 0, success: 0, failed: 0, credits: 0 };
        }
        acc[h.provider].total++;
        if (h.status === 'success') acc[h.provider].success++;
        if (h.status === 'failed') acc[h.provider].failed++;
        acc[h.provider].credits += h.credits_used || 0;
        return acc;
      }, {} as Record<string, any>) || {};

      return {
        providers: providers || [],
        recentHistory: recentHistory || [],
        coverage: coverage || [],
        stats: {
          totalEnrichments,
          successfulEnrichments,
          failedEnrichments,
          successRate: totalEnrichments > 0 ? Math.round((successfulEnrichments / totalEnrichments) * 100) : 0,
          totalCreditsUsed,
          avgResponseTime,
          byProvider,
        }
      };
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 120000, // Refresh every 120 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Enrichment Health Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getProviderStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      healthy: { variant: 'default', icon: CheckCircle, text: 'Healthy' },
      degraded: { variant: 'outline', icon: AlertTriangle, text: 'Degraded' },
      down: { variant: 'destructive', icon: AlertCircle, text: 'Down' },
      unknown: { variant: 'secondary', icon: Clock, text: 'Unknown' },
    };
    const config = variants[status] || variants.unknown;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Enrichment Health Dashboard
            </CardTitle>
            <CardDescription>
              Real-time monitoring and performance metrics
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Last 7 Days</span>
            </div>
            <div className="text-2xl font-bold">{formatNumber(healthData?.stats.totalEnrichments || 0)}</div>
            <div className="text-xs text-muted-foreground">Total Enrichments</div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-muted-foreground">Success Rate</span>
            </div>
            <div className="text-2xl font-bold text-success">{healthData?.stats.successRate}%</div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(healthData?.stats.successfulEnrichments || 0)} successful
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-warning" />
              <span className="text-sm text-muted-foreground">Credits Used</span>
            </div>
            <div className="text-2xl font-bold">{formatNumber(healthData?.stats.totalCreditsUsed || 0)}</div>
            <div className="text-xs text-muted-foreground">Last 7 days</div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Avg Response</span>
            </div>
            <div className="text-2xl font-bold">{healthData?.stats.avgResponseTime}ms</div>
            <div className="text-xs text-muted-foreground">Response time</div>
          </div>
        </div>

        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-4">
            {healthData?.providers.map((provider: any) => {
              const providerStats = healthData.stats.byProvider[provider.provider] || {};
              const successRate = providerStats.total > 0 
                ? Math.round((providerStats.success / providerStats.total) * 100) 
                : 0;

              return (
                <div key={provider.provider} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold capitalize">{provider.provider}</span>
                      {getProviderStatusBadge(provider.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {provider.last_check_at && new Date(provider.last_check_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <div className="font-semibold">{successRate}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Requests (7d)</div>
                      <div className="font-semibold">{formatNumber(providerStats.total || 0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Credits Used</div>
                      <div className="font-semibold">{formatNumber(providerStats.credits || 0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Credits Left</div>
                      <div className="font-semibold">
                        {provider.credits_remaining 
                          ? formatNumber(provider.credits_remaining) 
                          : 'Unlimited'}
                      </div>
                    </div>
                  </div>

                  {provider.credits_total && provider.credits_remaining !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Credit Usage</span>
                        <span>
                          {formatNumber(provider.credits_used || 0)} / {formatNumber(provider.credits_total)}
                        </span>
                      </div>
                      <Progress 
                        value={(provider.credits_used || 0) / provider.credits_total * 100} 
                        className="h-2"
                      />
                    </div>
                  )}

                  {provider.error_message && (
                    <div className="text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5" />
                      <span>{provider.error_message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Coverage Tab */}
          <TabsContent value="coverage" className="space-y-3">
            {healthData?.coverage.map((field: any) => (
              <div key={field.field_name} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{field.field_name.replace('_', ' ')}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {field.field_category}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold">
                    {field.coverage_percentage}%
                  </span>
                </div>
                <Progress value={field.coverage_percentage} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  {formatNumber(field.enriched_accounts)} / {formatNumber(field.total_accounts)} accounts
                </div>
              </div>
            ))}

            {(!healthData?.coverage || healthData.coverage.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No coverage data available yet</p>
                <p className="text-xs">Start enriching accounts to see coverage metrics</p>
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(healthData?.stats.byProvider || {}).map(([provider, stats]: [string, any]) => (
                <div key={provider} className="p-4 border rounded-lg">
                  <h4 className="font-semibold capitalize mb-3">{provider}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Requests</span>
                      <span className="font-medium">{formatNumber(stats.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Successful</span>
                      <span className="font-medium text-success">{formatNumber(stats.success)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed</span>
                      <span className="font-medium text-destructive">{formatNumber(stats.failed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className="font-medium">
                        {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(healthData?.stats.byProvider || {}).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No performance data available yet</p>
                <p className="text-xs">Start enriching accounts to see performance metrics</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

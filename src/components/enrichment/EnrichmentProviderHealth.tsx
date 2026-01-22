import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  DollarSign,
  Zap,
  Activity,
  TrendingUp,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface ProviderHealth {
  provider: string;
  status: string;
  avg_latency_ms: number | null;
  failure_count: number;
  timeout_count: number;
  total_cost: number;
  requests_24h: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  checked_at: string;
}

interface CircuitHealth {
  service_name: string;
  circuit_state: string;
  failure_count: number;
  cooldown_until: string | null;
  avg_response_time_ms: number | null;
}

interface UsageStats {
  provider: string;
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  totalCost: number;
  timeouts: number;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  perplexity: 'Perplexity',
  anthropic: 'Claude',
  xai: 'Grok',
  lovable: 'Gemini',
  openai: 'GPT',
};

const PROVIDER_COLORS: Record<string, string> = {
  perplexity: 'text-blue-500',
  anthropic: 'text-amber-500',
  xai: 'text-purple-500',
  lovable: 'text-emerald-500',
  openai: 'text-green-500',
};

export function EnrichmentProviderHealth() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['enrichment-provider-health', orgId],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // Fetch provider health, circuit status, and usage stats in parallel
      const [healthResult, circuitResult, usageResult, budgetResult] = await Promise.all([
        supabase
          .from('ai_provider_health')
          .select('*')
          .in('provider', ['perplexity', 'anthropic', 'xai', 'lovable', 'openai']),
        supabase
          .from('service_health')
          .select('service_name, circuit_state, failure_count, cooldown_until, avg_response_time_ms')
          .in('service_name', ['perplexity', 'anthropic', 'xai', 'lovable', 'openai']),
        supabase
          .from('ai_usage_tracking')
          .select('provider, cost_estimate, latency_ms, success, error_message')
          .in('provider', ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'])
          .gte('created_at', last24h)
          .eq('org_id', orgId || ''),
        supabase
          .from('ai_usage_tracking')
          .select('cost_estimate')
          .eq('org_id', orgId || '')
          .gte('created_at', todayStart.toISOString()),
      ]);

      const providerHealth = (healthResult.data || []) as ProviderHealth[];
      const circuitHealth = (circuitResult.data || []) as CircuitHealth[];
      const usageData = usageResult.data || [];

      // Calculate daily budget usage
      const dailyCost = (budgetResult.data || []).reduce(
        (sum: number, row: any) => sum + (parseFloat(row.cost_estimate) || 0), 
        0
      );
      const dailyBudget = 50; // $50/day default
      const budgetUsedPercent = Math.min((dailyCost / dailyBudget) * 100, 100);

      // Calculate per-provider stats from usage data
      const providerStats = new Map<string, UsageStats>();
      const providers = ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'];
      
      for (const provider of providers) {
        const providerUsage = usageData.filter((u: any) => u.provider === provider);
        const successCount = providerUsage.filter((u: any) => u.success).length;
        const timeoutCount = providerUsage.filter((u: any) => 
          u.error_message?.includes('timeout') || u.error_message?.includes('timed out')
        ).length;
        
        providerStats.set(provider, {
          provider,
          totalRequests: providerUsage.length,
          successRate: providerUsage.length > 0 ? (successCount / providerUsage.length) * 100 : 0,
          avgLatency: providerUsage.length > 0
            ? Math.round(providerUsage.reduce((sum: number, u: any) => sum + (u.latency_ms || 0), 0) / providerUsage.length)
            : 0,
          totalCost: providerUsage.reduce((sum: number, u: any) => sum + (parseFloat(u.cost_estimate) || 0), 0),
          timeouts: timeoutCount,
        });
      }

      return {
        providerHealth,
        circuitHealth,
        providerStats,
        dailyCost,
        dailyBudget,
        budgetUsedPercent,
      };
    },
    enabled: !!orgId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIndicator = (provider: string) => {
    const health = data?.providerHealth.find(h => h.provider === provider);
    const circuit = data?.circuitHealth.find(c => c.service_name === provider);
    
    // Check circuit state first
    if (circuit?.circuit_state === 'open') {
      return { color: 'bg-destructive', icon: XCircle, label: 'Circuit Open' };
    }
    if (circuit?.circuit_state === 'half_open') {
      return { color: 'bg-warning', icon: AlertTriangle, label: 'Recovering' };
    }
    
    // Check provider health
    if (!health) {
      return { color: 'bg-muted', icon: Activity, label: 'No Data' };
    }
    
    if (health.status === 'healthy') {
      return { color: 'bg-emerald-500', icon: CheckCircle2, label: 'Healthy' };
    }
    if (health.status === 'degraded') {
      return { color: 'bg-warning', icon: AlertTriangle, label: 'Degraded' };
    }
    return { color: 'bg-destructive', icon: XCircle, label: 'Unhealthy' };
  };

  const formatLatency = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const providers = ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'];
  const healthyCount = providers.filter(p => {
    const status = getStatusIndicator(p);
    return status.label === 'Healthy';
  }).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Enrichment Pipeline Health
          </CardTitle>
          <CardDescription>
            Real-time status of AI providers with adaptive timeouts and circuit breakers
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {/* Budget Meter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Daily Budget</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={data?.budgetUsedPercent || 0} 
                  className="h-1.5 w-20"
                />
                <span className="text-xs font-medium">
                  {formatCost(data?.dailyCost || 0)} / ${data?.dailyBudget || 50}
                </span>
              </div>
            </div>
          </div>
          
          <Badge 
            variant={healthyCount === 5 ? 'default' : healthyCount >= 3 ? 'secondary' : 'destructive'}
            className="gap-1"
          >
            <Shield className="h-3 w-3" />
            {healthyCount}/5 Healthy
          </Badge>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {providers.map(provider => {
            const status = getStatusIndicator(provider);
            const stats = data?.providerStats.get(provider);
            const health = data?.providerHealth.find(h => h.provider === provider);
            const circuit = data?.circuitHealth.find(c => c.service_name === provider);
            const StatusIcon = status.icon;

            return (
              <div 
                key={provider}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  status.label === 'Healthy' && "border-emerald-500/30 bg-emerald-500/5",
                  status.label === 'Degraded' && "border-warning/30 bg-warning/5",
                  status.label === 'Unhealthy' && "border-destructive/30 bg-destructive/5",
                  status.label === 'Circuit Open' && "border-destructive/50 bg-destructive/10",
                  status.label === 'Recovering' && "border-warning/50 bg-warning/10",
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", status.color)} />
                    <span className={cn("font-medium text-sm", PROVIDER_COLORS[provider])}>
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </span>
                  </div>
                  <StatusIcon className={cn(
                    "h-4 w-4",
                    status.label === 'Healthy' && "text-emerald-500",
                    status.label === 'Degraded' && "text-warning",
                    status.label === 'Unhealthy' && "text-destructive",
                    status.label === 'Circuit Open' && "text-destructive",
                    status.label === 'Recovering' && "text-warning",
                  )} />
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Success</span>
                    <span className="font-medium">
                      {stats?.successRate ? `${stats.successRate.toFixed(0)}%` : '-'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-medium">
                      {formatLatency(stats?.avgLatency || health?.avg_latency_ms)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Timeouts</span>
                    <span className={cn(
                      "font-medium",
                      (stats?.timeouts || 0) > 5 && "text-destructive"
                    )}>
                      {stats?.timeouts || health?.timeout_count || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium">
                      {formatCost(stats?.totalCost || 0)}
                    </span>
                  </div>
                </div>
                
                {/* Circuit Breaker Status */}
                {circuit?.circuit_state === 'open' && circuit.cooldown_until && (
                  <div className="mt-2 pt-2 border-t border-destructive/20">
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <Clock className="h-3 w-3" />
                      <span>
                        Cooldown: {Math.max(0, Math.round((new Date(circuit.cooldown_until).getTime() - Date.now()) / 1000))}s
                      </span>
                    </div>
                  </div>
                )}
                
                {circuit?.circuit_state === 'half_open' && (
                  <div className="mt-2 pt-2 border-t border-warning/20">
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <TrendingUp className="h-3 w-3" />
                      <span>Testing recovery...</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Last 24h: {data?.providerStats ? 
                Array.from(data.providerStats.values()).reduce((sum, s) => sum + s.totalRequests, 0) 
                : 0} requests
            </span>
            <span>
              Total cost: {formatCost(
                data?.providerStats ? 
                  Array.from(data.providerStats.values()).reduce((sum, s) => sum + s.totalCost, 0) 
                  : 0
              )}
            </span>
          </div>
          <span className="text-xs">
            Auto-refresh: 30s
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

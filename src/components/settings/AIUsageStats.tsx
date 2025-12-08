import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  DollarSign, 
  Clock, 
  Zap, 
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UsageStats {
  totalRequests: number;
  successRate: number;
  totalCost: number;
  avgLatency: number;
  byProvider: Record<string, {
    requests: number;
    cost: number;
    avgLatency: number;
    successRate: number;
  }>;
  byTaskType: Record<string, number>;
}

interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  lastChecked?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  abacus: 'Abacus.AI',
  lovable: 'Lovable AI',
};

const STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-gray-500',
};

export function AIUsageStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    loadStats();
    loadProviderHealth();
  }, []);

  const loadStats = async () => {
    try {
      // Get usage data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('ai_usage_tracking')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Calculate stats
      const usage = data || [];
      const totalRequests = usage.length;
      const successfulRequests = usage.filter(u => u.success).length;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
      const totalCost = usage.reduce((sum, u) => sum + (Number(u.cost_estimate) || 0), 0);
      const avgLatency = totalRequests > 0 
        ? usage.reduce((sum, u) => sum + (u.latency_ms || 0), 0) / totalRequests 
        : 0;

      // Group by provider
      const byProvider: Record<string, any> = {};
      for (const u of usage) {
        if (!byProvider[u.provider]) {
          byProvider[u.provider] = { requests: 0, cost: 0, totalLatency: 0, successful: 0 };
        }
        byProvider[u.provider].requests++;
        byProvider[u.provider].cost += Number(u.cost_estimate) || 0;
        byProvider[u.provider].totalLatency += u.latency_ms || 0;
        if (u.success) byProvider[u.provider].successful++;
      }

      for (const provider of Object.keys(byProvider)) {
        byProvider[provider].avgLatency = Math.round(byProvider[provider].totalLatency / byProvider[provider].requests);
        byProvider[provider].successRate = (byProvider[provider].successful / byProvider[provider].requests) * 100;
      }

      // Group by task type
      const byTaskType: Record<string, number> = {};
      for (const u of usage) {
        const taskType = u.task_type || 'unknown';
        byTaskType[taskType] = (byTaskType[taskType] || 0) + 1;
      }

      setStats({
        totalRequests,
        successRate,
        totalCost,
        avgLatency: Math.round(avgLatency),
        byProvider,
        byTaskType,
      });
    } catch (error) {
      console.error('Failed to load AI usage stats:', error);
      toast.error('Failed to load AI usage statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProviderHealth = async () => {
    try {
      const { data } = await supabase
        .from('ai_provider_health')
        .select('*')
        .order('checked_at', { ascending: false });

      setProviderHealth((data || []).map(p => ({
        provider: p.provider,
        status: p.status as any,
        latencyMs: p.avg_latency_ms,
        lastChecked: p.checked_at,
      })));
    } catch (error) {
      console.error('Failed to load provider health:', error);
    }
  };

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-health-check', {
        body: {},
      });

      if (error) throw error;

      setProviderHealth(data.providers || []);
      toast.success(`Health check complete: ${data.overall}`);
    } catch (error) {
      console.error('Health check failed:', error);
      toast.error('Health check failed');
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats?.totalRequests || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats?.successRate.toFixed(1) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
                <p className="text-2xl font-bold">${stats?.totalCost.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold">{stats?.avgLatency.toFixed(0) || 0}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Health & Usage */}
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Provider Health</TabsTrigger>
          <TabsTrigger value="usage">Usage by Provider</TabsTrigger>
          <TabsTrigger value="tasks">Usage by Task</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">AI Provider Status</CardTitle>
                  <CardDescription>Real-time health monitoring</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={runHealthCheck}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['openai', 'abacus', 'lovable'].map(provider => {
                  const health = providerHealth.find(p => p.provider === provider);
                  const status = health?.status || 'unknown';
                  
                  return (
                    <div 
                      key={provider}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
                        <div>
                          <p className="font-medium">{PROVIDER_LABELS[provider]}</p>
                          <p className="text-sm text-muted-foreground capitalize">{status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {health?.latencyMs && (
                          <p className="text-sm">{health.latencyMs}ms avg</p>
                        )}
                        {health?.lastChecked && (
                          <p className="text-xs text-muted-foreground">
                            Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Provider</CardTitle>
              <CardDescription>Last 30 days breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(stats?.byProvider || {}).map(([provider, data]) => (
                  <div key={provider} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{PROVIDER_LABELS[provider] || provider}</span>
                      <Badge variant="secondary">{data.requests} requests</Badge>
                    </div>
                    <Progress 
                      value={(data.requests / (stats?.totalRequests || 1)) * 100} 
                      className="h-2"
                    />
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>${data.cost.toFixed(2)} spent</span>
                      <span>{data.avgLatency.toFixed(0)}ms avg</span>
                      <span>{data.successRate.toFixed(0)}% success</span>
                    </div>
                  </div>
                ))}
                
                {Object.keys(stats?.byProvider || {}).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No usage data yet. Start using the AI chat to see statistics.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Task Type</CardTitle>
              <CardDescription>Distribution of AI usage across tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats?.byTaskType || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([taskType, count]) => (
                    <div key={taskType} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{taskType.replace(/_/g, ' ')}</span>
                        <span className="text-sm text-muted-foreground">{count} requests</span>
                      </div>
                      <Progress 
                        value={(count / (stats?.totalRequests || 1)) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                
                {Object.keys(stats?.byTaskType || {}).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No task data yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
